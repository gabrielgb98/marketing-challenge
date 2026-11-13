# ClassRush — pruebas independientes

## Prueba privada

La versión de prueba usa el mismo frontend de la rama y una base D1 aislada. No ocupa un proyecto Supabase ni escribe en Marketing Challenge. El acceso exterior es solo del propietario. Para simular una clase, abrí la URL con tu sesión de ChatGPT y usá perfiles de navegador separados para dos docentes o dos equipos. Cada perfil debe poder entrar a la URL privada. Los equipos ingresan al juego con el código y el nombre, sin registrarse en ClassRush.

En el panel docente podés crear cuentas de prueba con correos de ejemplo y contraseñas exclusivas del piloto. En esta versión no hay envío ni recuperación por correo. Las cuentas, cuestionarios y partidas de prueba quedan en la base del piloto.

## Entorno Supabase para desarrollo

Si ya contás con un entorno Supabase aislado, aplicá en orden las dos migraciones de `supabase/migrations/` y configurá las variables de `.env.example`. Los scripts originales `supabase.sql` y `upgrade-20-preguntas.sql` pertenecen a Marketing Challenge.

Para probar el correo de Supabase, agregá el origen de prueba y las rutas `/docente` y `/recuperar` a las redirecciones de Auth. Corré `npm ci`, `npm test`, `npm run typecheck`, `npm run build` y `npm run dev`.

El piloto se compila con `node pilot/build.mjs`. El script usa el Next.js del repositorio y requiere `esbuild` en PATH o en `CLASSRUSH_ESBUILD`. La migración de la base de prueba está en `pilot/migrations/`. El backend del piloto requiere `CLASSRUSH_PASSWORD_PEPPER`, un secreto de servidor aleatorio de al menos 32 caracteres. Conservá el mismo secreto para que las cuentas de prueba puedan seguir iniciando sesión. La rama desactiva los despliegues automáticos de Vercel mientras la versión de prueba se aloja en privado.

## Prueba funcional (dos docentes y dos equipos)
1. Registrarse en `/docente`, cerrar sesión, ingresar y guardar perfil. Confirmar el correo solo en un entorno Supabase configurado para ello.
2. En un entorno Supabase con correo, probar recuperación de contraseña: solicitar enlace, abrirlo en el mismo navegador, guardar nueva contraseña e ingresar nuevamente.
3. Crear cuestionario con título, materia y descripción. Agregar dos preguntas, cada una con cuatro opciones; marcar la última con puntos dobles.
4. Descargar la plantilla CSV, abrirla en Excel, agregar preguntas y guardar como CSV UTF-8 o XLSX. Importar, inspeccionar vista previa y aprobar. Una fila incorrecta debe bloquear la incorporación completa.
5. Guardar, editar y duplicar. Abrir otra cuenta docente: no debe ver el cuestionario ni las partidas de la primera.
6. Iniciar una partida y abrir `/` en dos celulares o perfiles de navegador separados. Ingresar el código, crear equipos y comenzar desde el panel docente. Si ambos equipos se prueban en el mismo navegador comparten almacenamiento: usar perfiles separados.
7. Responder antes del vencimiento, intentar responder dos veces y responder después del plazo. Los envíos duplicados/tardíos deben fallar.
8. Revelar: recién entonces deben aparecer respuesta correcta y puntos de la pregunta. Avanzar hasta el podio.
9. Volver al historial y exportar CSV; comparar con ranking final. Recargar el celular: debe recuperar el equipo.
10. Editar/archivar el cuestionario: el historial y las preguntas de partidas previas deben seguir iguales.

## Prueba de seguridad
`npm test` ejecuta validación de importaciones y una integración PostgreSQL local con PGlite: aplica el SQL real a una base descartable, simula roles anon/authenticated y verifica aislamiento, controles, secreto de equipo, ocultamiento, puntuación, duplicados, archivado y snapshots. El flujo de Supabase Auth, PostgREST y correo se valida en un entorno Supabase configurado. El fixture histórico `224062` de la prueba NO es una copia de producción.

## Protección y recuperación del histórico
Antes de intervenir producción seguir `docs/RESPALDO.md`. La integridad de `224062` debe comprobarse contra un respaldo restaurado, con todos sus equipos, respuestas y puntos. Ninguna tarea de esta rama necesita conectarse a producción.
