// Función del servidor (Vercel) que emite comprobantes electrónicos en ARCA (ex AFIP) con el CUIT de Mica.
//
// Hace falta la CLAVE PRIVADA del certificado y no puede estar nunca en el navegador: vive en variables
// de entorno del servidor (ARCA_CERT_PROD / ARCA_KEY_PROD; ARCA_CERT_HOMO / ARCA_KEY_HOMO para pruebas).
// Quién puede usarla: cualquier perfil activo (se valida con la sesión de quien llama y todo pasa por RLS).
//
// Acciones (POST, JSON):
//   { accion: 'estado' }                                   -> prueba la conexión con ARCA
//   { accion: 'padron', cuit }                              -> nombre, condición de IVA y domicilio de un CUIT
//   { accion: 'emitir', cbteTipo, receptor, pagoIds? | items?, observaciones? }
//   { accion: 'nota_credito', facturaId }                   -> anula una factura completa

import https from 'node:https'
import forge from 'node-forge'
import { XMLParser } from 'fast-xml-parser'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ----------------------------------------------------------------------------
// Constantes de ARCA
// ----------------------------------------------------------------------------
const URLS = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    padron: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5',
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
    padron: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5',
  },
} as const

export type Ambiente = keyof typeof URLS

/** 1 = Factura A, 6 = Factura B, 3 = Nota de crédito A, 8 = Nota de crédito B. */
export const NOTA_CREDITO_DE: Record<number, number> = { 1: 3, 6: 8 }
export const COD_IVA_21 = 5 // alícuota 21 % en WSFE

const xml = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false })

// ----------------------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------------------
const pesos = (cents: number) => (cents / 100).toFixed(2)
const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Fecha de hoy en Argentina (UTC-3) como { iso: 'yyyy-mm-dd', arca: 'yyyymmdd' }. */
export function hoyArgentina(ahora = new Date()) {
  const ar = new Date(ahora.getTime() - 3 * 3600 * 1000)
  const iso = ar.toISOString().slice(0, 10)
  return { iso, arca: iso.replace(/-/g, '') }
}

/** Dígito verificador del CUIT/CUIL (módulo 11). */
export function cuitValido(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = mult.reduce((s, m, i) => s + m * Number(cuit[i]), 0)
  let dv = 11 - (suma % 11)
  if (dv === 11) dv = 0
  if (dv === 10) dv = 9
  return dv === Number(cuit[10])
}

/** Parte un total (con IVA incluido al 21 %) en neto + IVA, en centavos, sin diferencias de redondeo. */
export function partirIva21(totalCents: number) {
  const neto = Math.round(totalCents / 1.21)
  return { neto, iva: totalCents - neto }
}

function pem(valor: string | undefined, nombre: string): string {
  if (!valor) throw new Error(`Falta la variable ${nombre} en el servidor.`)
  // Acepta el PEM con saltos de línea reales (pegado en Vercel), con "\n" escritos como texto, y con los saltos de Windows (\r\n).
  return valor.replace(/\\n/g, '\n').replace(/\r/g, '').trim()
}

function certificados(ambiente: Ambiente) {
  return ambiente === 'produccion'
    ? { cert: pem(process.env.ARCA_CERT_PROD, 'ARCA_CERT_PROD'), key: pem(process.env.ARCA_KEY_PROD, 'ARCA_KEY_PROD') }
    : { cert: pem(process.env.ARCA_CERT_HOMO, 'ARCA_CERT_HOMO'), key: pem(process.env.ARCA_KEY_HOMO, 'ARCA_KEY_HOMO') }
}

// ----------------------------------------------------------------------------
// WSAA: ticket de acceso
// ----------------------------------------------------------------------------
export function armarTRA(servicio: string, ahora = new Date()): string {
  const fmt = (d: Date) => {
    const ar = new Date(d.getTime() - 3 * 3600 * 1000)
    return ar.toISOString().slice(0, 19) + '-03:00'
  }
  const id = Math.floor(ahora.getTime() / 1000)
  return (
    `<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header>` +
    `<uniqueId>${id}</uniqueId><generationTime>${fmt(new Date(ahora.getTime() - 10 * 60 * 1000))}</generationTime>` +
    `<expirationTime>${fmt(new Date(ahora.getTime() + 10 * 60 * 1000))}</expirationTime></header><service>${servicio}</service></loginTicketRequest>`
  )
}

/** Firma el TRA (CMS/PKCS#7 con el contenido incluido) y lo devuelve en base64. */
export function firmarTRA(tra: string, certPem: string, keyPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem)
  const key = forge.pki.privateKeyFromPem(keyPem)
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(tra, 'utf8')
  p7.addCertificate(cert)
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  })
  p7.sign()
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes())
}

// Los servidores de producción de ARCA usan una clave Diffie-Hellman de 1024 bits que Node rechaza por defecto
// ("dh key too small"). Se baja el nivel de seguridad SOLO para hablar con ARCA.
const agenteArca = new https.Agent({ ciphers: 'DEFAULT@SECLEVEL=0', keepAlive: false })

function postHttps(url: string, soapAction: string, cuerpo: string): Promise<{ status: number; texto: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.request(
      {
        host: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        agent: agenteArca,
        timeout: 30_000,
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction, 'Content-Length': Buffer.byteLength(cuerpo) },
      },
      (res) => {
        const trozos: Buffer[] = []
        res.on('data', (c: Buffer) => trozos.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, texto: Buffer.concat(trozos).toString('utf8') }))
      },
    )
    req.on('timeout', () => req.destroy(new Error('ARCA tardó demasiado en responder.')))
    req.on('error', reject)
    req.end(cuerpo)
  })
}

async function postSoap(url: string, soapAction: string, cuerpo: string): Promise<string> {
  const { status, texto } = await postHttps(url, soapAction, cuerpo)
  if (status >= 400 && !texto.includes('Fault')) throw new Error(`ARCA respondió ${status}`)
  const fault = texto.match(/<faultstring>([\s\S]*?)<\/faultstring>/)
  if (fault) throw new Error(`ARCA: ${fault[1].trim()}`)
  return texto
}

export type TA = { token: string; sign: string; expira: string }

export const SERVICIO_PADRON = 'ws_sr_constancia_inscripcion'

export async function loginWsaa(ambiente: Ambiente, servicio = 'wsfe'): Promise<TA> {
  const { cert, key } = certificados(ambiente)
  const cms = firmarTRA(armarTRA(servicio), cert, key)
  const sobre =
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
    `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`
  let resp: string
  try {
    resp = await postSoap(URLS[ambiente].wsaa, '', sobre)
  } catch (e) {
    // ARCA entrega un solo ticket por vez (dura unas 12 horas): si ya dio uno que la app no guardó, hay que esperar a que venza.
    if (e instanceof Error && /ya posee un TA valido/i.test(e.message))
      throw new Error('ARCA ya entregó un ticket de acceso que esta app no tiene guardado (por ejemplo, de una prueba). Se libera solo cuando vence, en unas horas.')
    throw e
  }
  const retorno = xml.parse(resp)?.Envelope?.Body?.loginCmsResponse?.loginCmsReturn as string | undefined
  if (!retorno) throw new Error('ARCA no devolvió el ticket de acceso.')
  const ta = xml.parse(retorno)?.loginTicketResponse
  const token = ta?.credentials?.token as string | undefined
  const sign = ta?.credentials?.sign as string | undefined
  const expira = ta?.header?.expirationTime as string | undefined
  if (!token || !sign || !expira) throw new Error('El ticket de acceso de ARCA vino incompleto.')
  return { token, sign, expira: new Date(expira).toISOString() }
}

/** Devuelve un ticket vigente: el guardado si todavía sirve, o uno nuevo (ARCA no deja pedir otro mientras el anterior es válido). */
async function obtenerTA(db: SupabaseClient, ambiente: Ambiente, servicio = 'wsfe'): Promise<TA> {
  const { data } = await db.from('arca_ta').select('token, sign, expira').eq('ambiente', ambiente).eq('servicio', servicio).maybeSingle()
  if (data && new Date(data.expira).getTime() > Date.now() + 5 * 60 * 1000) return data as TA
  const nuevo = await loginWsaa(ambiente, servicio)
  await db.from('arca_ta').upsert({ ambiente, servicio, ...nuevo }, { onConflict: 'ambiente,servicio' })
  return nuevo
}

// ----------------------------------------------------------------------------
// Padrón (ws_sr_constancia_inscripcion): datos de una persona a partir de su CUIT
// ----------------------------------------------------------------------------
export type DatosPadron = {
  cuit: string
  nombre: string
  tipoPersona: string
  /** false si la clave está dada de baja o inactiva en ARCA. */
  activo: boolean
  /** Código de condición frente al IVA (los mismos que usa la factura): 1 Resp. Inscripto, 4 Exento, 6 Monotributo, 5 el resto. */
  condicion_iva_id: number
  domicilio: string
}

/** Arma los datos que le sirven a la factura a partir de la respuesta de getPersona_v2. */
export function interpretarPersona(cuit: string, persona: any): DatosPadron {
  const g = persona?.datosGenerales ?? {}
  const impuestosActivos = (bloque: any) =>
    comoLista<any>(bloque?.impuesto)
      .filter((i) => String(i?.estadoImpuesto ?? 'AC') === 'AC')
      .map((i) => Number(i.idImpuesto))
  const iva = impuestosActivos(persona?.datosRegimenGeneral)
  const mono = impuestosActivos(persona?.datosMonotributo)
  const condicion = iva.includes(30) ? 1 : iva.includes(32) ? 4 : mono.includes(20) || persona?.datosMonotributo ? 6 : 5

  const fisica = String(g.tipoPersona ?? '').toUpperCase() === 'FISICA'
  const nombre = (fisica ? [g.apellido, g.nombre].filter(Boolean).join(' ') : g.razonSocial || [g.apellido, g.nombre].filter(Boolean).join(' ')).toString().trim()
  const d = g.domicilioFiscal ?? {}
  const domicilio = [d.direccion, d.localidad, d.descripcionProvincia].filter(Boolean).join(', ')
  return {
    cuit,
    nombre,
    tipoPersona: String(g.tipoPersona ?? ''),
    activo: String(g.estadoClave ?? 'ACTIVO').toUpperCase() === 'ACTIVO',
    condicion_iva_id: condicion,
    domicilio,
  }
}

export async function consultarPadron(ta: TA, ambiente: Ambiente, cuitRepresentada: string, cuitConsultado: string): Promise<DatosPadron> {
  const sobre =
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr/"><soapenv:Header/><soapenv:Body>` +
    `<a5:getPersona_v2><token>${ta.token}</token><sign>${ta.sign}</sign><cuitRepresentada>${cuitRepresentada}</cuitRepresentada><idPersona>${cuitConsultado}</idPersona></a5:getPersona_v2>` +
    `</soapenv:Body></soapenv:Envelope>`
  const resp = await postSoap(URLS[ambiente].padron, '', sobre)
  const persona = xml.parse(resp)?.Envelope?.Body?.getPersona_v2Response?.personaReturn
  if (!persona || (!persona.datosGenerales && persona.errorConstancia)) {
    const err = comoLista<string>(persona?.errorConstancia?.error).join(' ')
    throw new Error(err ? `ARCA: ${err}` : 'ARCA no encontró ese CUIT.')
  }
  return interpretarPersona(cuitConsultado, persona)
}

// ----------------------------------------------------------------------------
// WSFE: facturación electrónica
// ----------------------------------------------------------------------------
const NS = 'http://ar.gov.afip.dif.FEV1/'

function sobreWsfe(operacion: string, cuerpo: string): string {
  return (
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${NS}">` +
    `<soapenv:Header/><soapenv:Body><ar:${operacion}>${cuerpo}</ar:${operacion}></soapenv:Body></soapenv:Envelope>`
  )
}

const auth = (ta: TA, cuit: string) => `<ar:Auth><ar:Token>${ta.token}</ar:Token><ar:Sign>${ta.sign}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>`

export async function llamarWsfe(ambiente: Ambiente, operacion: string, cuerpo: string) {
  const resp = await postSoap(URLS[ambiente].wsfe, `${NS}${operacion}`, sobreWsfe(operacion, cuerpo))
  return xml.parse(resp)?.Envelope?.Body?.[`${operacion}Response`]?.[`${operacion}Result`]
}

const comoLista = <T,>(x: T | T[] | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x])

function textoErrores(r: any): string {
  const errores = comoLista<any>(r?.Errors?.Err).map((e) => `${e.Code}: ${e.Msg}`)
  const obs = comoLista<any>(r?.FeDetResp?.FECAEDetResponse?.Observaciones?.Obs).map((o) => `${o.Code}: ${o.Msg}`)
  return [...errores, ...obs].join(' | ')
}

export async function estadoServidores(ambiente: Ambiente) {
  const r = await llamarWsfe(ambiente, 'FEDummy', '')
  return { appServer: r?.AppServer, dbServer: r?.DbServer, authServer: r?.AuthServer }
}

export async function ultimoAutorizado(ta: TA, ambiente: Ambiente, cuit: string, ptoVta: number, cbteTipo: number): Promise<number> {
  const r = await llamarWsfe(ambiente, 'FECompUltimoAutorizado', `${auth(ta, cuit)}<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo>`)
  if (r?.Errors) throw new Error(`ARCA: ${textoErrores(r)}`)
  return Number(r?.CbteNro ?? 0)
}

export type Receptor = { doc_tipo: number; doc_nro: string; nombre: string; condicion_iva_id: number; domicilio?: string }

export type PedidoComprobante = {
  cuit: string
  ptoVta: number
  cbteTipo: number
  numero: number
  fechaArca: string
  totalCents: number
  receptor: Receptor
  asociado?: { tipo: number; ptoVta: number; numero: number; cuit: string }
}

export function armarCuerpoCAE(ta: TA, p: PedidoComprobante): string {
  const { neto, iva } = partirIva21(p.totalCents)
  const asoc = p.asociado
    ? `<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>${p.asociado.tipo}</ar:Tipo><ar:PtoVta>${p.asociado.ptoVta}</ar:PtoVta><ar:Nro>${p.asociado.numero}</ar:Nro><ar:Cuit>${p.asociado.cuit}</ar:Cuit></ar:CbteAsoc></ar:CbtesAsoc>`
    : ''
  return (
    auth(ta, p.cuit) +
    `<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${p.ptoVta}</ar:PtoVta><ar:CbteTipo>${p.cbteTipo}</ar:CbteTipo></ar:FeCabReq>` +
    `<ar:FeDetReq><ar:FECAEDetRequest><ar:Concepto>1</ar:Concepto><ar:DocTipo>${p.receptor.doc_tipo}</ar:DocTipo><ar:DocNro>${p.receptor.doc_nro}</ar:DocNro>` +
    `<ar:CbteDesde>${p.numero}</ar:CbteDesde><ar:CbteHasta>${p.numero}</ar:CbteHasta><ar:CbteFch>${p.fechaArca}</ar:CbteFch>` +
    `<ar:ImpTotal>${pesos(p.totalCents)}</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>${pesos(neto)}</ar:ImpNeto><ar:ImpOpEx>0.00</ar:ImpOpEx>` +
    `<ar:ImpTrib>0.00</ar:ImpTrib><ar:ImpIVA>${pesos(iva)}</ar:ImpIVA><ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>` +
    `<ar:CondicionIVAReceptorId>${p.receptor.condicion_iva_id}</ar:CondicionIVAReceptorId>${asoc}` +
    `<ar:Iva><ar:AlicIva><ar:Id>${COD_IVA_21}</ar:Id><ar:BaseImp>${pesos(neto)}</ar:BaseImp><ar:Importe>${pesos(iva)}</ar:Importe></ar:AlicIva></ar:Iva>` +
    `</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>`
  )
}

export type ResultadoCAE = { aprobado: boolean; cae: string | null; caeVto: string | null; mensaje: string }

export function leerRespuestaCAE(r: any): ResultadoCAE {
  const det = comoLista<any>(r?.FeDetResp?.FECAEDetResponse)[0]
  const mensaje = textoErrores(r)
  const aprobado = det?.Resultado === 'A' && !!det?.CAE
  const vto = det?.CAEFchVto as string | undefined
  return {
    aprobado,
    cae: aprobado ? String(det.CAE) : null,
    caeVto: aprobado && vto ? `${vto.slice(0, 4)}-${vto.slice(4, 6)}-${vto.slice(6, 8)}` : null,
    mensaje,
  }
}

export async function solicitarCAE(ta: TA, ambiente: Ambiente, p: PedidoComprobante): Promise<ResultadoCAE> {
  const r = await llamarWsfe(ambiente, 'FECAESolicitar', armarCuerpoCAE(ta, p))
  return leerRespuestaCAE(r)
}

// ----------------------------------------------------------------------------
// Validaciones del pedido
// ----------------------------------------------------------------------------
export function validarReceptor(cbteTipo: number, r: Receptor): string | null {
  if (!r || typeof r !== 'object') return 'Faltan los datos del cliente.'
  if (![1, 6].includes(cbteTipo)) return 'Solo se puede emitir Factura A o Factura B.'
  const doc = String(r.doc_nro ?? '').replace(/\D/g, '')
  if (cbteTipo === 1) {
    if (r.doc_tipo !== 80 || !cuitValido(doc)) return 'La Factura A necesita el CUIT del cliente (11 números, válido).'
    if (![1, 6, 13, 16].includes(r.condicion_iva_id)) return 'La Factura A es para clientes Responsable Inscripto o Monotributista.'
    if (!r.nombre?.trim()) return 'Falta la razón social del cliente.'
  } else {
    if (r.doc_tipo === 99) {
      if (doc !== '0') return 'Consumidor final sin identificar lleva documento 0.'
    } else if (r.doc_tipo === 80) {
      if (!cuitValido(doc)) return 'El CUIT del cliente no es válido.'
    } else if (r.doc_tipo === 96 || r.doc_tipo === 86) {
      if (!/^\d{7,11}$/.test(doc)) return 'El documento del cliente no es válido.'
    } else return 'Tipo de documento no válido.'
    if (r.condicion_iva_id === 1) return 'A un Responsable Inscripto corresponde Factura A.'
  }
  return null
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------
function responder(res: any, status: number, cuerpo: unknown) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(cuerpo)
}

const TIPO_PAGO: Record<string, string> = {
  sena: 'Seña',
  parcial: 'Pago parcial',
  final: 'Pago final',
  completo: 'Pago completo',
  ajuste: 'Ajuste',
}

type ItemFactura = { nombre: string; cantidad: number; precio_unit_cents: number; subtotal_cents: number }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return responder(res, 405, { error: 'Método no permitido.' })
  try {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
    const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
    const token = String(req.headers?.authorization ?? '').replace(/^Bearer\s+/i, '')
    if (!url || !anon) return responder(res, 500, { error: 'Falta configurar Supabase en el servidor.' })
    if (!token) return responder(res, 401, { error: 'Tenés que iniciar sesión.' })

    // Todo se hace con la sesión de quien llama: las reglas de seguridad (RLS) siguen mandando.
    const db = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: u } = await db.auth.getUser(token)
    if (!u.user) return responder(res, 401, { error: 'La sesión venció, volvé a entrar.' })

    const { data: cfg, error: errCfg } = await db.from('fiscal_config').select('*').maybeSingle()
    if (errCfg || !cfg) return responder(res, 400, { error: 'No hay datos fiscales cargados.' })
    const ambiente = cfg.ambiente as Ambiente
    const cuit = String(cfg.cuit)
    const body = req.body ?? {}

    // ---- estado: prueba que el certificado y ARCA responden (no emite nada) ----
    if (body.accion === 'estado') {
      const servidores = await estadoServidores(ambiente)
      const ta = await obtenerTA(db, ambiente)
      const ultimoB = await ultimoAutorizado(ta, ambiente, cuit, cfg.punto_venta, 6)
      const ultimoA = await ultimoAutorizado(ta, ambiente, cuit, cfg.punto_venta, 1)
      return responder(res, 200, { ok: true, ambiente, puntoVenta: cfg.punto_venta, servidores, ultimoFacturaA: ultimoA, ultimoFacturaB: ultimoB })
    }

    // ---- padrón: datos de un cliente a partir de su CUIT ----
    if (body.accion === 'padron') {
      const consultado = String(body.cuit ?? '').replace(/\D/g, '')
      if (!cuitValido(consultado)) return responder(res, 400, { error: 'El CUIT no es válido (11 números).' })
      try {
        const ta = await obtenerTA(db, ambiente, SERVICIO_PADRON)
        const datos = await consultarPadron(ta, ambiente, cuit, consultado)
        return responder(res, 200, { ok: true, datos })
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (/no autorizado|not authorized/i.test(msg))
          return responder(res, 400, { error: 'Falta autorizar en ARCA el servicio de padrón (ws_sr_constancia_inscripcion) para este certificado.' })
        if (/no existe persona|no se encontr/i.test(msg)) return responder(res, 404, { error: 'ARCA no tiene ese CUIT. Revisalo.' })
        throw e
      }
    }

    // ---- emitir una factura A/B: de cobros ya registrados (pagoIds) o libre (items) ----
    if (body.accion === 'emitir') {
      const cbteTipo = Number(body.cbteTipo)
      const receptor = body.receptor as Receptor
      const errVal = validarReceptor(cbteTipo, receptor)
      if (errVal) return responder(res, 400, { error: errVal })
      receptor.doc_nro = String(receptor.doc_nro).replace(/\D/g, '')

      let items: ItemFactura[] = []
      let pagoIds: string[] = []

      if (Array.isArray(body.pagoIds) && body.pagoIds.length > 0) {
        pagoIds = [...new Set<string>(body.pagoIds.map(String))]
        const { data: pagos, error: errPagos } = await db
          .from('payments')
          .select('id, amount, payment_type, status, enrollments(students(first_name, last_name), course_editions(name, course_types(name)))')
          .in('id', pagoIds)
        if (errPagos || !pagos || pagos.length !== pagoIds.length) return responder(res, 404, { error: 'No encontré alguno de los cobros.' })
        if (pagos.some((p: any) => p.status !== 'valido' || Number(p.amount) <= 0))
          return responder(res, 400, { error: 'Solo se pueden facturar cobros vigentes y de importe positivo.' })

        // Un cobro no se factura dos veces: tiene que no tener factura, o tenerla anulada con nota de crédito.
        const { data: links } = await db.from('factura_pagos').select('payment_id, factura_id').in('payment_id', pagoIds)
        const facturaIds = [...new Set((links ?? []).map((l: any) => l.factura_id as string))]
        if (facturaIds.length) {
          const { data: ncs } = await db.from('facturas').select('factura_asociada_id').in('factura_asociada_id', facturaIds)
          const anuladas = new Set((ncs ?? []).map((n: any) => n.factura_asociada_id))
          if (facturaIds.some((id) => !anuladas.has(id)))
            return responder(res, 409, { error: 'Alguno de esos cobros ya tiene una factura. Para volver a facturarlo, primero anulala con una nota de crédito.' })
        }

        items = pagos.map((p: any) => {
          const alumna = p.enrollments?.students ? `${p.enrollments.students.last_name}, ${p.enrollments.students.first_name}` : ''
          const curso = p.enrollments?.course_editions?.course_types?.name ?? 'Curso'
          const cents = Math.round(Number(p.amount) * 100)
          return {
            nombre: `${curso} — ${TIPO_PAGO[p.payment_type] ?? 'Pago'}${alumna ? ` (${alumna})` : ''}`.slice(0, 200),
            cantidad: 1,
            precio_unit_cents: cents,
            subtotal_cents: cents,
          }
        })
      } else if (Array.isArray(body.items) && body.items.length > 0) {
        items = body.items.map((i: any) => {
          const cantidad = Math.max(1, Math.round(Number(i.cantidad) || 1))
          const unit = Math.round(Number(i.precio_unit) * 100)
          return { nombre: String(i.nombre ?? '').trim().slice(0, 200), cantidad, precio_unit_cents: unit, subtotal_cents: unit * cantidad }
        })
        if (items.some((i) => !i.nombre || !(i.precio_unit_cents > 0))) return responder(res, 400, { error: 'Cada renglón necesita descripción e importe mayor a cero.' })
      } else {
        return responder(res, 400, { error: 'No hay nada para facturar.' })
      }

      const totalCents = items.reduce((s, i) => s + i.subtotal_cents, 0)
      if (totalCents <= 0) return responder(res, 400, { error: 'El importe a facturar tiene que ser mayor a cero.' })

      const ta = await obtenerTA(db, ambiente)
      const ultimo = await ultimoAutorizado(ta, ambiente, cuit, cfg.punto_venta, cbteTipo)
      const hoy = hoyArgentina()
      const pedido: PedidoComprobante = { cuit, ptoVta: cfg.punto_venta, cbteTipo, numero: ultimo + 1, fechaArca: hoy.arca, totalCents, receptor }
      const r = await solicitarCAE(ta, ambiente, pedido)
      if (!r.aprobado) return responder(res, 422, { error: `ARCA no aprobó la factura. ${r.mensaje}`.trim() })

      const { neto, iva } = partirIva21(totalCents)
      const fila = {
        ambiente,
        cbte_tipo: cbteTipo,
        punto_venta: cfg.punto_venta,
        numero: pedido.numero,
        fecha: hoy.iso,
        cae: r.cae,
        cae_vto: r.caeVto,
        receptor,
        items,
        neto_cents: neto,
        iva_cents: iva,
        total_cents: totalCents,
        observaciones: body.observaciones ? String(body.observaciones).slice(0, 500) : null,
      }
      // ARCA ya aprobó: si guardar falla se reintenta, y si igual falla se devuelve el CAE para no perder la factura.
      let guardada: any = null
      for (let i = 0; i < 3 && !guardada; i++) {
        const { data, error } = await db.from('facturas').insert(fila).select('*').single()
        if (!error) guardada = data
        else if (i === 2)
          return responder(res, 500, {
            error: `La factura SE EMITIÓ en ARCA (N° ${String(pedido.numero).padStart(8, '0')}, CAE ${r.cae}) pero no se pudo guardar en la app: ${error.message}. Avisame con este mensaje.`,
          })
      }
      if (pagoIds.length) {
        const { error: errLink } = await db.from('factura_pagos').insert(pagoIds.map((payment_id) => ({ factura_id: guardada.id, payment_id })))
        if (errLink)
          return responder(res, 500, {
            error: `La factura SE EMITIÓ y se guardó (N° ${String(pedido.numero).padStart(8, '0')}) pero no se pudo marcar qué cobros cubre: ${errLink.message}. Avisame con este mensaje.`,
          })
      }
      return responder(res, 200, { ok: true, factura: guardada })
    }

    // ---- nota de crédito por el total de una factura ----
    if (body.accion === 'nota_credito') {
      const { data: fac } = await db.from('facturas').select('*').eq('id', body.facturaId).maybeSingle()
      if (!fac) return responder(res, 404, { error: 'No encontré esa factura.' })
      if (!NOTA_CREDITO_DE[fac.cbte_tipo]) return responder(res, 400, { error: 'Solo se anulan facturas A o B.' })
      if (fac.ambiente !== ambiente) return responder(res, 400, { error: 'Esa factura es de otro ambiente (pruebas / producción).' })
      const { data: yaAnulada } = await db.from('facturas').select('id').eq('factura_asociada_id', fac.id).limit(1)
      if (yaAnulada && yaAnulada.length) return responder(res, 409, { error: 'Esa factura ya tiene una nota de crédito.' })

      const cbteTipo = NOTA_CREDITO_DE[fac.cbte_tipo]
      const ta = await obtenerTA(db, ambiente)
      const ultimo = await ultimoAutorizado(ta, ambiente, cuit, cfg.punto_venta, cbteTipo)
      const hoy = hoyArgentina()
      const pedido: PedidoComprobante = {
        cuit,
        ptoVta: cfg.punto_venta,
        cbteTipo,
        numero: ultimo + 1,
        fechaArca: hoy.arca,
        totalCents: fac.total_cents,
        receptor: fac.receptor,
        asociado: { tipo: fac.cbte_tipo, ptoVta: fac.punto_venta, numero: Number(fac.numero), cuit },
      }
      const r = await solicitarCAE(ta, ambiente, pedido)
      if (!r.aprobado) return responder(res, 422, { error: `ARCA no aprobó la nota de crédito. ${r.mensaje}`.trim() })
      const { data, error } = await db
        .from('facturas')
        .insert({
          factura_asociada_id: fac.id,
          ambiente,
          cbte_tipo: cbteTipo,
          punto_venta: cfg.punto_venta,
          numero: pedido.numero,
          fecha: hoy.iso,
          cae: r.cae,
          cae_vto: r.caeVto,
          receptor: fac.receptor,
          items: fac.items,
          neto_cents: fac.neto_cents,
          iva_cents: fac.iva_cents,
          total_cents: fac.total_cents,
          observaciones: `Anula la factura ${String(fac.punto_venta).padStart(5, '0')}-${String(fac.numero).padStart(8, '0')}`,
        })
        .select('*')
        .single()
      if (error)
        return responder(res, 500, {
          error: `La nota de crédito SE EMITIÓ en ARCA (N° ${String(pedido.numero).padStart(8, '0')}, CAE ${r.cae}) pero no se pudo guardar: ${error.message}. Avisame con este mensaje.`,
        })
      return responder(res, 200, { ok: true, factura: data })
    }

    return responder(res, 400, { error: 'Acción desconocida.' })
  } catch (e) {
    return responder(res, 500, { error: e instanceof Error ? e.message : 'Error inesperado.' })
  }
}
