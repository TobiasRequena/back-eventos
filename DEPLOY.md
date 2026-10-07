# Deploy

Back en **Render**, front en **Vercel**, bases en **Railway**.

## Ramas

`dev` → `main` (QA) → `production`. Siempre en ese orden, en los dos repos (back-eventos y front-eventos).

## Base de datos: qué falta subir

Los cambios de base son los archivos de `sql/` (idempotentes, se corren a mano).

- [ESQUEMA_DESARROLLO.md](ESQUEMA_DESARROLLO.md): cómo está la base de desarrollo.
- [ESQUEMA_PRODUCCION.md](ESQUEMA_PRODUCCION.md): cómo está la base de producción.

Los dos se generan desde la base real (no se editan a mano). La diferencia entre ambos es lo que falta correr en producción:

```bash
node scripts/generar_esquema.js "<URL base desarrollo>" desarrollo
node scripts/generar_esquema.js "<URL base produccion>" produccion
git diff --no-index ESQUEMA_PRODUCCION.md ESQUEMA_DESARROLLO.md
```

Regenerar `ESQUEMA_DESARROLLO.md` cada vez que se corre un SQL en desarrollo, y `ESQUEMA_PRODUCCION.md` cada vez que se sube a producción.

## Pasos para subir a producción

1. Mergear `dev` → `main` y probar en QA.
2. Correr en la base de producción los `sql/` que falten (ver la diferencia de arriba). **Antes** que el código: el back nuevo ya usa las tablas nuevas.
3. Mergear `main` → `production` en back y front (Render y Vercel deployan solos).
4. Regenerar `ESQUEMA_PRODUCCION.md` y commitearlo.

## Tali (asistente IA)

Va apagado salvo que se prenda con variables. En producción **no** se ponen: queda sin ruta en el back y sin widget en el front.

| Dónde | Variable | Valor para prenderlo |
|---|---|---|
| Render (back) | `TALI_ACTIVO` | `true` |
| Render (back) | `ANTHROPIC_API_KEY` | la key de Anthropic |
| Vercel (front) | `VITE_TALI_ACTIVO` | `true` |

La variable del front se lee al buildear: después de cambiarla hay que hacer **Redeploy** en Vercel.

## Variables de Render (back)

Render → el servicio → **Environment** → **Add from .env** → pegar el bloque y completar los valores → **Save, rebuild and deploy**.

Producción:

```env
NODE_ENV=production
PORT=3001

# Base (Railway → Postgres → Variables)
DB_HOST=
DB_PORT=
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=
DB_SSL=true

# URLs (sin "/" al final)
FRONTEND_URL=https://<dominio del front>
FRONTEND_URL_PRUEBA=
BACKEND_URL=https://<dominio del back en Render>

# Auth
JWT_SECRET=
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=
SUPERADMIN_EMAIL=

# Mails (Resend)
RESEND_API_KEY=
MAIL_FROM1=

# Archivos (S3 compatible)
S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_PUBLIC_URL=

# Pagos (GalioPay)
GALIOPAY_CLIENT_ID=
GALIOPAY_API_KEY=
GALIOPAY_SANDBOX=false
```

Desarrollo / QA: el mismo bloque con la base de desarrollo, sus URLs, `GALIOPAY_SANDBOX=true`, y además:

```env
TALI_ACTIVO=true
ANTHROPIC_API_KEY=
```

Notas:
- `ENCRYPTION_KEY` tiene que ser **la misma** que ya usa cada entorno: si cambia, no se pueden leer los datos encriptados que ya están guardados.
- `FRONTEND_URL` y `FRONTEND_URL_PRUEBA` son los orígenes permitidos por CORS. `FRONTEND_URL` además arma los links de los mails.

## Variables de Vercel (front)

Vercel → el proyecto → **Settings** → **Environment Variables** → pegar el bloque (Vercel lo separa solo) → elegir el entorno → **Save** → **Redeploy**.

Entorno **Production** (rama `production`):

```env
VITE_API_URL=https://<dominio del back en Render>/api/v1
VITE_API_URL_FRONT=https://<dominio del front>
```

Entorno **Preview** (ramas `main` / `dev`):

```env
VITE_API_URL=https://<dominio del back de QA en Render>/api/v1
VITE_API_URL_FRONT=https://<dominio del front de QA>
VITE_TALI_ACTIVO=true
```
