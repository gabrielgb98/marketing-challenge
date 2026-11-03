# ClassRush — pruebas independientes

## Estado
Esta rama no se debe promover a producción. `main` y los datos históricos de Marketing Challenge quedan fuera de esta implementación. **No ejecutar `supabase.sql` ni `upgrade-20-preguntas.sql` para configurar ClassRush**: pertenecen a la aplicación original.

## Preparar el entorno de pruebas
1. En Supabase, crear un proyecto nuevo llamado `classrush-staging` en el plan gratuito si está disponible. Si la cuenta requiere un plan pago, detenerse y autorizarlo antes de contratar.
2. En el SQL Editor de ese proyecto nuevo, ejecutar `supabase/migrations/202611020001_classrush.sql` una sola vez. No hacerlo en `marketing-challenge`.
3. En Authentication → URL Configuration, configurar el Site URL del preview y agregar `https://URL-DEL-PREVIEW/docente` y `https://URL-DEL-PREVIEW/recuperar` a Redirect URLs. Para pruebas locales agregar los equivalentes con `http://localhost:3000`.
4. Mantener confirmación de correo y configurar proveedor de correo antes de invitar a 5–10 docentes; el correo de prueba de Supabase puede tener restricciones o cuotas. No contratar SMTP sin autorización.
5. Copiar `.env.example` a `.env.local` y cargar URL y clave pública del **proyecto nuevo**:
   - `NEXT_PUBLIC_CLASSRUSH_SUPABASE_URL`
   - `NEXT_PUBLIC_CLASSRUSH_SUPABASE_ANON_KEY`
   No se requiere service role. No compartir secretos en el chat ni subir `.env.local` a GitHub.
6. `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run dev`.
7. Para Vercel, configurar esas dos variables solamente en Preview y restringidas a `classrush-mvp`. No cambiar las variables actuales, dominios, rama de producción ni promover el despliegue. Una preview automática antes de configurar variables mostrará “entorno sin configurar”.

## Prueba funcional (dos docentes y dos equipos)
1. Registrarse en `/docente`, confirmar correo, cerrar sesión, ingresar y guardar perfil.
2. Probar recuperación de contraseña: solicitar enlace, abrirlo en el mismo navegador, guardar nueva contraseña e ingresar nuevamente.
3. Crear cuestionario con título, materia y descripción. Agregar dos preguntas, cada una con cuatro opciones; marcar la última con puntos dobles.
4. Descargar la plantilla CSV, abrirla en Excel, agregar preguntas y guardar como CSV UTF-8 o XLSX. Importar, inspeccionar vista previa y aprobar. Una fila incorrecta debe bloquear la incorporación completa.
5. Guardar, editar y duplicar. Abrir otra cuenta docente: no debe ver el cuestionario ni las partidas de la primera.
6. Iniciar una partida y abrir `/` en dos celulares o perfiles de navegador separados. Ingresar el código, crear equipos y comenzar desde el panel docente. Si ambos equipos se prueban en el mismo navegador comparten almacenamiento: usar perfiles separados.
7. Responder antes del vencimiento, intentar responder dos veces y responder después del plazo. Los envíos duplicados/tardíos deben fallar.
8. Revelar: recién entonces deben aparecer respuesta correcta y puntos de la pregunta. Avanzar hasta el podio.
9. Volver al historial y exportar CSV; comparar con ranking final. Recargar el celular: debe recuperar el equipo.
10. Editar/archivar el cuestionario: el historial y las preguntas de partidas previas deben seguir iguales.

## Prueba de seguridad
`npm test` ejecuta validación de importaciones y una integración PostgreSQL local con PGlite: aplica el SQL real a una base descartable, simula roles anon/authenticated y verifica aislamiento, controles, secreto de equipo, ocultamiento, puntuación, duplicados, archivado y snapshots. Auth real, servicio REST, correo y navegador requieren la prueba manual anterior. El fixture histórico `224062` de la prueba NO es una copia de producción.

## Protección y recuperación del histórico
Antes de intervenir producción seguir `docs/RESPALDO.md`. La integridad de `224062` debe comprobarse contra un respaldo restaurado, con todos sus equipos, respuestas y puntos. Ninguna tarea de esta rama necesita conectarse a producción.
