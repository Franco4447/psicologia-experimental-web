-- ============================================================================
-- Migración 2026-10-13: la limpieza de sesiones abandonadas conserva el grupo
-- ============================================================================
-- Antes, cleanup_abandoned_sessions() reescribía induction_group = 'control',
-- fake_news_set = 'control_random' y exclusion_reason = 'session_timeout_1h' en
-- toda sesión abandonada, con lo que se perdía en qué condición estaba cada
-- persona y si cumplía los criterios. Ahora solo cambia el estado y la saca del
-- balance; conserva el resto. Solo cambia la función: se puede ejecutar en
-- cualquier momento y no requiere desplegar código. Los abandonos ya limpiados
-- no se recuperan.

CREATE OR REPLACE FUNCTION public.cleanup_abandoned_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.participants
    SET
        status = 'abandoned',
        is_included = false,
        exclusion_reason = COALESCE(exclusion_reason, 'session_timeout_1h')
    WHERE
        status = 'started'
        AND created_at < NOW() - INTERVAL '1 hour';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_abandoned_sessions() TO service_role;
