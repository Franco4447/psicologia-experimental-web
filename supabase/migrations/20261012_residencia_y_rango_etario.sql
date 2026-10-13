-- ============================================================================
-- Migración 2026-10-12: residencia y rango etario como criterios de inclusión
-- ============================================================================
-- Ejecutar completa en el SQL Editor de Supabase ANTES de desplegar el código
-- que agrega la pregunta de residencia. Si el código llega primero, el alta de
-- participantes falla (columna inexistente) y la sesión queda solo en memoria.
-- Es idempotente: se puede volver a ejecutar sin efectos adicionales.

BEGIN;

-- 1. Nueva columna: provincia o jurisdicción de residencia (NULL en registros previos)
ALTER TABLE public.participants
    ADD COLUMN IF NOT EXISTS residence VARCHAR(60) NULL;

-- 2. Nuevos motivos de exclusión: mayores de 65 años y residencia fuera de CABA / PBA
ALTER TABLE public.participants
    DROP CONSTRAINT IF EXISTS chk_participant_exclusion_reason;
ALTER TABLE public.participants
    ADD CONSTRAINT chk_participant_exclusion_reason
    CHECK (exclusion_reason IS NULL OR exclusion_reason IN ('menor_de_edad', 'no_estudia_psicologia', 'orientacion_otros', 'session_timeout_1h', 'condicion_memoria', 'dificultad_visual', 'fuera_de_rango_etario', 'fuera_de_region'));

-- 3. Exportación en formato largo (CSV): agrega la residencia como última columna
CREATE OR REPLACE VIEW public.v_experimental_dataset_long AS
SELECT 
    p.id AS participant_id,
    p.created_at,
    p.completed_at,
    p.age,
    p.gender,
    p.studies_psychology,
    p.therapeutic_orientation,
    p.university,
    p.is_included,
    COALESCE(p.exclusion_reason, '') AS exclusion_reason,
    p.induction_group,
    p.fake_news_set,
    r.presentation_order,
    r.news_id,
    COALESCE(r.news_title, '') AS news_title,
    r.is_fake,
    r.news_congruence,
    r.response_option,
    r.response_label,
    CASE WHEN r.is_false_memory THEN 1 ELSE 0 END AS is_false_memory,
    CASE WHEN r.is_false_belief THEN 1 ELSE 0 END AS is_false_belief,
    CASE WHEN r.is_true_memory THEN 1 ELSE 0 END AS is_true_memory,
    r.reading_time_ms,
    r.response_time_ms,
    COALESCE(p.device_type, '') AS device_type,
    COALESCE(p.screen_resolution, '') AS screen_resolution,
    COALESCE(p.user_agent, '') AS user_agent,
    COALESCE(p.mc_reported_induction, '') AS mc_reported_induction,
    p.mc_emotion_usage,
    p.mc_reason_usage,
    COALESCE(p.residence, '') AS residence
FROM public.participants p
JOIN public.responses r ON p.id = r.participant_id
ORDER BY p.created_at DESC, r.presentation_order ASC;

-- 4. Vista de una fila por participante (Excel): el promedio de segundos se calcula
--    con decimales. Antes, response_time_ms / 1000 era una división entera y
--    truncaba cada respuesta a segundos enteros antes de promediar.
CREATE OR REPLACE VIEW public.v_dataset_participantes
WITH (security_invoker = true) AS
WITH cte_base AS (
    SELECT
      participant_id, age, gender, mc_emotion_usage, mc_reason_usage,
      CASE
        WHEN university = 'U.B.A.' THEN 'Universidad de Buenos Aires (UBA)'
        WHEN university = 'UNLZ'   THEN 'Universidad Nacional de Lomas de Zamora (UNLZ)'
        WHEN university IN ('UFLO', 'Uflo') THEN 'Universidad de Flores (UFLO)'
        ELSE university
      END AS university,
      CASE
        WHEN induction_group = 'racional'  THEN 'Razón'
        WHEN induction_group = 'emocional' THEN 'Emoción'
        ELSE 'Control'
      END AS induction_group,
      CASE
        WHEN therapeutic_orientation = 'Basada en Evidencia Científica' THEN 'Cognitivo-Conductual'
        ELSE therapeutic_orientation
      END AS therapeutic_orientation,
      CASE
        WHEN induction_group IN ('racional', 'emocional') THEN mc_reported_induction
        ELSE '(control)'
      END AS mc_reported_induction,
      is_false_memory, is_false_belief, is_true_memory, response_time_ms
    FROM public.v_experimental_dataset_long
    WHERE is_included = true
), cte_participants AS (
    SELECT DISTINCT
      participant_id AS id_participante, age AS edad, gender AS genero,
      university AS universidad, induction_group AS grupo_induccion,
      therapeutic_orientation AS orientacion_terapeutica,
      mc_reported_induction AS induccion_reportada,
      mc_emotion_usage AS emocion_reportada, mc_reason_usage AS razon_reportada
    FROM cte_base
), cte_metrics AS (
    SELECT
      participant_id AS id_participante,
      SUM(is_false_memory) AS false_memory,
      SUM(is_false_belief) AS false_belief,
      SUM(is_true_memory)  AS true_memory,
      CAST(AVG(response_time_ms / 1000.0) AS numeric(5,2)) AS promedio_segs_respuesta
    FROM cte_base
    GROUP BY participant_id
)
SELECT p.*, m.false_memory, m.false_belief, m.true_memory, m.promedio_segs_respuesta
FROM cte_participants p
INNER JOIN cte_metrics m ON p.id_participante = m.id_participante
WHERE p.emocion_reportada IS NOT NULL;

GRANT SELECT ON public.v_experimental_dataset_long TO service_role;
GRANT SELECT ON public.v_dataset_participantes TO service_role;

COMMIT;
