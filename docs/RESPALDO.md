# Respaldo y recuperación — obligatorio antes de producción

Estado: procedimiento preparado; respaldo real y restauración todavía no ejecutados. No se dispone de acceso a Supabase desde esta sesión.

1. En Supabase → proyecto `marketing-challenge` → Connect, obtener una conexión PostgreSQL con permisos de lectura; guardarla en un gestor de secretos o en `PGSERVICE`, nunca en el chat, repositorio ni argumentos de comandos.
2. Instalar las herramientas PostgreSQL de una versión compatible. Configurar `PGSERVICE=marketing-challenge-backup`, `PGPASSFILE` con permisos 0600 y SSL. Usar un equipo confiable y almacenamiento cifrado.
3. Ejecutar `bash scripts/backup-legacy.sh /RUTA-CIFRADA/respaldo` desde la rama original o esta rama. El script sólo lee el esquema público; no captura Auth, Storage ni configuración del proyecto. Exportar estos elementos por separado si corresponde, según las funciones usadas y opciones del proveedor.
4. El dump es consistente internamente, pero el inventario se toma en otra transacción: si hay partidas escribiendo, sus conteos pueden diferir. Ejecutar en una ventana sin actividad acordada y repetir la comparación en la restauración; no bloquear ni suspender producción sin autorización. Registrar conteos, hashes y fecha; conservar dos copias cifradas. Confirmar que `224062` está presente. El archivo de inventario registra contenido completo de esa partida y debe mantenerse privado.
5. Restaurar el archivo `.dump` en un proyecto independiente vacío, nunca sobre producción: preparar roles/extensiones compatibles y usar `pg_restore --no-owner --no-privileges --dbname=CONEXION-DE-PRUEBAS ARCHIVO.dump` mediante configuración segura de conexión (no claves en el comando).
6. Comparar conteos y los JSON ordenados de `games`, `teams`, `answers` de `224062` entre respaldo y restauración. Verificar cada nombre, respuesta y puntaje, y abrir la versión original de la aplicación conectada a la copia. Cualquier diferencia bloquea la migración.
7. Sólo después: solicitar autorización sobre un plan SQL concreto para la base real. No sustituir funciones históricas ni asignar propietarios sin verificar relaciones y autorización.

## Recuperación
- Revertir el frontend mediante el despliegue anterior de Vercel sólo con autorización si reemplaza la aplicación activa.
- La migración ClassRush es aditiva y transaccional. Si falla antes de COMMIT no debe dejar cambios parciales.
- Tras COMMIT, preferir corregir hacia adelante. No ofrecer un rollback con DROP: podría borrar actividad nueva.
- Si ocurre corrupción histórica, detener escrituras con un plan autorizado, restaurar primero en una base nueva y validar. Recuperar sobre producción requiere autorización específica; jamás ejecutar TRUNCATE, DROP o restauración destructiva de forma automática.
