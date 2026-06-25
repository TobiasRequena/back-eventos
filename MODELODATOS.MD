# Modelo de Datos — Plataforma de Gestión de Eventos

> Fuente de verdad del esquema. Motor: **PostgreSQL** (hosteado en **Railway**). Migración base: `001_init_schema.sql`. Todas las tablas, columnas y enums están en **español**, en `snake_case`.

## Convenciones generales

- **PKs**: `UUID`, generadas con `gen_random_uuid()` (extensión `pgcrypto`).
- **Multi-tenancy**: la columna `org_id` está **desnormalizada** en prácticamente todas las tablas (no solo en `evento`), aunque técnicamente se podría derivar vía `evento_id → evento.org_id`. Esto es deliberado: permite que el middleware de aislamiento (RNF07) filtre por `org_id` directo en cualquier tabla, sin JOIN. **Toda query de negocio debe filtrar por `org_id`** salvo en las pocas tablas que no lo tienen (`usuario`, `usuario_organizacion`, `usuario_evento` — ver detalle abajo).
- **Timestamps**: `TIMESTAMPTZ`, no `TIMESTAMP`, para evitar ambigüedad de zona horaria.
- **Nombres de archivo de migraciones**: `NNN_descripcion.sql`, prefijo numérico secuencial.

---

## Tablas

### `organizacion`
El tenant de la plataforma (parroquia, diócesis, movimiento pastoral).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `nombre` | VARCHAR(150) | |
| `es_implicita` | BOOLEAN | `TRUE` = organización "de fondo", auto-creada sin que el usuario la haya completado. Mientras sea `TRUE`, **no se debe permitir invitar usuarios** (`usuario_organizacion`) — esa regla se valida en el service, no hay constraint de DB para esto. |
| `configuracion` | JSONB | Libre, para settings futuros sin migración. |
| `estado_facturacion` | VARCHAR(30) | Estado de pago a la plataforma (RN07). |
| `creado_en` | TIMESTAMPTZ | |

**No tiene `cbu_cvu` ni `alias_cobro`** — esos datos viven en `evento`, porque distintos eventos de una misma organización pueden cobrar a cuentas bancarias distintas.

---

### `usuario`
Cuenta real con login. **No tiene `org_id` propio** — la pertenencia a organizaciones es siempre a través de `usuario_organizacion`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `nombre`, `apellido` | VARCHAR | |
| `email` | VARCHAR(255) | `UNIQUE` |
| `contrasena_hash` | VARCHAR(255) | Hashear antes de insertar, nunca texto plano. |
| `es_super_admin` | BOOLEAN | Rol técnico global, sin relación a ninguna organización/evento. Uso operativo del dueño de la plataforma. No confundir con `admin` de `usuario_organizacion`. |
| `activo` | BOOLEAN | |

**No es lo mismo que `acreditador_sesion`** — un acreditador en el día del evento no necesita ser `usuario`.

---

### `usuario_organizacion`
Pertenencia **estable** de un usuario a una organización. Da acceso a *todos* los eventos de esa organización.

| Columna | Tipo | Notas |
|---|---|---|
| `usuario_id` | UUID FK → `usuario` | |
| `org_id` | UUID FK → `organizacion` | |
| `rol` | ENUM `rol_usuario_org` | Hoy solo `admin`. Pensado para crecer. |

`UNIQUE (usuario_id, org_id)` — un usuario no puede tener dos filas para la misma organización.

---

### `usuario_evento`
Invitación **puntual** a un evento de una organización ajena (estilo "compartir una página" en Notion). **No da acceso al resto de esa organización**, solo a ese evento.

| Columna | Tipo | Notas |
|---|---|---|
| `usuario_id` | UUID FK → `usuario` | |
| `evento_id` | UUID FK → `evento` | |
| `rol` | ENUM `rol_usuario_evento` | `lector` (solo ver) \| `editor` (puede modificar inscriptos/pagos/check-ins de ese evento). |

`UNIQUE (usuario_id, evento_id)`.

> ⚠️ **Regla de negocio que vive en el service, no en la DB:** antes de crear una fila acá, hay que validar que el `usuario_id` no tenga ya una fila en `usuario_organizacion` para la organización dueña del evento. Si ya es miembro de la organización, no se debe permitir la invitación puntual — mostrar mensaje tipo *"el usuario ya pertenece a la organización"* en vez de insertar.

---

### `evento`
Entidad principal del sistema.

| Columna | Tipo | Notas |
|---|---|---|
| `org_id` | UUID FK → `organizacion` | `ON DELETE RESTRICT` — no se puede borrar una organización con eventos. |
| `creado_por_usuario_id` | UUID FK → `usuario` | Directo, para no tener que resolver "¿quién creó esto?" vía `organizacion → usuario_organizacion → usuario`. |
| `codigo` | VARCHAR(20) | `UNIQUE`. Código público del evento. |
| `politica_menor` | ENUM `politica_menor_evento` | `obligatorio` \| `opcional` \| `no_aplica`. `no_aplica` **ya cubre** "este evento no usa control de menores" — no hay columna booleana redundante para esto. |
| `tiene_grupos` | BOOLEAN | Si es `FALSE`, el front debe ocultar toda la UI de grupos para este evento. |
| `tiene_talleres` | BOOLEAN | Idem para talleres. |
| `modo_taller` | ENUM `modo_taller_evento` | `paralelos` \| `secuenciales` \| `ninguno`. |
| `cbu_cvu`, `alias_cobro` | VARCHAR | Datos de cobro de **este evento específico** (no de la organización). |
| `costo` | NUMERIC(12,2) | Costo de inscripción al evento (no confundir con el pago de creación de evento a la plataforma, que vive en `pago.tipo = 'creacion_evento'`). |

`CHECK (fecha_fin >= fecha_inicio)`.

---

### `punto_acceso`
Puesto físico de acreditación (sede/puerta). **Estructura provisoria**: en el MVP casi no se usa (puede no poblarse, o tener un solo registro genérico por evento), pero queda lista para cuando V2 distinga links de acreditación por punto de acceso/sede.

| Columna | Tipo | Notas |
|---|---|---|
| `org_id`, `evento_id` | UUID FK | |
| `nombre` | VARCHAR(100) | |

Referenciada (nullable) desde `acreditador_sesion` y `checkin`.

---

### `acreditador_sesion`
Identidad **efímera** de quien acredita el día del evento. **No es `usuario`**: no tiene login, no tiene email, no tiene contraseña. Nace cuando alguien entra al link de acreditación de un evento e ingresa nombre/apellido.

| Columna | Tipo | Notas |
|---|---|---|
| `org_id`, `evento_id` | UUID FK | |
| `punto_acceso_id` | UUID FK, nullable | Casi sin uso en MVP. |
| `nombre`, `apellido` | VARCHAR | Suficiente para trazabilidad (RNF08), no se pide más dato. |

Referenciada desde `checkin.acreditador_id` y `checkin_taller.acreditador_id` — **no desde `usuario`**.

---

### `lugar`
Sede física dentro de un evento. Simple: `org_id`, `evento_id`, `nombre`, `direccion`.

---

### `campo_form`
Campos dinámicos de inscripción, definidos por evento (ej. "talla de remera", "alergias").

| Columna | Tipo | Notas |
|---|---|---|
| `tipo` | ENUM `tipo_campo_form` | `texto` \| `numero` \| `fecha` \| `seleccion` \| `booleano`. |
| `opciones` | JSONB, nullable | Solo se usa si `tipo = 'seleccion'`. |
| `orden` | INTEGER | Orden de despliegue en el formulario. |

Las **respuestas** a estos campos no están en una tabla separada — viven en `participante.respuestas_form` (JSONB), clave = `campo_form.id`.

---

### `grupo`
Grupo de participantes. **Solo aplica si `evento.tiene_grupos = TRUE`.**

| Columna | Tipo | Notas |
|---|---|---|
| `responsable_id` | UUID FK → `participante`, nullable | El responsable de un grupo **es un `participante`, no un `usuario`**. Esta FK se agrega con `ALTER TABLE` después de crear `participante` (referencia circular: `participante.grupo_id → grupo`, `grupo.responsable_id → participante`). |
| `codigo_inv`, `qr_inv` | VARCHAR | Código/QR de invitación al grupo. |
| `max_integrantes` | INTEGER | Definido al crear el grupo (RN05). `CHECK > 0`. |

---

### `participante`
La inscripción de una persona a un evento. **Es la tabla central del dominio operativo.**

| Columna | Tipo | Notas |
|---|---|---|
| `grupo_id` | UUID FK → `grupo`, **nullable** | `NULL` = inscripción individual, sin grupo. Cubre eventos con `tiene_grupos = FALSE` y también inscripciones individuales dentro de eventos que sí tienen grupos. |
| `responsable_id` | UUID FK → `participante` (auto-referencia), **nullable** | El referente/adulto responsable de este participante si es menor vinculado. `NULL` si el evento no usa control de menores (`politica_menor = 'no_aplica'`) o si la persona no tiene referente. |
| `es_mayor` | BOOLEAN | Calculado a partir de `nacimiento` (RN01) y **persistido** (no se recalcula en cada query de control de acceso). |
| `rol_grupo` | ENUM `rol_grupo_participante` | `responsable` \| `integrante` \| `autoinscripto` \| `ninguno`. |
| `estado_vinculo` | ENUM `estado_vinculo_participante`, nullable | `pendiente` \| `aceptado` \| `rechazado` — solo aplica a auto-inscriptos a grupo (RN04) esperando aprobación del referente. Un rechazo **no borra la inscripción al evento**, solo desvincula del grupo (puede volver a vincularse después). |
| `estado_pago` | ENUM `estado_pago_participante` | Default `no_aplica` (eventos sin costo). |
| `pagado_por` | ENUM `pagado_por_participante`, nullable | `individual` \| `grupal` (RN06). |
| `qr_personal` | VARCHAR | `UNIQUE`. Es la clave de búsqueda en el escaneo de acreditación — tiene índice implícito por el `UNIQUE`. |
| `dni` | VARCHAR | `UNIQUE (evento_id, dni)` — no puede haber dos inscripciones con el mismo DNI en el mismo evento. |

**No hay columna de "last seen" cacheada acá.** La última ubicación conocida (RN12.1) se calcula con `MAX(momento)` sobre `checkin_taller` filtrando por `participante_id` — hay un índice (`participante_id, momento DESC`) pensado justo para esa query.

---

### `pago`
Cubre **dos flujos distintos** de la plataforma en una sola tabla:

1. **`tipo = 'creacion_evento'`** (RN07): Organización → Plataforma. Vía pasarela (GalioPay), automático, sin revisión manual. `participante_id` debe ser `NULL`.
2. **`tipo = 'inscripcion'`** (RN08): Participante → Organización. Vía transferencia + comprobante, con revisión manual del Admin. `participante_id` es obligatorio.

| Columna | Tipo | Notas |
|---|---|---|
| `evento_id` | UUID FK → `evento`, `NOT NULL` | Todo pago — sea de inscripción o de creación de evento — está siempre atado a un evento puntual (RN07: el evento se habilita cuando se confirma su pago). |
| `metodo` | ENUM `metodo_pago` | `transferencia` \| `pasarela`. Hay un `CHECK` (`ck_pago_tipo_metodo`) que **fuerza** la combinación correcta: `inscripcion` → siempre `transferencia`; `creacion_evento` → siempre `pasarela`. No es posible insertar la combinación incorrecta. |
| `ref_pasarela` | VARCHAR, nullable | Solo se usa cuando `metodo = 'pasarela'`. |
| `comprobante_url` | VARCHAR, nullable | Solo se usa cuando `metodo = 'transferencia'`. |
| `revisado_por` | UUID FK → `usuario`, nullable | Quién aprobó/rechazó el comprobante. No aplica a pagos por pasarela (se confirman solos). |

---

### `taller`
Solo existe si `evento.tiene_talleres = TRUE`. `CHECK (fin > inicio)`.

---

### `participante_taller`
Tabla de asignación N a N entre `participante` y `taller`. `UNIQUE (participante_id, taller_id)` — no se puede asignar dos veces a lo mismo.

---

### `checkin`
Acreditación general (entrada al evento, no a un taller puntual).

| Columna | Tipo | Notas |
|---|---|---|
| `participante_id` | UUID FK, `UNIQUE` | El `UNIQUE` es **la garantía contra doble acreditación** (RNF02: 4+ acreditadores concurrentes no deben poder acreditar dos veces a la misma persona — la base lo impide a nivel constraint, no solo a nivel aplicación). |
| `acreditador_id` | UUID FK → `acreditador_sesion` | **No** apunta a `usuario`. |
| `punto_acceso_id` | UUID FK, nullable | Reemplaza lo que en el documento original era un string libre `punto_acceso`. |

---

### `checkin_taller`
Entrada a un taller puntual. Solo registra **entrada, no salida** (RN12) — es la base del "last seen".

| Columna | Tipo | Notas |
|---|---|---|
| `UNIQUE (taller_id, participante_id)` | | Impide doble entrada al mismo taller (mismo motivo que en `checkin`: concurrencia de acreditadores). |

---

### `archivo`
Archivos en bucket S3-compatible: imágenes de evento (portada, fondo de formulario) y comprobantes de pago.

| Columna | Tipo | Notas |
|---|---|---|
| `evento_id` | UUID FK → `evento`, nullable | Dueño cuando es imagen de portada / fondo de formulario. |
| `participante_id` | UUID FK → `participante`, nullable | Dueño cuando es el comprobante de pago de esa inscripción. **El comprobante se liga directo al participante, no a `pago`** — si hace falta el pago correspondiente, el service lo resuelve buscando el pago `tipo = 'inscripcion'` de ese participante. |
| `subido_por_usuario_id` | UUID FK → `usuario`, nullable | Quién lo subió, cuando es un usuario con cuenta (ej. el organizador subiendo la portada). |
| `subido_por_participante_id` | UUID FK → `participante`, nullable | El participante puede subir su propio comprobante **sin tener cuenta de usuario**. |
| `key` | VARCHAR(500) | Path/clave del objeto en el bucket S3-compatible. **No es la URL completa** — el front/service la combina con el dominio del bucket para construir la URL final. |
| `nombre_original`, `mime_type`, `size_bytes` | | Metadata del archivo subido. |

> ⚠️ **Importante:** las cuatro FKs (`evento_id`, `participante_id`, `subido_por_usuario_id`, `subido_por_participante_id`) son **independientes y todas nullable**, sin `CHECK` que las cruce. Se admite deliberadamente que un archivo no tenga dueño todavía, o que no se registre quién lo subió — no asumir que "si hay `evento_id` no puede haber `participante_id`" a nivel de constraint; esa coherencia, si se necesita, se valida en el service.
>
> Reemplaza lo que antes eran `evento.imagen_url` y `pago.comprobante_url` como strings sueltos — ahora son filas en `archivo`, consultables con metadata y trazabilidad de quién subió qué.

---



| Enum | Valores | Tabla.columna |
|---|---|---|
| `rol_usuario_org` | `admin` | `usuario_organizacion.rol` |
| `rol_usuario_evento` | `lector`, `editor` | `usuario_evento.rol` |
| `tipo_campo_form` | `texto`, `numero`, `fecha`, `seleccion`, `booleano` | `campo_form.tipo` |
| `politica_menor_evento` | `obligatorio`, `opcional`, `no_aplica` | `evento.politica_menor` |
| `modo_taller_evento` | `paralelos`, `secuenciales`, `ninguno` | `evento.modo_taller` |
| `rol_grupo_participante` | `responsable`, `integrante`, `autoinscripto`, `ninguno` | `participante.rol_grupo` |
| `estado_vinculo_participante` | `pendiente`, `aceptado`, `rechazado` | `participante.estado_vinculo` |
| `estado_pago_participante` | `no_aplica`, `pendiente`, `aprobado`, `rechazado` | `participante.estado_pago` |
| `pagado_por_participante` | `individual`, `grupal` | `participante.pagado_por` |
| `tipo_pago` | `creacion_evento`, `inscripcion` | `pago.tipo` |
| `metodo_pago` | `transferencia`, `pasarela` | `pago.metodo` |
| `estado_pago_registro` | `pendiente`, `aprobado`, `rechazado` | `pago.estado` |

---

## Reglas de negocio que NO están en la base (viven en el service)

Estas decisiones se tomaron deliberadamente fuera de la DB porque dependen de lógica que SQL no expresa limpio (cruces entre tablas con condición de negocio, no solo unicidad):

1. **No invitar a `usuario_evento` si ya es miembro de `usuario_organizacion`** de la organización dueña del evento — validar antes del INSERT, mostrar error al usuario en vez de bloquear con constraint.
2. **No permitir invitaciones (`usuario_organizacion`) mientras `organizacion.es_implicita = TRUE`** — forzar a "completar" la organización primero.
3. **Primer evento de una organización es gratis** (RN07) — se determina contando filas existentes en `evento` para ese `org_id` antes de crear el pago de tipo `creacion_evento`; no hay columna ni constraint que lo marque.
4. **Auto-inscripción a grupo y aprobación del referente** (RN04): el cambio de `estado_vinculo` de `pendiente` a `aceptado`/`rechazado` lo hace el responsable del grupo desde su panel — es un UPDATE de aplicación, no un trigger.

---

## Índices — motivación (no solo lista)

Todos están en la migración `001_init_schema.sql`. Los criterios usados:

- **`org_id` indexado en cada tabla hija de evento**: toda query de negocio filtra por tenant primero (RNF07).
- **`qr_personal` y `codigo` (evento) ya son `UNIQUE`**, por lo que ya tienen índice implícito — clave para el escaneo de QR en <1-2s con eventos de 15.000+ inscriptos (RNF01/RNF03).
- **`checkin_taller(participante_id, momento DESC)`**: pensado específicamente para la query de "last seen" (RN12.1, ubicar referente ante emergencia) — sin este índice, esa búsqueda escanearía toda la tabla por evento grande.
- **Índices parciales** (`WHERE estado = 'pendiente'`) en `pago` y `participante.estado_vinculo`: las pantallas de revisión de Admin filtran casi siempre por el estado pendiente, no por toda la tabla.

---

## Lo que falta para V2 (fuera de alcance de esta migración)

- Integración real de pasarela de pago para inscripciones (hoy `metodo_pago` solo tiene `transferencia` para ese flujo).
- Población real de `punto_acceso` con links de acreditación diferenciados por punto.
- PWA offline (RNF10) — implica una estrategia de sincronización que esta migración no contempla todavía.
- Builder de lógica condicional en `campo_form` (hoy es lineal, sin dependencias entre campos).