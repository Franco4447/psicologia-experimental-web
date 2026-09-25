# Flujo del Experimento: Inducción de Falsas Memorias

El siguiente diagrama detalla el recorrido exacto de un participante a través de la plataforma, ilustrando las etapas de recolección de datos, la intervención (inducción) y la fase de medición con sus reglas de tiempo.

```mermaid
flowchart TD
    %% Estilos
    classDef inicio fill:#e2e8f0,stroke:#64748b,stroke-width:2px;
    classDef backend fill:#fef08a,stroke:#ca8a04,stroke-width:2px;
    classDef induccion fill:#fed7aa,stroke:#ea580c,stroke-width:2px;
    classDef estimulo fill:#bfdbfe,stroke:#2563eb,stroke-width:2px;
    classDef final fill:#bbf7d0,stroke:#16a34a,stroke-width:2px;

    %% Nodos
    A([1. Welcome Screen]) ::: inicio
    B([2. Consent Screen]) ::: inicio
    C([3. Demographics Screen]) ::: inicio
    
    DB1[(Supabase:\nCrear Participante)] ::: backend

    D{4. Asignación Aleatoria\nRPC Automático} ::: backend
    
    E1[Grupo Racional] ::: induccion
    E2[Grupo Emocional] ::: induccion
    E3[Grupo Control] ::: induccion
    
    F[Consigna Introductoria\n+ Caja de Texto] ::: induccion
    G{¿Escribió > 50 caracteres?} ::: induccion
    
    H[[5. Bucle de 20 Noticias]] ::: estimulo
    I[Pantalla: Lectura de Noticia\nTiempo: 15s obligatorios] ::: estimulo
    J[Pantalla: Rating Murphy & León\nTiempo: Ilimitado] ::: estimulo
    
    DB2[(Supabase:\nGuardar Respuestas\n+ Latencia)] ::: backend

    K([6. Debriefing Screen]) ::: final
    L([7. Thank You Screen]) ::: final

    %% Conexiones
    A --> B
    B --> C
    C --> DB1
    DB1 --> D
    
    D -->|Asignación balanceada| E1
    D -->|Asignación balanceada| E2
    D -->|Asignación balanceada| E3
    
    E1 --> F
    E2 --> F
    E3 --> F
    
    F --> G
    G -->|No| F
    G -->|Sí, botón habilitado| H
    
    H --> I
    I -->|Al pasar 15s| J
    J -->|Siguiente Noticia| H
    
    J -.->|Sync Offline| DB2
    
    H ====>|Termina la 20va| K
    K --> L
```

### Explicación de las fases clave:

1. **Fase de Preparación (Gris):** El participante acepta el consentimiento y llena sus datos. En este momento, la aplicación se comunica con Supabase para registrarlo.
2. **Fase de Intervención (Naranja):** El servidor asigna un grupo asegurando que la muestra quede dividida en 3 tercios iguales. El usuario ve la consigna, reflexiona y redacta. El flujo se bloquea hasta que demuestre compromiso (Compliance).
3. **Fase de Medición (Azul):** El *loop* central. Lectura pasiva forzada (Sistema 1) seguida por la medición de la memoria donde el tiempo que se toma en responder (Latencia) revelará si la inducción naranja surtió efecto cognitivo.
4. **Fase de Sincronización (Amarillo):** Todo ocurre en segundo plano (SyncManager) para que si al usuario se le corta el WiFi, el bucle azul no se congele.
