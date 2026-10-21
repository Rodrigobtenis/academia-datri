// Lectura del CSV de ventas que exporta Tiendup. El archivo suele venir en Windows-1252
// (con acentos rotos si se lee como UTF-8), así que se prueba UTF-8 estricto y, si falla,
// se decodifica como Windows-1252.

export interface TiendupSale {
  key: string;
  orderNumber: string;
  paymentDate: string; // YYYY-MM-DD (fecha de la venta, hora de Argentina)
  createdAt: string; // ISO con offset -03:00
  currency: string;
  totalAmount: number;
  paymentStatus: string;
  paymentMethod: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  isPaid: boolean;
}

export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  return text.replace(/^﻿/, "");
}

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

function parseNumber(raw: string): number {
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// "20/10/2026 21:33:41" -> { date: "2026-10-20", iso: "2026-10-20T21:33:41-03:00" }
function parseDateTime(raw: string): { date: string; iso: string } | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, d, mo, y, h = "0", mi = "0", s = "0"] = m;
  const pad = (v: string) => v.padStart(2, "0");
  const date = `${y}-${pad(mo)}-${pad(d)}`;
  return { date, iso: `${date}T${pad(h)}:${pad(mi)}:${pad(s)}-03:00` };
}

const REQUIRED = [
  "numero",
  "fecha de creacion",
  "estado del pago",
  "nombre",
  "apellido",
  "email",
  "producto: nombre",
  "producto: precio",
];

// Algunos exports vienen con cada línea completa envuelta entre comillas (una sola celda con
// las comas adentro): en ese caso se vuelve a leer cada celda como una fila.
function unwrapRows(rows: string[][]): string[][] {
  if (rows.length === 0 || !rows.every((r) => r.length === 1 && /[,;]/.test(r[0]))) return rows;
  return rows.map((r) => parseCsv(r[0])[0] ?? []);
}

export function parseTiendupCsv(text: string): { sales: TiendupSale[]; error?: string } {
  const rows = unwrapRows(parseCsv(text));
  if (rows.length < 2) return { sales: [], error: "El archivo no tiene ventas." };

  const header = rows[0].map(normalizeHeader);
  const idx = (name: string) => header.indexOf(name);
  const missing = REQUIRED.filter((c) => idx(c) < 0);
  if (missing.length > 0) {
    return { sales: [], error: `No parece un export de ventas de Tiendup (faltan columnas: ${missing.join(", ")}).` };
  }

  const get = (row: string[], name: string) => (idx(name) >= 0 ? (row[idx(name)] ?? "").trim() : "");

  const sales: TiendupSale[] = [];
  let last: TiendupSale | null = null;

  for (const row of rows.slice(1)) {
    const orderNumber = get(row, "numero");
    const productName = get(row, "producto: nombre");
    if (!productName) continue;

    // Un pedido con varios productos repite el número (y a veces deja vacíos los datos del
    // comprador en las filas siguientes): en ese caso se heredan de la fila anterior.
    const prev = !orderNumber ? last : null;
    const dt = parseDateTime(get(row, "fecha de creacion")) ?? (prev ? { date: prev.paymentDate, iso: prev.createdAt } : null);
    if (!dt) continue;

    const totalRaw = get(row, "monto total");
    const sale: TiendupSale = {
      key: `${orderNumber || prev?.orderNumber || "s"}-${sales.length}`,
      orderNumber: orderNumber || prev?.orderNumber || "",
      paymentDate: dt.date,
      createdAt: dt.iso,
      currency: (get(row, "moneda") || prev?.currency || "ARS").toUpperCase(),
      totalAmount: totalRaw ? parseNumber(totalRaw) : (prev?.totalAmount ?? 0),
      paymentStatus: get(row, "estado del pago") || prev?.paymentStatus || "",
      paymentMethod: get(row, "medio de pago") || prev?.paymentMethod || "",
      firstName: get(row, "nombre") || prev?.firstName || "",
      lastName: get(row, "apellido") || prev?.lastName || "",
      email: get(row, "email") || prev?.email || "",
      phone: get(row, "telefono") || prev?.phone || "",
      productName,
      quantity: Math.max(1, Math.round(parseNumber(get(row, "producto: cantidad")) || 1)),
      unitPrice: parseNumber(get(row, "producto: precio")),
      isPaid: false,
    };
    sale.isPaid = normalizeHeader(sale.paymentStatus) === "pagado";
    sales.push(sale);
    last = sale;
  }

  if (sales.length === 0) return { sales: [], error: "No encontré ventas en el archivo." };
  return { sales };
}
