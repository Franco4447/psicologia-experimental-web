# Validación Teórica y Metodológica del Diseño Experimental

Este documento valida las decisiones de diseño metodológico cruzando las bases argumentales del proyecto con la literatura empírica y teórica seleccionada.

## 1. Diseño de los Estímulos: 100% Congruencia Ideológica

**Estado de la Decisión:** ✅ VÁLIDA Y FUNDAMENTADA

### Análisis de la Literatura
* **León et al. (2023) [emp 1]:** En su diseño intra-sujeto (mitad congruente, mitad incongruente), los autores señalaron explícitamente que no observaron que el efecto de congruencia modificara de forma aislada la tasa de falsas memorias esperada.
* **Murphy et al. (2021) [emp 5]:** Demostraron empíricamente que la exposición a fake news que se alinean fuertemente con las actitudes preexistentes de los individuos (congruencia) es un predictor robusto para la susceptibilidad y formación de falsas memorias.

### Argumento Sólido de Defensa
La decisión de someter a los participantes a una batería de estímulos 100% congruentes con su ideología previa es metodológicamente superior para los objetivos de este estudio en particular. Si se utilizara un diseño mixto (intra-sujeto), el "ruido" cognitivo generado por el rechazo automático a los estímulos incongruentes diluiría el impacto cognitivo de la verdadera Variable Independiente: la inducción del procesamiento Racional vs. Emocional. Al garantizar un 100% de congruencia, el experimento asegura una alta tasa basal de susceptibilidad (evitando el efecto suelo), permitiendo que cualquier diferencia estadísticamente significativa en la tasa de falsas memorias entre los tres grupos experimentales sea atribuible puramente al modo de procesamiento inducido (Sistema 1 vs Sistema 2), aislando la variable de interés.

---

## 2. Cronometría: 15s Lectura Obligatoria + Tiempo de Respuesta Ilimitado

**Estado de la Decisión:** ✅ VÁLIDA Y FUNDAMENTADA

### Análisis de la Literatura
* **Bago, Rand & Pennycook (2020) [emp 6]:** En la investigación sobre la psicología de las fake news, se establece que el pensamiento deliberativo (Sistema 2) requiere la ausencia de constricciones temporales severas. Su paradigma de dos respuestas demuestra que la deliberación genuina florece cuando se elimina la presión de tiempo.

### Argumento Sólido de Defensa
La arquitectura de tiempos dividida (15 segundos forzados seguidos de tiempo libre) operativiza de manera impecable el modelo de procesamiento dual.
1. **Los 15 segundos forzados de lectura:** Garantizan el anclaje inicial de la información, obligando al participante a procesar el estímulo sin poder escapar por impulsividad.
2. **El tiempo ilimitado en la evaluación:** Eliminar el techo de 30 segundos (presente en estudios más rígidos) es crucial porque permite utilizar la **latencia de respuesta** como una métrica conductual del nivel de deliberación. Si la inducción "Racional" es efectiva, debería reflejarse empíricamente en tiempos de respuesta (rating) más largos en comparación con el grupo "Emocional". Un techo de tiempo truncaría artificialmente esta distribución de datos, ocultando la latencia natural de deliberación de los sujetos.

---

## 3. Plan de Implementación: Consignas de Inducción

Para garantizar que los participantes internalicen la inducción sin fricciones, se propone la siguiente refactorización de `InductionScreen.tsx`:

### Modificaciones en la UI/UX
1. **Texto Introductorio Contextual:** Añadir a los grupos experimentales una frase ancla: *"Queremos entender cómo las personas analizan la información. Por favor, escriba al menos 2 oraciones..."*
2. **Caja de Texto Activa (Textarea):** Incorporar un campo de texto amplio que invite a la reflexión.
3. **Validación en Tiempo Real:** 
   - Mostrar un contador de caracteres dinámico (Ej: `Caracteres: 12 / 50 mínimo`).
   - El botón de avanzar a los estímulos permanecerá deshabilitado (gris y no clickeable) hasta que el sujeto cumpla el requisito mínimo de escritura, asegurando el cumplimiento (compliance) de la inducción.

### Implicaciones de Backend
* Modificar el estado local (`ExperimentState`) y `sync.ts` para capturar el texto escrito por el usuario.
* Agregar una columna `induction_text` en la tabla `participants` de Supabase para almacenar la respuesta, permitiendo análisis cualitativos posteriores (ej. verificar qué tan en serio tomaron la consigna).
