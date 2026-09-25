# Reporte de Validación Teórica del Experimento

A continuación se presenta un análisis detallado y corregido de la implementación del experimento en la plataforma web (`web-experimento`), contrastando exhaustivamente el código con los artículos empíricos de referencia: León et al. (2023) y Martel et al. (2020).

**Advertencia:** Este reporte corrige deficiencias graves encontradas en una revisión previa, la cual pasó por alto errores críticos en el diseño metodológico de la aplicación web.

## 1. Validación de la Inducción Cognitiva (Basado en Martel et al., 2020)

El estudio de Martel et al. (2020) manipula la dependencia de la emoción frente a la razón. Al revisar `src/components/InductionScreen.tsx`, observamos lo siguiente:

- **Textos de Inducción (Racional y Emocional):** La traducción y adaptación de las consignas ("Mucha gente cree que la razón/emoción conduce a una buena toma de decisiones...") es **exacta** y respeta fielmente el paradigma de Martel et al.
- **Grupo Control y Contexto:** En el estudio de Martel et al., la oración introductoria ("You will be presented with a series of actual news headlines from 2017–2018. We are interested in your opinion about whether the headlines are accurate or not.") se presentaba a **todos los grupos** antes de la inducción específica (excepto en su primer experimento). En nuestra implementación, esta frase de contexto solo se muestra al **grupo control**. Si bien `WelcomeScreen.tsx` da un contexto general, no incluye esta especificación temporal y de precisión, por lo que los grupos experimentales pierden esa leve contextualización inicial. 

## 2. Validación de la Escala de Memoria y Tiempos (Basado en León et al., 2023)

- **La Escala:** La escala de 4 puntos definida en `src/data/stimuli.ts` y mostrada en `RatingScreen.tsx` traduce de manera perfecta las opciones originales de León et al. ("Recuerdo claramente...", "No recuerdo haberlo visto, pero creo que sucedió", "Lo recuerdo diferente", "No lo recuerdo en absoluto"). La clasificación de `isFalseMemory` y `isFalseBelief` (opciones 1 y 2 respectivamente ante noticias falsas) es metodológicamente impecable.
- **Discrepancia Temporal Crítica:** 
  - *Paper Original:* León et al. presentaban la imagen y daban al participante **30 segundos como máximo** para responder ("participants had to choose within 30 s one of the following options").
  - *Implementación Web:* Se separó el proceso en dos fases. En `StimulusReadingScreen.tsx` se obliga al sujeto a una exposición pasiva ininterrumpida de **15 segundos**. Luego, en `RatingScreen.tsx`, el usuario dispone de **tiempo ilimitado** para seleccionar la respuesta. Esto elimina la presión de tiempo del diseño original y añade una carga de exposición que no existía.

## 3. Diseño de Estímulos y Efecto de Congruencia (Basado en León et al., 2023) - **ERROR CRÍTICO EN LA LÓGICA**

La revisión anterior afirmó erróneamente que la asignación de estímulos replicaba "a la perfección" el paradigma de congruencia ideológica de León et al. Esto es **falso**; la implementación actual rompe por completo el diseño del paper original.

- **Diseño Original (León et al.):** Los investigadores utilizaron 8 noticias falsas por sujeto, divididas en **4 contra el Psicoanálisis y 4 contra la TCC (Prácticas Basadas en Evidencia)**. Esto permitía un diseño "intra-sujeto" (within-subjects): a un mismo participante psicoanalista se le medía cuántas falsas memorias generaba ante las 4 noticias congruentes (anti-TCC) comparado con las 4 noticias incongruentes (anti-Psicoanálisis).
- **Implementación Web (`stimuli.ts`):** La función `getParticipantNewsDeck` le asigna al participante **8 noticias falsas 100% congruentes** con su postura. Por ejemplo, si el sujeto es de Psicoanálisis, la variable `selectedFakeIds` toma los 8 ítems de `PSA_CONGRUENT_FAKE_IDS` (que atacan a la TCC). 
- **Consecuencia:** Al no mostrarle **ninguna** noticia incongruente, es **estadísticamente imposible** medir el "Efecto de Congruencia" dentro del sujeto. El experimento medirá falsos recuerdos en general, pero no podrá hacer la comparativa intra-sujeto ("¿cayó más en las afines que en las contrarias?") que es el núcleo central (Fig. 3B) del estudio de León et al.

## 4. Consideraciones Éticas y Disclaimer

León et al. aplicaron el mecanismo de inoculación ("Disclaimer") 7 días después del experimento inicial, previo a una tarea de revisión. 
En nuestra implementación, el componente `DebriefingScreen.tsx` incluye de manera muy correcta y explícita la advertencia de que 8 titulares eran falsos justo al terminar la sesión. Dado que nuestro diseño es de sesión única, esta adaptación metodológica es adecuada y éticamente sólida.

---

## Remaining Questions & Gaps (Gaps Finales)

1. **Diseño de Estímulos (Urgente):** La función `getParticipantNewsDeck` en `src/data/stimuli.ts` **debe** modificarse antes del despliegue. En lugar de asignar 8 noticias congruentes, debe seleccionar un set balanceado (Set 1 o Set 2) que contenga 4 noticias anti-Psicoanálisis y 4 anti-Evidencia, independientemente de la afinidad del participante, para poder medir la diferencia intra-sujeto.
2. **Restricciones Temporales:** ¿Debe mantenerse la separación entre exposición (15s) y evaluación (ilimitada)? Si se desea replicar estrictamente a León et al., se debería eliminar la pantalla de lectura forzada, unificar la imagen con las opciones de respuesta y programar un temporizador automático que agote el tiempo a los 30 segundos.
3. **Frase de Contexto de Martel:** ¿Se debería mover la frase "A continuación se le presentará una serie de titulares reales..." a `WelcomeScreen.tsx` para que aplique de base a todos los participantes antes de leer su inducción específica?
