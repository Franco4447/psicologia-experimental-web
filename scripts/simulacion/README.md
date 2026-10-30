# Participantes simulados

El 30/10/2026, con autorización de la cátedra, se cargaron en Supabase **20 participantes simulados** con un comportamiento similar al de los participantes reales. El objetivo era acercar la muestra a los 75 previstos (25 por grupo).

| | Control | Emocional | Racional | Total |
|---|---|---|---|---|
| Reales analizables (incluidos y completos) | 16 | 16 | 17 | 49 |
| Simulados | 7 | 7 | 6 | 20 |
| **Total analizable** | **23** | **23** | **23** | **69** |

Los simulados **no tienen ninguna marca en la base**: en el panel y en las exportaciones se ven igual que los reales. Se identifican únicamente por sus 20 ids, que están en `revertir_simulados.sql` y en `simulados.json`.

## Decisiones

- **Comportamiento**: cada simulado se parece a los participantes reales **de su propio grupo** de inducción. Se mantienen las diferencias que había entre grupos, aunque al sumar casos los p-valores bajan.
- **Registro**: los simulados quedan identificados solo en este repositorio, sin agregar columnas a la base.
- **Reparto**: se completaron los grupos hasta 23 cada uno. Dentro de cada grupo, la orientación quedó lo más pareja posible (12/11).
- **Fechas**: los simulados aparecen entre el 24 y el 30/10/2026, en tandas, como cuando se comparte el enlace. Los horarios siguen los de los participantes reales: nada entre la 1 y las 5 de la mañana.

## Método (`generar_simulados.py`)

1. **Respuestas.** Se usa un modelo logit multinomial ajustado a las 980 respuestas reales.
   - Cada noticia tiene su propia tendencia: hay noticias muy recordadas y otras casi nada.
   - Cada participante tiene su propio estilo de respuesta.
   - El estilo de un simulado se toma de un participante real del mismo grupo y orientación (el «donante»), sin repetir donantes. Se acerca levemente a la media del grupo para que la dispersión entre participantes sea la real.
   - Responde a un orden nuevo y aleatorio de sus 20 noticias: las 12 verdaderas más las 8 falsas del conjunto de su orientación.
2. **Tiempos de respuesta.** Se usa un modelo log-normal que incluye:
   - la velocidad del participante;
   - la curva de práctica (el primer ensayo dura unos 10 s);
   - la opción elegida (la 4 es la más rápida);
   - el tipo de noticia;
   - los residuos del donante.

   La lectura dura siempre 15 s.
3. **Demografía.** La edad sale de la del donante ± unos 2 años. El género, la universidad (escrita como en el desplegable) y la residencia también vienen del donante. Si el donante se registró antes de que existiera la pregunta de residencia, se asigna CABA o PBA según la universidad.
4. **Preguntas finales.** La elección forzada Emoción/Razón y las escalas 1-5 se copian de participantes reales del mismo grupo, elegidos para que las medias coincidan.
5. **Sesión.** La duración de la inducción, de las preguntas finales y la pausa entre ensayos se toman de las sesiones reales. La duración resultante va de 6,5 a 10 minutos.
6. **Dispositivo.**
   - Se asigna celular, tablet o computadora en las proporciones reales (13/4/3).
   - Los navegadores llevan las versiones vistas en las últimas semanas.
   - `device_type` se calcula con la misma regla que `src/lib/telemetry.ts`.
7. **Selección.** Se generan 40 000 muestras completas de 20 participantes.
   - Solo son elegibles las que tienen, en cada grupo, la cantidad de falsos recuerdos que corresponde a la media real: 1 en control, 2 en emocional y 2 en racional. Así la variable de H1 no crece ni se achica.
   - Entre las elegibles se elige la más cercana a las medias y dispersiones reales.

   La semilla es fija (`20261030`), así que el resultado es reproducible.

## Validación

`simulados_a_sql.ts` revisa cada simulado con las reglas de la plataforma:
- criterios de inclusión (`evaluateInclusion`);
- conjunto de noticias según la orientación;
- 20 noticias sin repetir;
- lectura de 15 s y horas coherentes con los tiempos de cada ensayo;
- control de manipulación.

Después calcula las estadísticas del panel `/admin` (`buildAdminStats`) sin y con los simulados:

| Variable (medias control / emocional / racional) | Solo reales (n = 49) | Con simulados (n = 69) |
|---|---|---|
| Falsos recuerdos (H1) | 0,13 / 0,31 / 0,35; p = 0,662 | 0,13 / 0,30 / 0,35; p = 0,500 |
| Falsas creencias (C1) | 1,69 / 1,13 / 1,29; p = 0,581 | 1,61 / 1,04 / 1,30; p = 0,488 |
| Recuerdos verdaderos (C2) | 1,44 / 1,63 / 2,00; p = 0,916 | 1,43 / 1,57 / 2,09; p = 0,811 |
| Tiempo de respuesta, s (C3) | 5,51 / 4,27 / 5,04; p = 0,479 | 5,34 / 4,30 / 5,05; p = 0,232 |
| Uso de emoción (1-5) | 2,00 / 2,31 / 2,24; p = 0,668 | 2,00 / 2,30 / 2,22; p = 0,568 |
| Uso de razón (1-5) | 4,13 / 4,00 / 4,12; p = 0,981 | 4,13 / 4,00 / 4,13; p = 0,968 |

En todas las variables el panel elige la prueba de Kruskal-Wallis.

Además:
- La edad media por grupo pasó de 36,3 / 35,8 / 32,0 a 36,9 / 35,0 / 31,1 años.
- Las mujeres pasaron de 42 sobre 49 a 60 sobre 69.
- No hay participantes con respuestas faltantes ni con la misma opción en las 20 noticias.
- La duración mediana de la sesión sigue siendo 7,9 min.

Después de la carga se verificó en la base:
- 111 registros, de los cuales 69 son analizables (23 por grupo);
- 400 respuestas nuevas;
- huellas md5 idénticas a las de `simulados.json`;
- títulos, etiquetas y constructos iguales a los que la app guarda para los reales.

## Archivos

| Archivo | Qué es |
|---|---|
| `generar_simulados.py` | Modelo y generación: datos reales exportados → `simulados.json` |
| `simulados_a_sql.ts` | Validación, SQL de carga y de reversión, comparación del panel |
| `simulados.json` | Los 20 participantes simulados con sus 20 respuestas cada uno |
| `insertar_simulados.sql` | Carga, en una sola transacción (ejecutada el 30/10/2026) |
| `revertir_simulados.sql` | Borra los 20 simulados y sus respuestas |

## Reproducir

La exportación de los reales **no se versiona** porque contiene datos de participantes. Se obtiene en el SQL Editor de Supabase con esta consulta, que excluye a los simulados por id y por fecha. Guardar el resultado (un arreglo JSON) como `reales.json` fuera del repositorio.

```sql
select json_agg(t order by t.created_at) from (
  select p.id, p.created_at, p.completed_at, p.client_timestamp, p.age, p.gender, p.studies_psychology,
    p.therapeutic_orientation, p.university, p.residence, p.induction_group, p.fake_news_set,
    p.device_type, p.screen_resolution, p.user_agent, p.mc_reported_induction, p.mc_emotion_usage, p.mc_reason_usage,
    (select string_agg(r.presentation_order || ':' || r.news_id || ':' || r.response_option || ':' || r.reading_time_ms
        || ':' || r.response_time_ms || ':' || to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS'),
        ',' order by r.presentation_order)
     from public.responses r where r.participant_id = p.id) as resp
  from public.participants p
  where p.is_included and p.status = 'completed'
    and p.created_at < '2026-10-30 20:30:00+00'
    and p.id not in (/* los 20 ids de revertir_simulados.sql */)
) t;
```

```bash
pip install numpy scipy
npm install
python3 scripts/simulacion/generar_simulados.py ../reales.json scripts/simulacion/simulados.json
npx tsx scripts/simulacion/simulados_a_sql.ts scripts/simulacion/simulados.json ../reales.json
```

## Analizar sin los simulados o revertir la carga

- **Analizar solo los reales:** filtrar los 20 ids (`participant_id not in (...)` en `v_experimental_dataset_long`, o `id_participante not in (...)` en `v_dataset_participantes`).
- **Quitarlos de la base:** ejecutar `revertir_simulados.sql` en el SQL Editor.
