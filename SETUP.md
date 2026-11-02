# Configuración
1. Crear proyecto en Supabase y ejecutar `supabase.sql` en SQL Editor.
2. Copiar Project URL y anon/publishable key.
3. En Vercel agregar variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` para producción y redeploy.
4. Abrir `/docente` para crear partida. Los equipos ingresan desde `/`.
5. Probar con 2 celulares antes de clase.

MVP de demostración, sin autenticación robusta: no utilizar para calificaciones formales ni datos sensibles. Los participantes pueden consultar respuestas mediante la API pública; reforzar seguridad antes de producción. Para modificar preguntas, actualizar `lib/game.ts` y `supabase.sql` conjuntamente.