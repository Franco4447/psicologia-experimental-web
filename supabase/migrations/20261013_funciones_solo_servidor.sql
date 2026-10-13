-- ============================================================================
-- Migración 2026-10-13: funciones solo para el servidor y search_path fijo
-- ============================================================================
-- Las funciones se crean con EXECUTE para PUBLIC, así que anon podía llamar por la API REST a
-- cleanup_abandoned_sessions() (SECURITY DEFINER, modifica participantes) y a
-- create_participant_session() (versión vieja, sin residencia ni rango etario, que no usa la app).
-- Solo las llama el servidor (la limpieza desde el cron, con service_role), así que se revoca el
-- acceso a PUBLIC, anon y authenticated.
--
-- Además se fija search_path en cleanup_abandoned_sessions() y en el trigger
-- trg_fn_calculate_response_constructs() (aviso function_search_path_mutable).
--
-- No se toca assign_induction_group(): la llama el servidor, pero falta confirmar en los logs con
-- qué rol, y si cayera a anon el alta de sesión usaría en silencio el balanceo en memoria.
-- Se puede correr varias veces.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.cleanup_abandoned_sessions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_participant_session(UUID, INT, VARCHAR, BOOLEAN, VARCHAR, TEXT, BOOLEAN, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cleanup_abandoned_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_participant_session(UUID, INT, VARCHAR, BOOLEAN, VARCHAR, TEXT, BOOLEAN, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT) TO service_role;

ALTER FUNCTION public.cleanup_abandoned_sessions() SET search_path = public;
ALTER FUNCTION public.trg_fn_calculate_response_constructs() SET search_path = public;

COMMIT;
