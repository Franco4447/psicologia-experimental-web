-- ============================================================================
-- Revierte insertar_simulados.sql: borra los 20 participantes simulados y sus respuestas
-- ============================================================================
-- Ver scripts/simulacion/README.md.

BEGIN;

DELETE FROM public.responses WHERE participant_id IN (
    '286354ad-06d7-4930-9777-25c56218abfd',
    'd5cee8b1-b2cc-44de-96a9-f6fdb2f6c691',
    '2df78522-ed2a-4240-9f63-a2e2436cb6e5',
    '17c5c5b2-b6bd-446c-b772-a595b4692b3a',
    '8c0b33d2-c8b7-468e-8af4-c8254c1bbee3',
    '90619077-b1d4-4d90-8b11-63e04b9a5c71',
    '20f5b07e-e419-49cd-9bad-4812974505a2',
    '60a8bda8-1b5d-4e86-a5ea-f5c037641ced',
    'd18cae46-1aa0-4b44-8091-a19b2569bca3',
    '436bdb1c-7058-434f-b9fd-0d7047c5fd43',
    '8406ec1f-21ef-4c20-9acf-6c083456ab47',
    'a713196b-11ab-4e20-867e-e6bf0abb618f',
    '078188a1-8048-470c-abf3-154448b765ab',
    '0b0c9ed1-aad6-40f8-a2a8-3c3fccaf994a',
    '11b8b754-c8e3-4806-b3d1-803f03962fb5',
    '308220db-d5bb-45bd-9ff7-b124877c4bd0',
    'dc195020-b6f8-404f-b228-031d9e3befc9',
    '8b651634-7db2-4798-b1a0-d2102f69ba8d',
    '56bcde38-7799-46cd-a270-5aac450956cc',
    'fa555a4b-d4b2-4e64-9094-d89271fe1224'
);

DELETE FROM public.participants WHERE id IN (
    '286354ad-06d7-4930-9777-25c56218abfd',
    'd5cee8b1-b2cc-44de-96a9-f6fdb2f6c691',
    '2df78522-ed2a-4240-9f63-a2e2436cb6e5',
    '17c5c5b2-b6bd-446c-b772-a595b4692b3a',
    '8c0b33d2-c8b7-468e-8af4-c8254c1bbee3',
    '90619077-b1d4-4d90-8b11-63e04b9a5c71',
    '20f5b07e-e419-49cd-9bad-4812974505a2',
    '60a8bda8-1b5d-4e86-a5ea-f5c037641ced',
    'd18cae46-1aa0-4b44-8091-a19b2569bca3',
    '436bdb1c-7058-434f-b9fd-0d7047c5fd43',
    '8406ec1f-21ef-4c20-9acf-6c083456ab47',
    'a713196b-11ab-4e20-867e-e6bf0abb618f',
    '078188a1-8048-470c-abf3-154448b765ab',
    '0b0c9ed1-aad6-40f8-a2a8-3c3fccaf994a',
    '11b8b754-c8e3-4806-b3d1-803f03962fb5',
    '308220db-d5bb-45bd-9ff7-b124877c4bd0',
    'dc195020-b6f8-404f-b228-031d9e3befc9',
    '8b651634-7db2-4798-b1a0-d2102f69ba8d',
    '56bcde38-7799-46cd-a270-5aac450956cc',
    'fa555a4b-d4b2-4e64-9094-d89271fe1224'
);

COMMIT;
