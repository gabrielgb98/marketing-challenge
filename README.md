# ClassRush MVP

Evolución de Marketing Challenge: cuestionarios privados por docente y competencias por equipos para cualquier materia.

**Rama de trabajo:** `classrush-mvp`. **No promover a producción ni ejecutar SQL en Marketing Challenge sin autorización.**

- [Auditoría, plan y estado](docs/AUDITORIA.md)
- [Configuración de pruebas y guía del piloto](SETUP.md)
- [Respaldo y recuperación](docs/RESPALDO.md)
- [Migración aislada ClassRush](supabase/migrations/202611020001_classrush.sql)

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Copiar `.env.example` a `.env.local` con un **Supabase de pruebas independiente**. Sin esas variables, la interfaz indica configuración pendiente y no usa credenciales de producción.

Los scripts SQL originales permanecen como referencia histórica; no forman parte de la instalación ClassRush. IA desde PDF/PPTX/texto y verificación del histórico real pendientes. No se habilitaron servicios pagos.
