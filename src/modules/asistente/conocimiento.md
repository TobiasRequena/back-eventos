# Guía de Talita Encuentro (para el asistente)

Plataforma para organizar eventos (campamentos, retiros, encuentros, jornadas, congresos): inscripción online, pagos por transferencia, grupos, talleres, acreditación con QR y comunicación con los inscriptos.

## Navegación
- Menú lateral: "Dashboard", "Eventos" ("Activos" / "Finalizados"), "Organización" ("Miembros"), "Facturación", "Soporte".
- Dentro de un evento, pestañas: "Resumen", "Participantes", "Acreditación", "Galería" (solo eventos finalizados).
- Dentro de "Participantes" hay subpestañas: "Listado", "Comunicaciones", "Agrupar", "Pasar lista" y "Modo emergencia" (solo si el evento pide contacto de emergencia).
- Íconos arriba del evento: "Compartir link de inscripción" (copiar link o enviar por WhatsApp), candado "Cerrar inscripciones"/"Reabrir inscripciones", lápiz "Editar evento", tacho "Eliminar evento".

## Crear un evento ("Crear evento" en Dashboard o Eventos)
Secciones del formulario:
1. **Datos del evento**: imagen de portada, "Nombre del evento", código (va en el link de inscripción, letras/números/guiones), "Descripción", "Fecha y hora de inicio"/"de fin", "Cupo máximo" (cierra la inscripción sola al llenarse), "Costo de inscripción" o "Costo diferido por zona" (precios distintos según zona/procedencia), "CBU/CVU" y "Alias de cobro" (los inscriptos transfieren y suben el comprobante), "Mostrar en la página de Talita Encuentro".
2. **Adicionales**:
   - "Ficha médica": No requerida / Requerida (alergias, medicación, datos de salud).
   - "Contacto de emergencia": habilita el "Modo emergencia" (contactos a un toque).
   - "Inscripción por grupos": un referente crea un grupo (con "Código de invitación") y los integrantes se suman; el referente tiene su "Panel de referente" para aceptar/rechazar solicitudes.
   - "Política de menores": si se admiten menores y si deben ir en el grupo de un adulto (Obligatorio / Opcional / No aplica).
   - "Autorización de menores": pide la autorización firmada de madre/padre/tutor (se puede subir un modelo/template).
   - "Certificado de antecedentes": No requerido / Obligatorio para mayores / Obligatorio para referentes de grupo.
3. **Formulario de inscripción**: preguntas propias (texto, número, fecha, selección con opciones, sí/no), obligatorias u opcionales. Ej: talle de remera, parroquia, alimentación especial.
4. **Talleres** ("Este evento tiene talleres"): talleres sueltos (con horario y cupo) o bloques de talleres donde el inscripto elige N opciones (ej. "Bloque sábado mañana: elegí 1 entre 4 talleres").

Después de creado, con "Editar evento" se pueden cambiar datos y adicionales; el formulario de inscripción y los talleres NO se pueden editar después de crear.

## Agrupar (grupos de trabajo)
Sirve para repartir a los inscriptos en grupos: dormitorios, colegios/casas donde se duerme, micros, equipos, grupos de reflexión, turnos de servicio, etc.
Camino: evento → "Participantes" → "Agrupar" → "Nueva agrupación".
- **Configuración**: "Nombre de la agrupación" (ej. "Alojamiento"); "Universo base": "Todos los inscriptos" o "Solo acreditados"; "Modo": "Por cantidad de grupos" (ej. 3 grupos = 3 colegios) o "Por cantidad de integrantes" (ej. 40 por micro); "Nombrado de grupos": lista de nombres (presets como Colores, o "Personalizada" para poner "Colegio San José", "Colegio Belgrano", etc.).
- "Asignación manual" activado: se crean los grupos vacíos y vos elegís quién va a cada uno.
- Sin asignación manual: Talita reparte **aleatoriamente**. "Mantener grupos de inscripción" deja juntos a los que se anotaron en el mismo grupo.
- Pasos automáticos: "Configuración" → "Excluidos" (sacar personas puntuales) → "Vista previa" ("Calcular") → "Generar grupos".
- Resultado: renombrar/eliminar grupos, "Nuevo grupo", mover gente con "Mover a otro grupo" o "Retirar del grupo", y desde "Pendientes" seleccionar varios y "Asignar a grupo". Se puede "Regenerar".
- Excel: "Descargar Excel completo" o "Descargar Excel del grupo".
- Avisar por mail a cada uno qué grupo le tocó: "Notificar a todos por mail", "Notificar grupo por mail" o "Notificar por mail" a una persona.
- Si se anota gente después de generar, aparece un aviso para regenerar.

## Comunicaciones (mails a inscriptos)
"Participantes" → "Comunicaciones" → "Nuevo mensaje": "Asunto", "Destinatarios" ("Todos los inscriptos", "Solo acreditados" o "Referentes de grupos"), "Filtros por campo" (filtrar por respuestas del formulario, ej. solo los que eligieron talle M), "Mensaje" y hasta 5 adjuntos (PDF o imagen).

## Participantes → Listado
Buscador por nombre, DNI o grupo; "Filtros" (estado de pago, mayores/menores, grupo, zona, respuestas); "Columnas" para mostrar/ocultar; "Descargar Excel". Cada persona tiene "Ver detalle": datos, pago ("Ver comprobante" → "Aprobar pago"/"Rechazar"), cambiar zona, respuestas, ficha médica, autorización, certificado, acreditación. Eliminar participante se puede deshacer por 90 días ("Ver eliminados").

## Pagos
Los inscriptos transfieren al CBU/alias y suben el comprobante desde el link que reciben. En "Resumen", la tarjeta "Comprobantes esperando revisión" lista los pendientes para aprobar o rechazar. Estados: Sin costo, Pendiente de pago, Comprobante cargado, Aprobado, Rechazado.

## Acreditación (check-in con QR)
Cada inscripto recibe un QR por mail. Pestaña "Acreditación": se habilita 2 h antes del inicio; "Link de acreditación" para compartir con quienes acreditan (no necesitan cuenta) y "Abrir interfaz de acreditación". Se escanea el QR, se toca "Acreditar"; el QR del referente acredita a todo su grupo. Avisa si alguien tiene pago, autorización o certificado pendiente. Listas de "Acreditados" / "Sin acreditar" con filtros.

## Pasar lista
"Participantes" → "Pasar lista" → "Comenzar": vas marcando Presente/Ausente. Al final: "Enviar mail a ausentes" y "Descargar lista (PDF)". Sirve para cada actividad, micro, regreso, etc.

## Modo emergencia
"Participantes" → "Modo emergencia": tabla con contacto de emergencia, teléfono (para llamar con un toque) y parentesco de cada participante. Requiere activar "Contacto de emergencia" al crear/editar.

## Galería
En eventos finalizados, pestaña "Galería" → "Subir fotos" (hasta 20). Son públicas en la página de Talita: subir solo fotos con consentimiento.

## Organización y equipo
"Organización": datos, redes, logo, aparecer en "Gracias por elegirnos". "Miembros" → "Invitar miembro" (por email, la persona ya debe tener cuenta). Roles: Admin e Invitado.

## Facturación
Se paga un monto fijo por tramo de cantidad de participantes (los precios están en la sección "Costos" de la página principal); los tramos sin cargo figuran como "Gratis". No inventes montos: si preguntan precios, mandalos a "Costos" o "Facturación". Si hay deuda, algunas funciones del evento se bloquean hasta pagar en "Facturación" (se puede "Pagar adelantado").

## Soporte
"Soporte": formulario de contacto con el equipo.
