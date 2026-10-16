-- ============================================================================
-- Migración 2026-10-16: las tablas solo se escriben desde el servidor
-- ============================================================================
-- Quedaban políticas de RLS de las primeras versiones que dejaban, con la clave
-- pública (anon), insertar participantes y respuestas y modificar cualquier fila
-- de participants (USING true). La plataforma ya no las usa: todas las escrituras
-- pasan por las rutas /api con service_role. Se borran las políticas y se revocan
-- los permisos de tabla que Supabase da por defecto a anon y authenticated.
-- Aplicada en producción el 2026-10-16.
-- Para revertir: recrear las tres políticas (ver historial de schema.sql) y
-- GRANT INSERT, UPDATE ON participants / GRANT INSERT ON responses a anon.

DROP POLICY IF EXISTS "Allow anonymous participant insertion" ON public.participants;
DROP POLICY IF EXISTS "Allow anonymous update of own session completion" ON public.participants;
DROP POLICY IF EXISTS "Allow anonymous response insertion" ON public.responses;

REVOKE ALL ON public.participants, public.responses FROM anon, authenticated;
