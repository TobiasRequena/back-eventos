# Esquema actual de la base (actualizado a mano — 2026-09-15, feature costo por zona)

## `acreditador_sesion`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| punto_acceso_id | uuid | YES |  |
| nombre | character varying(100) | NO |  |
| apellido | character varying(100) | NO |  |
| creado_en | timestamp with time zone | NO | now() |

**PK**: id

**FKs**:
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`
- `punto_acceso_id` → `punto_acceso.id`

**Índices**:
- `acreditador_sesion_pkey`: `CREATE UNIQUE INDEX acreditador_sesion_pkey ON public.acreditador_sesion USING btree (id)`
- `idx_acreditador_sesion_org_evento`: `CREATE INDEX idx_acreditador_sesion_org_evento ON public.acreditador_sesion USING btree (org_id, evento_id)`

## `archivo`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | YES |  |
| participante_id | uuid | YES |  |
| subido_por_usuario_id | uuid | YES |  |
| subido_por_participante_id | uuid | YES |  |
| key | character varying(500) | NO |  |
| nombre_original | character varying(255) | NO |  |
| mime_type | character varying(100) | NO |  |
| size_bytes | integer | NO |  |
| creado_en | timestamp with time zone | NO | now() |

**PK**: id

**FKs**:
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`
- `participante_id` → `participante.id`
- `subido_por_participante_id` → `participante.id`
- `subido_por_usuario_id` → `usuario.id`

**Índices**:
- `archivo_pkey`: `CREATE UNIQUE INDEX archivo_pkey ON public.archivo USING btree (id)`
- `idx_archivo_evento`: `CREATE INDEX idx_archivo_evento ON public.archivo USING btree (evento_id) WHERE (evento_id IS NOT NULL)`
- `idx_archivo_org`: `CREATE INDEX idx_archivo_org ON public.archivo USING btree (org_id)`
- `idx_archivo_participante`: `CREATE INDEX idx_archivo_participante ON public.archivo USING btree (participante_id) WHERE (participante_id IS NOT NULL)`

## `bloque_taller`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| nombre | character varying(150) | NO |  |
| cantidad_elegible | integer | NO |  |
| es_obligatorio | boolean | NO | false |
| orden | integer | NO | 0 |
| creado_en | timestamp with time zone | NO | now() |
| inicio | timestamp with time zone | YES |  |
| fin | timestamp with time zone | YES |  |

**PK**: id

**FKs**:
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`

**Índices**:
- `bloque_taller_pkey`: `CREATE UNIQUE INDEX bloque_taller_pkey ON public.bloque_taller USING btree (id)`
- `idx_bloque_taller_evento_id`: `CREATE INDEX idx_bloque_taller_evento_id ON public.bloque_taller USING btree (evento_id)`
- `idx_bloque_taller_org_id`: `CREATE INDEX idx_bloque_taller_org_id ON public.bloque_taller USING btree (org_id)`

## `campo_form`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| etiqueta | character varying(150) | NO |  |
| tipo | tipo_campo_form | NO |  |
| opciones | jsonb | YES |  |
| requerido | boolean | NO | false |
| orden | integer | NO | 0 |

**PK**: id

**FKs**:
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`

**Índices**:
- `campo_form_pkey`: `CREATE UNIQUE INDEX campo_form_pkey ON public.campo_form USING btree (id)`
- `idx_campo_form_org_evento`: `CREATE INDEX idx_campo_form_org_evento ON public.campo_form USING btree (org_id, evento_id)`

## `checkin`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| participante_id | uuid | NO |  |
| acreditador_id | uuid | YES |  |
| punto_acceso_id | uuid | YES |  |
| momento | timestamp with time zone | NO | now() |

**PK**: id

**FKs**:
- `acreditador_id` → `acreditador_sesion.id`
- `org_id` → `organizacion.id`
- `participante_id` → `participante.id`
- `punto_acceso_id` → `punto_acceso.id`

**Índices**:
- `checkin_pkey`: `CREATE UNIQUE INDEX checkin_pkey ON public.checkin USING btree (id)`
- `uq_checkin_participante`: `CREATE UNIQUE INDEX uq_checkin_participante ON public.checkin USING btree (participante_id)`
- `idx_checkin_org`: `CREATE INDEX idx_checkin_org ON public.checkin USING btree (org_id)`

## `checkin_taller`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| taller_id | uuid | NO |  |
| participante_id | uuid | NO |  |
| acreditador_id | uuid | YES |  |
| momento | timestamp with time zone | NO | now() |

**PK**: id

**FKs**:
- `acreditador_id` → `acreditador_sesion.id`
- `org_id` → `organizacion.id`
- `participante_id` → `participante.id`
- `taller_id` → `taller.id`

**Índices**:
- `checkin_taller_pkey`: `CREATE UNIQUE INDEX checkin_taller_pkey ON public.checkin_taller USING btree (id)`
- `uq_checkin_taller`: `CREATE UNIQUE INDEX uq_checkin_taller ON public.checkin_taller USING btree (taller_id, participante_id)`
- `idx_checkin_taller_org`: `CREATE INDEX idx_checkin_taller_org ON public.checkin_taller USING btree (org_id)`
- `idx_checkin_taller_participante_momento`: `CREATE INDEX idx_checkin_taller_participante_momento ON public.checkin_taller USING btree (participante_id, momento DESC)`

## `comunicacion`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| creado_por_usuario_id | uuid | NO |  |
| asunto | character varying(200) | NO |  |
| mensaje | text | NO |  |
| destinatarios | character varying(30) | NO |  |
| filtros | jsonb | YES |  |
| adjuntos | jsonb | YES |  |
| total_enviados | integer | YES |  |
| estado | character varying(20) | NO | 'enviando'::character varying |
| creado_en | timestamp with time zone | NO | now() |

**PK**: id

**FKs**:
- `org_id` → `organizacion.id`
- `evento_id` → `evento.id`
- `creado_por_usuario_id` → `usuario.id`

**Índices**:
- `comunicacion_pkey`: `CREATE UNIQUE INDEX comunicacion_pkey ON public.comunicacion USING btree (id)`
- `idx_comunicacion_evento`: `CREATE INDEX idx_comunicacion_evento ON public.comunicacion USING btree (evento_id)`

## `contacto_emergencia`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| participante_id | uuid | NO |  |
| nombre | character varying(150) | NO |  |
| telefono | character varying(30) | NO |  |
| parentesco | character varying(100) | YES |  |
| creado_en | timestamp with time zone | NO | now() |
| actualizado_en | timestamp with time zone | NO | now() |

**PK**: id

**FKs**:
- `evento_id` → `evento.id` (ON DELETE CASCADE)
- `org_id` → `organizacion.id`
- `participante_id` → `participante.id` (ON DELETE CASCADE)

**Índices**:
- `contacto_emergencia_pkey`: `CREATE UNIQUE INDEX contacto_emergencia_pkey ON public.contacto_emergencia USING btree (id)`
- `contacto_emergencia_participante_id_evento_id_key`: `CREATE UNIQUE INDEX contacto_emergencia_participante_id_evento_id_key ON public.contacto_emergencia USING btree (participante_id, evento_id)`
- `idx_contacto_emergencia_evento`: `CREATE INDEX idx_contacto_emergencia_evento ON public.contacto_emergencia USING btree (evento_id)`
- `idx_contacto_emergencia_participante`: `CREATE INDEX idx_contacto_emergencia_participante ON public.contacto_emergencia USING btree (participante_id)`

## `esquema_grupos_trabajo`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| nombre | character varying(150) | NO |  |
| universo_base | universo_base_esquema | NO | 'acreditados'::universo_base_esquema |
| criterio_tanda_atributo | jsonb | YES |  |
| modo_tamano | modo_tamano_esquema | NO |  |
| valor_tamano | integer | NO |  |
| balanceo_atributo | jsonb | YES |  |
| filtro_elegibilidad | jsonb | YES |  |
| modo_nombrado | modo_nombrado_esquema | NO | 'por_grupo'::modo_nombrado_esquema |
| accion_sin_nombres | accion_sin_nombres_esquema | NO | 'reciclar_numerado'::accion_sin_nombres_esquema |
| nombres_preset | character varying(30) | NO | 'letras'::character varying |
| nombres_lista | jsonb | NO | '[]'::jsonb |
| estado | estado_esquema_grupos | NO | 'borrador'::estado_esquema_grupos |
| generado_en | timestamp with time zone | YES |  |
| creado_por_usuario_id | uuid | NO |  |
| creado_en | timestamp with time zone | NO | now() |
| mantener_grupos_inscripcion | boolean | NO | false |

**PK**: id

**FKs**:
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`
- `creado_por_usuario_id` → `usuario.id`

**Índices**:
- `esquema_grupos_trabajo_pkey`: `CREATE UNIQUE INDEX esquema_grupos_trabajo_pkey ON public.esquema_grupos_trabajo USING btree (id)`
- `idx_esquema_grupos_trabajo_evento_id`: `CREATE INDEX idx_esquema_grupos_trabajo_evento_id ON public.esquema_grupos_trabajo USING btree (evento_id)`
- `idx_esquema_grupos_trabajo_org_id`: `CREATE INDEX idx_esquema_grupos_trabajo_org_id ON public.esquema_grupos_trabajo USING btree (org_id)`

## `evento`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| creado_por_usuario_id | uuid | NO |  |
| nombre | character varying(150) | NO |  |
| descripcion | text | YES |  |
| fecha_inicio | timestamp with time zone | NO |  |
| fecha_fin | timestamp with time zone | NO |  |
| imagen_url | character varying(500) | YES |  |
| costo | numeric | NO | 0 |
| codigo | character varying(20) | NO |  |
| qr_url | character varying(500) | YES |  |
| politica_menor | politica_menor_evento | NO | 'no_aplica'::politica_menor_evento |
| tiene_grupos | boolean | NO | false |
| max_grupo | integer | YES |  |
| tiene_talleres | boolean | NO | false |
| tiene_precio_por_zona | boolean | NO | false |
| modo_taller | modo_taller_evento | NO | 'ninguno'::modo_taller_evento |
| cbu_cvu | character varying(50) | YES |  |
| alias_cobro | character varying(50) | YES |  |
| creado_en | timestamp with time zone | NO | now() |
| actualizado_en | timestamp with time zone | NO | now() |
| inscripciones_cerradas | boolean | NO | false |
| participantes_facturados | integer | NO | 0 |
| cupo_maximo | integer | YES |  |
| config_ficha_medica | config_ficha_medica | NO | 'no'::config_ficha_medica |
| config_certificado | config_certificado | NO | 'no'::config_certificado |
| autorizacion_template_url | character varying(500) | YES |  |
| requiere_autorizacion_menores | boolean | NO | false |
| solicita_contacto_emergencia | boolean | NO | false |

**PK**: id

**FKs**:
- `org_id` → `organizacion.id`
- `creado_por_usuario_id` → `usuario.id`

**Índices**:
- `evento_pkey`: `CREATE UNIQUE INDEX evento_pkey ON public.evento USING btree (id)`
- `idx_evento_codigo`: `CREATE INDEX idx_evento_codigo ON public.evento USING btree (codigo)`
- `idx_evento_creado_por`: `CREATE INDEX idx_evento_creado_por ON public.evento USING btree (creado_por_usuario_id)`
- `idx_evento_org`: `CREATE INDEX idx_evento_org ON public.evento USING btree (org_id)`

## `ficha_medica`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| participante_id | uuid | NO |  |
| obra_social | character varying(200) | YES |  |
| tipo_sangre | tipo_sangre | YES |  |
| tiene_diabetes | boolean | NO | false |
| tiene_asma | boolean | NO | false |
| tiene_epilepsia | boolean | NO | false |
| tiene_cardiopatia | boolean | NO | false |
| otras_condiciones | text | YES |  |
| alergias | text | YES |  |
| restricciones_alimentarias | text | YES |  |
| medicacion | jsonb | YES |  |
| tiene_discapacidad | boolean | NO | false |
| adaptaciones | jsonb | YES |  |
| recomendaciones | text | YES |  |
| creado_en | timestamp with time zone | NO | now() |
| actualizado_en | timestamp with time zone | NO | now() |

**PK**: id

**FKs**:
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`
- `participante_id` → `participante.id`

**Índices**:
- `ficha_medica_participante_id_evento_id_key`: `CREATE UNIQUE INDEX ficha_medica_participante_id_evento_id_key ON public.ficha_medica USING btree (participante_id, evento_id)`
- `ficha_medica_pkey`: `CREATE UNIQUE INDEX ficha_medica_pkey ON public.ficha_medica USING btree (id)`
- `idx_ficha_medica_evento`: `CREATE INDEX idx_ficha_medica_evento ON public.ficha_medica USING btree (evento_id)`
- `idx_ficha_medica_participante`: `CREATE INDEX idx_ficha_medica_participante ON public.ficha_medica USING btree (participante_id)`

## `grupo`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| responsable_id | uuid | YES |  |
| nombre | character varying(150) | NO |  |
| parroquia | character varying(150) | YES |  |
| localidad | character varying(150) | YES |  |
| codigo_inv | character varying(20) | NO |  |
| qr_inv | character varying(500) | YES |  |
| max_integrantes | integer | YES |  |

**PK**: id

**FKs**:
- `responsable_id` → `participante.id`
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`

**Índices**:
- `grupo_pkey`: `CREATE UNIQUE INDEX grupo_pkey ON public.grupo USING btree (id)`
- `idx_grupo_org_evento`: `CREATE INDEX idx_grupo_org_evento ON public.grupo USING btree (org_id, evento_id)`

## `grupo_trabajo`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| esquema_id | uuid | NO |  |
| tanda_id | uuid | YES |  |
| nombre | character varying(100) | NO |  |
| orden_global | integer | NO |  |

**PK**: id

**FKs**:
- `esquema_id` → `esquema_grupos_trabajo.id`
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`
- `tanda_id` → `tanda.id`

**Índices**:
- `grupo_trabajo_pkey`: `CREATE UNIQUE INDEX grupo_trabajo_pkey ON public.grupo_trabajo USING btree (id)`
- `idx_grupo_trabajo_esquema_id`: `CREATE INDEX idx_grupo_trabajo_esquema_id ON public.grupo_trabajo USING btree (esquema_id)`

## `grupo_trabajo_participante`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| grupo_trabajo_id | uuid | NO |  |
| participante_id | uuid | NO |  |

**PK**: id

**FKs**:
- `grupo_trabajo_id` → `grupo_trabajo.id`
- `participante_id` → `participante.id`

**Índices**:
- `grupo_trabajo_participante_grupo_trabajo_id_participante_id_key`: `CREATE UNIQUE INDEX grupo_trabajo_participante_grupo_trabajo_id_participante_id_key ON public.grupo_trabajo_participante USING btree (grupo_trabajo_id, participante_id)`
- `grupo_trabajo_participante_pkey`: `CREATE UNIQUE INDEX grupo_trabajo_participante_pkey ON public.grupo_trabajo_participante USING btree (id)`
- `idx_grupo_trabajo_participante_grupo`: `CREATE INDEX idx_grupo_trabajo_participante_grupo ON public.grupo_trabajo_participante USING btree (grupo_trabajo_id)`
- `idx_grupo_trabajo_participante_participante`: `CREATE INDEX idx_grupo_trabajo_participante_participante ON public.grupo_trabajo_participante USING btree (participante_id)`

## `knex_migrations`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | integer | NO | nextval('knex_migrations_id_seq'::regclass) |
| name | character varying(255) | YES |  |
| batch | integer | YES |  |
| migration_time | timestamp with time zone | YES |  |

**PK**: id

**Índices**:
- `knex_migrations_pkey`: `CREATE UNIQUE INDEX knex_migrations_pkey ON public.knex_migrations USING btree (id)`

## `knex_migrations_lock`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| index | integer | NO | nextval('knex_migrations_lock_index_seq'::regclass) |
| is_locked | integer | YES |  |

**PK**: index

**Índices**:
- `knex_migrations_lock_pkey`: `CREATE UNIQUE INDEX knex_migrations_lock_pkey ON public.knex_migrations_lock USING btree (index)`

## `lugar`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| nombre | character varying(150) | NO |  |
| direccion | character varying(255) | YES |  |

**PK**: id

**FKs**:
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`

**Índices**:
- `lugar_pkey`: `CREATE UNIQUE INDEX lugar_pkey ON public.lugar USING btree (id)`
- `idx_lugar_org_evento`: `CREATE INDEX idx_lugar_org_evento ON public.lugar USING btree (org_id, evento_id)`

## `organizacion`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| nombre | character varying(150) | NO |  |
| es_implicita | boolean | NO | false |
| configuracion | jsonb | NO | '{}'::jsonb |
| estado_facturacion | character varying(30) | NO | 'al_dia'::character varying |
| creado_en | timestamp with time zone | NO | now() |
| sitio_web | character varying(255) | SÍ |  |
| instagram | character varying(30) | SÍ |  |
| twitter | character varying(15) | SÍ |  |
| facebook | character varying(50) | SÍ |  |

**PK**: id

**Índices**:
- `organizacion_pkey`: `CREATE UNIQUE INDEX organizacion_pkey ON public.organizacion USING btree (id)`

## `pago`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| participante_id | uuid | YES |  |
| tipo | tipo_pago | NO |  |
| monto | numeric | NO |  |
| metodo | metodo_pago | NO |  |
| comprobante_url | character varying(500) | YES |  |
| ref_pasarela | character varying(150) | YES |  |
| estado | estado_pago_registro | NO | 'pendiente'::estado_pago_registro |
| revisado_por | uuid | YES |  |
| revisado_en | timestamp with time zone | YES |  |
| creado_en | timestamp with time zone | NO | now() |
| notificado_urgente | boolean | NO | false |
| link_pago | character varying(500) | YES |  |
| tramo_id | uuid | YES |  |

**PK**: id

**FKs**:
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`
- `participante_id` → `participante.id`
- `revisado_por` → `usuario.id`
- `tramo_id` → `tramo_precio_plataforma.id`

**Índices**:
- `pago_pkey`: `CREATE UNIQUE INDEX pago_pkey ON public.pago USING btree (id)`
- `idx_pago_estado`: `CREATE INDEX idx_pago_estado ON public.pago USING btree (estado) WHERE (estado = 'pendiente'::estado_pago_registro)`
- `idx_pago_org_evento`: `CREATE INDEX idx_pago_org_evento ON public.pago USING btree (org_id, evento_id)`
- `idx_pago_participante`: `CREATE INDEX idx_pago_participante ON public.pago USING btree (participante_id)`

## `participante`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| grupo_id | uuid | YES |  |
| zona_costo_id | uuid | YES |  |
| nombre | character varying(100) | NO |  |
| apellido | character varying(100) | NO |  |
| email | character varying(255) | YES |  |
| dni | character varying(500) | NO |  |
| nacimiento | date | NO |  |
| es_mayor | boolean | NO |  |
| rol_grupo | rol_grupo_participante | NO | 'ninguno'::rol_grupo_participante |
| estado_vinculo | estado_vinculo_participante | YES |  |
| responsable_id | uuid | YES |  |
| respuestas_form | jsonb | NO | '{}'::jsonb |
| estado_pago | estado_pago_participante | NO | 'no_aplica'::estado_pago_participante |
| pagado_por | pagado_por_participante | YES |  |
| qr_personal | character varying(500) | NO |  |
| creado_en | timestamp with time zone | NO | now() |
| actualizado_en | timestamp with time zone | NO | now() |
| dni_hash | character varying(64) | YES |  |
| activo | boolean | NO | true |
| eliminado_en | timestamp with time zone | YES |  |
| estado_alta_plataforma | estado_alta_plataforma_participante | NO | 'confirmado'::estado_alta_plataforma_participante |
| autorizacion_url | character varying(500) | YES |  |
| certificado_url | character varying(500) | YES |  |

**PK**: id

**FKs**:
- `evento_id` → `evento.id`
- `grupo_id` → `grupo.id`
- `org_id` → `organizacion.id`
- `responsable_id` → `participante.id`
- `zona_costo_id` → `zona_costo.id` (ON DELETE SET NULL)

**Índices**:
- `participante_pkey`: `CREATE UNIQUE INDEX participante_pkey ON public.participante USING btree (id)`
- `uq_participante_dni_evento`: `CREATE UNIQUE INDEX uq_participante_dni_evento ON public.participante USING btree (evento_id, dni)`
- `uq_participante_qr`: `CREATE UNIQUE INDEX uq_participante_qr ON public.participante USING btree (qr_personal)`
- `idx_participante_dni_hash`: `CREATE INDEX idx_participante_dni_hash ON public.participante USING btree (dni_hash, evento_id)`
- `idx_participante_estado_vinculo`: `CREATE INDEX idx_participante_estado_vinculo ON public.participante USING btree (estado_vinculo) WHERE (estado_vinculo = 'pendiente'::estado_vinculo_participante)`
- `idx_participante_grupo`: `CREATE INDEX idx_participante_grupo ON public.participante USING btree (grupo_id)`
- `idx_participante_org_evento`: `CREATE INDEX idx_participante_org_evento ON public.participante USING btree (org_id, evento_id)`
- `idx_participante_responsable`: `CREATE INDEX idx_participante_responsable ON public.participante USING btree (responsable_id)`

## `participante_esquema_pendiente`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| esquema_id | uuid | NO |  |
| participante_id | uuid | NO |  |
| motivo | motivo_pendiente_esquema | NO |  |

**PK**: id

**FKs**:
- `esquema_id` → `esquema_grupos_trabajo.id`
- `participante_id` → `participante.id`

**Índices**:
- `participante_esquema_pendiente_esquema_id_participante_id_key`: `CREATE UNIQUE INDEX participante_esquema_pendiente_esquema_id_participante_id_key ON public.participante_esquema_pendiente USING btree (esquema_id, participante_id)`
- `participante_esquema_pendiente_pkey`: `CREATE UNIQUE INDEX participante_esquema_pendiente_pkey ON public.participante_esquema_pendiente USING btree (id)`
- `idx_participante_esquema_pendiente_esquema`: `CREATE INDEX idx_participante_esquema_pendiente_esquema ON public.participante_esquema_pendiente USING btree (esquema_id)`

## `participante_taller`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| participante_id | uuid | NO |  |
| taller_id | uuid | NO |  |

**PK**: id

**FKs**:
- `org_id` → `organizacion.id`
- `participante_id` → `participante.id`
- `taller_id` → `taller.id`

**Índices**:
- `participante_taller_pkey`: `CREATE UNIQUE INDEX participante_taller_pkey ON public.participante_taller USING btree (id)`
- `uq_participante_taller`: `CREATE UNIQUE INDEX uq_participante_taller ON public.participante_taller USING btree (participante_id, taller_id)`
- `idx_participante_taller_participante`: `CREATE INDEX idx_participante_taller_participante ON public.participante_taller USING btree (participante_id)`
- `idx_participante_taller_taller`: `CREATE INDEX idx_participante_taller_taller ON public.participante_taller USING btree (taller_id)`

## `punto_acceso`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| nombre | character varying(100) | NO |  |
| creado_en | timestamp with time zone | NO | now() |

**PK**: id

**FKs**:
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`

**Índices**:
- `punto_acceso_pkey`: `CREATE UNIQUE INDEX punto_acceso_pkey ON public.punto_acceso USING btree (id)`
- `idx_punto_acceso_org_evento`: `CREATE INDEX idx_punto_acceso_org_evento ON public.punto_acceso USING btree (org_id, evento_id)`

## `reset_password_token`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| usuario_id | uuid | NO |  |
| token | character varying(64) | NO |  |
| expira_en | timestamp with time zone | NO |  |
| usado | boolean | NO | false |
| creado_en | timestamp with time zone | NO | now() |

**PK**: id

**FKs**:
- `usuario_id` → `usuario.id`

**Índices**:
- `reset_password_token_pkey`: `CREATE UNIQUE INDEX reset_password_token_pkey ON public.reset_password_token USING btree (id)`
- `reset_password_token_token_key`: `CREATE UNIQUE INDEX reset_password_token_token_key ON public.reset_password_token USING btree (token)`

## `taller`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| lugar_id | uuid | YES |  |
| nombre | character varying(150) | NO |  |
| inicio | timestamp with time zone | YES |  |
| fin | timestamp with time zone | YES |  |
| capacidad | integer | YES |  |
| descripcion | text | YES |  |
| bloque_taller_id | uuid | YES |  |
| es_obligatorio | boolean | NO | false |

**PK**: id

**FKs**:
- `bloque_taller_id` → `bloque_taller.id`
- `evento_id` → `evento.id`
- `lugar_id` → `lugar.id`
- `org_id` → `organizacion.id`

**Índices**:
- `taller_pkey`: `CREATE UNIQUE INDEX taller_pkey ON public.taller USING btree (id)`
- `idx_taller_org_evento`: `CREATE INDEX idx_taller_org_evento ON public.taller USING btree (org_id, evento_id)`

## `tanda`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| esquema_id | uuid | NO |  |
| orden | integer | NO | 0 |
| nombre_resuelto | character varying(100) | YES |  |
| condicion | jsonb | NO |  |

**PK**: id

**FKs**:
- `esquema_id` → `esquema_grupos_trabajo.id`
- `evento_id` → `evento.id`
- `org_id` → `organizacion.id`

**Índices**:
- `tanda_pkey`: `CREATE UNIQUE INDEX tanda_pkey ON public.tanda USING btree (id)`
- `idx_tanda_esquema_id`: `CREATE INDEX idx_tanda_esquema_id ON public.tanda USING btree (esquema_id)`

## `tramo_precio_plataforma`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| participantes_desde | integer | NO |  |
| precio_por_participante_hasta | numeric | NO |  |
| activo | boolean | NO | true |
| participantes_hasta | integer | YES |  |
| monto_fijo | numeric | YES |  |
| precio_por_participante_desde | numeric | YES |  |
| precio_medio | numeric | YES |  |

**PK**: id

**Índices**:
- `tramo_precio_plataforma_participantes_desde_key`: `CREATE UNIQUE INDEX tramo_precio_plataforma_participantes_desde_key ON public.tramo_precio_plataforma USING btree (participantes_desde)`
- `tramo_precio_plataforma_pkey`: `CREATE UNIQUE INDEX tramo_precio_plataforma_pkey ON public.tramo_precio_plataforma USING btree (id)`

## `usuario`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| nombre | character varying(100) | NO |  |
| apellido | character varying(100) | NO |  |
| email | character varying(255) | NO |  |
| contrasena_hash | character varying(255) | NO |  |
| es_super_admin | boolean | NO | false |
| activo | boolean | NO | true |
| creado_en | timestamp with time zone | NO | now() |
| email_verificado | boolean | NO | false |

**PK**: id

**Índices**:
- `uq_usuario_email`: `CREATE UNIQUE INDEX uq_usuario_email ON public.usuario USING btree (email)`
- `usuario_pkey`: `CREATE UNIQUE INDEX usuario_pkey ON public.usuario USING btree (id)`

## `usuario_evento`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| usuario_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| rol | rol_usuario_evento | NO | 'lector'::rol_usuario_evento |
| creado_en | timestamp with time zone | NO | now() |

**PK**: id

**FKs**:
- `evento_id` → `evento.id`
- `usuario_id` → `usuario.id`

**Índices**:
- `uq_usuario_evento`: `CREATE UNIQUE INDEX uq_usuario_evento ON public.usuario_evento USING btree (usuario_id, evento_id)`
- `usuario_evento_pkey`: `CREATE UNIQUE INDEX usuario_evento_pkey ON public.usuario_evento USING btree (id)`
- `idx_usuario_evento_evento`: `CREATE INDEX idx_usuario_evento_evento ON public.usuario_evento USING btree (evento_id)`
- `idx_usuario_evento_usuario`: `CREATE INDEX idx_usuario_evento_usuario ON public.usuario_evento USING btree (usuario_id)`

## `usuario_organizacion`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| usuario_id | uuid | NO |  |
| org_id | uuid | NO |  |
| rol | rol_usuario_org | NO | 'admin'::rol_usuario_org |
| creado_en | timestamp with time zone | NO | now() |

**PK**: id

**FKs**:
- `org_id` → `organizacion.id`
- `usuario_id` → `usuario.id`

**Índices**:
- `uq_usuario_organizacion`: `CREATE UNIQUE INDEX uq_usuario_organizacion ON public.usuario_organizacion USING btree (usuario_id, org_id)`
- `usuario_organizacion_pkey`: `CREATE UNIQUE INDEX usuario_organizacion_pkey ON public.usuario_organizacion USING btree (id)`
- `idx_usuario_organizacion_org`: `CREATE INDEX idx_usuario_organizacion_org ON public.usuario_organizacion USING btree (org_id)`
- `idx_usuario_organizacion_usuario`: `CREATE INDEX idx_usuario_organizacion_usuario ON public.usuario_organizacion USING btree (usuario_id)`

## `verificacion_email_token`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| usuario_id | uuid | NO |  |
| token | character varying(6) | NO |  |
| expira_en | timestamp with time zone | NO |  |
| usado | boolean | NO | false |
| creado_en | timestamp with time zone | NO | CURRENT_TIMESTAMP |

**PK**: id

**FKs**:
- `usuario_id` → `usuario.id`

**Índices**:
- `verificacion_email_token_pkey`: `CREATE UNIQUE INDEX verificacion_email_token_pkey ON public.verificacion_email_token USING btree (id)`
- `verificacion_email_token_usuario_id_usado_index`: `CREATE INDEX verificacion_email_token_usuario_id_usado_index ON public.verificacion_email_token USING btree (usuario_id, usado)`

## `zona_costo`

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| org_id | uuid | NO |  |
| evento_id | uuid | NO |  |
| nombre | character varying(100) | NO |  |
| costo | numeric(12,2) | NO |  |
| orden | integer | NO | 0 |

**PK**: id

**Check**: `chk_zona_costo_costo_positivo`: `CHECK (costo > 0)`

**FKs**:
- `evento_id` → `evento.id` (ON DELETE CASCADE)
- `org_id` → `organizacion.id`

**Índices**:
- `zona_costo_pkey`: `CREATE UNIQUE INDEX zona_costo_pkey ON public.zona_costo USING btree (id)`
- `idx_zona_costo_org_evento`: `CREATE INDEX idx_zona_costo_org_evento ON public.zona_costo USING btree (org_id, evento_id)`

## Enums

- **accion_sin_nombres_esquema**: `bloquear_generacion`, `reciclar_numerado`
- **config_certificado**: `no`, `opcional_menores`, `opcional_mayores`, `opcional_todos`, `opcional_referentes`, `obligatorio_menores`, `obligatorio_mayores`, `obligatorio_todos`, `obligatorio_referentes`
- **config_ficha_medica**: `no`, `opcional_menores`, `opcional_mayores`, `opcional_todos`, `obligatorio_menores`, `obligatorio_mayores`, `obligatorio_todos`
- **estado_alta_plataforma_participante**: `confirmado`, `pendiente_pago_org`
- **estado_esquema_grupos**: `borrador`, `generado`
- **estado_pago_participante**: `no_aplica`, `pendiente`, `aprobado`, `rechazado`, `pendiente_aprobacion`
- **estado_pago_registro**: `pendiente`, `aprobado`, `rechazado`, `cancelado`
- **estado_vinculo_participante**: `pendiente`, `aceptado`, `rechazado`
- **metodo_pago**: `transferencia`, `pasarela`
- **modo_nombrado_esquema**: `por_tanda`, `por_grupo`
- **modo_taller_evento**: `paralelos`, `secuenciales`, `ninguno`
- **modo_tamano_esquema**: `por_cantidad`, `por_tamano`
- **motivo_pendiente_esquema**: `excluido_admin`, `excluido_sistema`, `sin_clasificar`, `retirado_manual`
- **pagado_por_participante**: `individual`, `grupal`
- **politica_menor_evento**: `obligatorio`, `opcional`, `no_aplica`
- **rol_grupo_participante**: `responsable`, `integrante`, `autoinscripto`, `ninguno`
- **rol_usuario_evento**: `lector`, `editor`
- **rol_usuario_org**: `admin`, `invitado`
- **tipo_campo_form**: `texto`, `numero`, `fecha`, `seleccion`, `booleano`
- **tipo_pago**: `creacion_evento`, `inscripcion`
- **tipo_sangre**: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`
- **universo_base_esquema**: `inscriptos`, `acreditados`