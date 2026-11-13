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

Para desarrollo con Supabase, configurá `.env.example` con un entorno de pruebas aislado. El piloto alojado usa la misma interfaz con una base de prueba propia. La guía explica cómo entrar y probar una partida.

Los scripts SQL originales permanecen como referencia histórica; no forman parte de la instalación ClassRush. La importación admite CSV y XLSX. La verificación directa del histórico real sigue pendiente.
