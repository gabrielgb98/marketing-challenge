# ClassRush — auditoría y estado del MVP

Fecha: 2 de noviembre de 2026. Base auditada: `3b98402d011272799ffab0fb801393126c1ae554`, rama `classrush-mvp`.

## Alcance y evidencia
Se inspeccionó el repositorio, sus scripts SQL y la metadata del proyecto Vercel `marketing-challenge`. No se consultó ni modificó la base Supabase real. Las políticas efectivamente desplegadas y los registros de `224062` todavía no están verificados. No existe un respaldo real generado en esta sesión. La prueba con `224062` usa un registro sintético para comprobar que la migración no altera tablas antiguas.

## Hallazgos del código original

| Gravedad | Hallazgo | Efecto |
| --- | --- | --- |
| Crítica | SELECT público de `games` con `token` | Cualquier visitante podría obtener el control de una partida mediante la API |
| Crítica | `qs` contiene las respuestas correctas en el bundle del estudiante | Permite anticipar respuestas |
| Alta | `submit_answer` acepta un UUID de equipo sin secreto | Suplantación de respuestas de otro equipo |
| Alta | SELECT público de equipos y respuestas | Expone identificadores, elecciones y puntuaciones |
| Alta | No existe identidad docente ni propiedad de cuestionarios | No es apto para múltiples docentes |
| Media | Preguntas duplicadas entre TypeScript y SQL | Riesgo de desalinear duración, respuesta o puntaje |
| Media | SQL inicial y upgrade no representan una migración versionada | No se conoce cuál versión está aplicada en producción |
| Media | Sin lockfile ni pruebas originales | Builds menos reproducibles y falta de regresión |

No se corrigieron políticas antiguas en producción: requieren respaldo, inspección del esquema real y autorización. Marketing Challenge conserva los riesgos anteriores hasta ese trabajo.

## Decisiones implementadas
- Continuidad de Next.js, Supabase y Vercel; se conserva el patrón de partidas, equipos, cronómetro, ranking y podio. No se crea otro stack.
- Tablas nuevas `cr_*`, sin FK, UPDATE, DELETE ni ALTER contra las tablas históricas.
- Variables CLASSRUSH exclusivas: sin fallback a las credenciales de Marketing Challenge.
- Docentes autenticados por Supabase Auth; RLS separa sus perfiles, cuestionarios y partidas.
- Las funciones de partida verifican al propietario. Los participantes reciben un secreto aleatorio almacenado solamente en su navegador; la base guarda su hash SHA-256.
- Respuestas correctas omitidas en el estado antes de revelar. El ranking tampoco filtra el resultado de la pregunta abierta.
- Puntaje y tiempos calculados con el reloj de PostgreSQL. Respuestas únicas por equipo y pregunta; bloqueo de fila serializa envío y cierre.
- Cada partida conserva una copia del cuestionario. Eliminar de biblioteca archiva; no borra resultados.
- CSV exportado escapa fórmulas para reducir la inyección en Excel. ExcelJS se carga solamente al importar XLSX. Máximo 2 MB y 100 preguntas.
- No se habilita IA ni almacenamiento de archivos académicos todavía.

## Plan breve
1. Ejecutar respaldo y verificación de restauración en otro proyecto antes de cualquier cambio productivo.
2. Provisionar proyecto Supabase independiente y aplicar únicamente la migración ClassRush.
3. Desplegar preview de `classrush-mvp` con variables CLASSRUSH de ese proyecto.
4. Ejecutar la guía de dos docentes y dos equipos, incluida la matriz negativa de permisos.
5. Piloto con 5–10 docentes; recoger errores, éxito de ingreso, preguntas importadas y partidas finalizadas.
6. Incorporar IA con aprobación por pregunta, límites por docente y presupuesto explícitamente autorizado.

## Completado en código
Registro, login, recuperación, perfil, biblioteca privada, CRUD con archivado, duplicación, edición manual, XLSX/CSV con plantilla/errores/vista previa/aprobación, equipos sin cuenta, código, cronómetro, velocidad, puntos dobles por pregunta, ranking con polling de 1,5 segundos, podio, historial y exportación CSV compatible con Excel.

## Límites y pendientes
- No hay preview conectado ni prueba real de correo, Auth, PostgREST o varios dispositivos sin Supabase de pruebas.
- Historial muestra partidas ClassRush del docente. Las partidas antiguas permanecen en Marketing Challenge; no se atribuyen automáticamente a cuentas ni se importan a la nueva biblioteca.
- No se ha verificado la integridad real de `224062` ni ejecutado respaldo o recuperación.
- IA de PDF/PPTX/texto pendiente; no hay consumo ni costos asociados habilitados.
- Exportación de ranking en CSV; no incluye por ahora informe detallado por respuesta ni archivo XLSX.
- Polling para el piloto, no Realtime por suscripción. Máximo 30 equipos por partida y 100 preguntas por cuestionario.
- Antes de abrir al público: rate limiting de ingreso y creación, protección contra abuso, CAPTCHA y ajuste de cuotas de Auth. Un código de seis dígitos no es un secreto: puede revelar título y estado, nunca preguntas o controles sin credencial.
- Perder/borrar el almacenamiento del equipo impide recuperar su credencial; no hay recuperación de equipo todavía.
- Los compañeros que comparten credencial pueden responder por el mismo equipo, por diseño.
- Una migración es de aplicación única: si falla, la transacción revierte; no se debe volver a ejecutar tras el éxito.

## Verificación ejecutada
- `npm test`: importación CSV, validación, escape de fórmulas; migración real sobre PostgreSQL local PGlite con roles y pruebas negativas de acceso, duplicados, expiración, cambios de pregunta, respuestas inválidas y puntuación.
- `npm run typecheck` y `npm run build`: correctos (Next.js 15.5.28).
- `npm audit --omit=dev --audit-level=high`: sin avisos altos/críticos después de fijar PostCSS 8.5.32 mediante override. Quedan 9 avisos moderados en dependencias transitivas de ExcelJS (minimatch/uuid y sus dependientes). No se forzaron cambios mayores incompatibles; reevaluar antes de abrir importaciones al público. Los archivos se procesan localmente en el navegador y no se almacenan ni ejecutan en el servidor.
- La revisión de React aplicó carga diferida de ExcelJS, consultas independientes en paralelo, labels y estados de carga/error. El panel todavía puede dividirse en componentes más pequeños tras el piloto.
- QA visual en navegador bloqueado: el navegador remoto no puede acceder al servidor local (`ERR_CONNECTION_REFUSED`). No se afirma haber verificado visualmente escritorio, proyector ni móvil.
