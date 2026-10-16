-- ============================================================================
-- Migración 2026-10-16: la limpieza nocturna vuelve a funcionar
-- ============================================================================
-- Desde 20261013_limpieza_conserva_grupo.sql, cleanup_abandoned_sessions()
-- marca is_included = false y conserva el grupo y el conjunto de noticias. El
-- CHECK chk_participant_exclusion_logic exigía control/control_random en toda
-- fila excluida, así que cada vez que había una sesión incluida abandonada el
-- UPDATE fallaba entero (23514) y no se limpiaba nada: el cron falló el 14, 15
-- y 16 de octubre. Ahora una sesión abandonada por tiempo puede conservar su
-- condición. Aplicada en producción el 2026-10-16, seguida de una ejecución
-- manual de la limpieza.

ALTER TABLE public.participants DROP CONSTRAINT chk_participant_exclusion_logic;
ALTER TABLE public.participants ADD CONSTRAINT chk_participant_exclusion_logic CHECK (
  is_included = true
  OR (induction_group = 'control' AND fake_news_set = 'control_random')
  OR exclusion_reason = 'session_timeout_1h'
);

SELECT public.cleanup_abandoned_sessions();
