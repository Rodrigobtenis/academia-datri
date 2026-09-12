# Academia Datri

App de gestión integral para Academia Datri (alumnas, cursos, inscripciones, pagos,
comisiones, objetivos, CRM, y el panel privado de Gestión). React + Vite + TS +
Tailwind + Supabase.

## Desarrollo local (sin Supabase todavía)

```bash
npm install
npm run dev
```

La app levanta y navega, pero sin `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
el login no funciona — eso es normal mientras construimos en local.

## Cuando toque pasar a la nube (vos hacés esto, no yo)

1. Creá un proyecto nuevo en tu cuenta de Supabase (ej. `academia-datri`).
2. `supabase/migrations/0001_init.sql` → pegar y correr en el SQL Editor.
3. `supabase/migrations/0002_rls.sql` → pegar y correr después.
4. Authentication > Users > **Add user** con tu email (vos, Admin) y una contraseña.
5. Editar `supabase/bootstrap.sql` con tu email real y correrlo (te promueve a `admin`;
   sin esto quedás con rol `empleada` por defecto).
6. Copiar `.env.example` a `.env.local` y completar con la URL y la anon key del proyecto
   (Project Settings > API).
7. Deploy en Vercel: importar el repo, Framework = Vite, y cargar las mismas 2 variables
   de entorno en el dashboard de Vercel.

Cuando falta correr una migración nueva, se avisa en el chat con el nombre exacto del
archivo — se corren siempre en orden numérico.
