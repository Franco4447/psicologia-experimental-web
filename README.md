# Experimento de Psicología Experimental - Universidad Favaloro

Este repositorio contiene la plataforma web diseñada para un experimento de Psicología Experimental sobre la inducción de falsas memorias.

**URL en vivo:** [https://psicologia-experimental-web.vercel.app](https://psicologia-experimental-web.vercel.app)

---

## 1. Visión General del Proyecto

Esta es una plataforma web desarrollada para llevar a cabo un estudio psicológico experimental sobre la inducción de falsas memorias. Los participantes son asignados a uno de tres grupos:
- **Racional** (inducción racional)
- **Emocional** (inducción emocional)
- **Control** (sin inducción particular / neutro)

Durante el experimento, a cada participante se le presentan **20 estímulos (noticias)**. Después de cada lectura, los participantes evalúan la noticia utilizando una escala de memoria tipo Murphy & León de 4 puntos.

---

## 2. Arquitectura de la Aplicación

La aplicación está construida con:
- **Framework:** Next.js 14 (App Router) + TypeScript
- **Estilos:** Tailwind CSS
- **Base de Datos:** Supabase (PostgreSQL)
- **Despliegue:** Vercel (Serverless)

### Flujo del Experimento y Máquina de Estados
El progreso del experimento se maneja completamente en el lado del cliente utilizando un modelo de **máquina de estados** administrado por `useReducer`.
El flujo de pantallas (`screen flow`) es estrictamente secuencial:
1. `Welcome` (Bienvenida)
2. `Consent` (Consentimiento Informado)
3. `Demographics` (Datos Demográficos)
4. `Induction` (Inducción del grupo correspondiente)
5. `StimulusReading` (Lectura del estímulo) ➔ `Rating` (Evaluación) × 20 iteraciones (Una por cada estímulo)
6. `Debriefing` (Explicación final)
7. `ThankYou` (Agradecimiento)

### Sync Manager y Persistencia Offline
La arquitectura incorpora un `SyncManager` que se encarga de guardar las respuestas. Las evaluaciones no bloquean el progreso del participante, ya que se usan buffers en el cliente (offline buffering). Las respuestas se encolan y se envían a la base de datos de manera asíncrona mediante las API Routes de Next.js, mitigando problemas de red durante la sesión de un participante.

---

## 3. Estructura de Directorios y Archivos Importantes

El código principal se encuentra en el directorio `src/` y `supabase/`. Cada archivo juega un rol específico en la arquitectura:

- `src/app/page.tsx`: Punto de entrada principal (Client Component), inicializa el proveedor de estado global `ExperimentProvider`.
- `src/app/api/session/route.ts`: Endpoints POST y PATCH para iniciar y finalizar la sesión de los participantes (utiliza `SUPABASE_SERVICE_ROLE_KEY` para superar restricciones RLS).
- `src/app/api/responses/route.ts`: Endpoint POST encargado de la inserción en bloque (bulk insert) de respuestas enviadas por el `SyncManager`.
- `src/app/admin/page.tsx` y `api/admin/*`: Interfaz del dashboard y rutas protegidas por `ADMIN_PASSWORD` para métricas y exportación a CSV.
- `src/components/*Screen.tsx`: Vistas individuales del experimento (`WelcomeScreen`, `ConsentScreen`, `DemographicsScreen`, `InductionScreen`, `StimulusReadingScreen`, `RatingScreen`, `DebriefingScreen`, `ThankYouScreen`).
- `src/lib/experimentState.ts`: Lógica de la máquina de estados implementada con `useReducer`, que maneja todas las transiciones del flujo del experimento.
- `src/lib/sync.ts`: Define el `SyncManager`, responsable del encolado local (offline buffering), reintentos y envío de datos en lotes a los endpoints, mitigando problemas de conexión.
- `src/lib/supabase.ts`: Cliente de inicialización Supabase y un `InMemoryMockStore` utilizado para desarrollo local en ausencia de conexión a la nube.
- `src/types/experiment.ts`: Definición de interfaces y DTOs críticos (tipado estricto) compartidos entre el frontend y los esquemas de la base de datos.
- `src/data/stimuli.ts`: Contiene el banco de los 20 estímulos codificados en duro (noticias verdaderas y falsas).
- `supabase/schema.sql`: Definición DDL (Data Definition Language) de las tablas (`participants`, `responses`), las reglas de Row Level Security (RLS) y las funciones RPC (`assign_induction_group`, `create_participant_session`).
- `playwright.config.ts`, `tests/`, `e2e/`: Configuración y suite de pruebas automatizadas End-to-End para validar la robustez (Tiers 1 a 4).

---

## 4. Configuración de Supabase

El proyecto está conectado a un proyecto Supabase (PostgreSQL), referencia de proyecto: `incipxmbzxpzbgwinalp` (región: `us-east-1`).

### Tablas Principales
- **`participants`**: Almacena ID del participante, datos demográficos, grupo asignado, marcas de tiempo y estado.
- **`responses`**: Almacena las evaluaciones individuales para cada uno de los 20 estímulos, asociadas al ID del participante.

### Funciones RPC (Remote Procedure Calls)
- **`assign_induction_group`**: Asigna un grupo (Racional, Emocional, Control) manteniendo balanceados los grupos en la base de datos de manera atómica para prevenir condiciones de carrera.
- **`create_participant_session`**: Registra al participante al momento de aceptar el consentimiento.

### Row Level Security (RLS)
Las políticas de seguridad a nivel de fila (RLS) están configuradas para que:
- La clave anónima (`anon key`) permita la inserción (insert) de participantes y respuestas de manera anónima, pero no su edición posterior ni lectura de datos de otros.
- La lectura completa y administración se reserva para roles con permisos (como los endpoints de Next.js usando `SERVICE_ROLE_KEY`).

### Cómo aplicar el schema
Para inicializar la base de datos desde cero, puedes correr el código SQL en el panel web de Supabase SQL Editor o usar la CLI:
```bash
supabase link --project-ref incipxmbzxpzbgwinalp
supabase db push
```
El archivo de esquema completo está disponible (ej. `schema.sql`).

---

## 5. Variables de Entorno

Para que la aplicación funcione, es necesario configurar las siguientes variables de entorno. Hay un archivo `.env.example` en el repositorio para usar de plantilla.

- `NEXT_PUBLIC_SUPABASE_URL`: La URL del proyecto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: La clave pública para uso seguro desde el cliente.
- `SUPABASE_SERVICE_ROLE_KEY`: La clave privada con privilegios totales (requerida por las APIs y NUNCA exponer en el frontend).
- `ADMIN_PASSWORD`: La contraseña para acceder al panel `/admin`.

---

## 6. Despliegue en Vercel

El proyecto está configurado para integración y despliegue continuo (CI/CD) a través de Vercel.
- **Auto-Deploy**: Cualquier *push* o *merge* a la rama `main` de GitHub (`https://github.com/Franco4447/psicologia-experimental-web.git`) desencadenará automáticamente un despliegue en Vercel.
- **Funciones Serverless**: Los endpoints en `/app/api` corren como Serverless Functions. Debido a que son transitorios, el encolado (`SyncManager`) del lado del cliente es esencial.
- **Configuración de Variables de Entorno**: Las variables mencionadas en el punto anterior DEBEN cargarse en el panel de Vercel (Project Settings > Environment Variables) antes del despliegue.

---

## 7. Rutas de la API

La aplicación cuenta con endpoints dedicados en `src/app/api`:

- **`POST /api/session`**: Crea la sesión del participante en Supabase e invoca las RPC de asignación.
- **`PATCH /api/session`**: Actualiza el progreso y finaliza la sesión de un participante en la tabla `participants`.
- **`POST /api/responses`**: Recibe las respuestas y valoraciones (ratings) provenientes del SyncManager y las inserta masivamente en `responses`.
- **Rutas `/api/admin/*`**: Endpoints protegidos para solicitar métricas globales y exportar datos.

---

## 8. Flujo de Datos (Data Flow)

De principio a fin, el recorrido de un dato es el siguiente:
1. El usuario interactúa (por ejemplo, da su consentimiento o evalúa una noticia).
2. El **Cliente** dispara una acción hacia la máquina de estados local administrada por `useReducer`.
3. El estado global del frontend se actualiza de inmediato para no bloquear la pantalla y mostrar la siguiente vista.
4. Paralelamente, el **SyncManager** captura el evento o la respuesta y lo añade a su cola local en memoria (buffer).
5. El SyncManager hace *fetch* hacia las **API Routes** (`/api/session` o `/api/responses`) usando peticiones por lotes.
6. La API route de Next.js (serverless) usa `@supabase/supabase-js` para inyectar los datos en las tablas de PostgreSQL (Supabase) bajo el rol adecuado.

---

## 9. Panel de Administración (Admin Dashboard)

El proyecto incluye un dashboard de monitoreo en **`/admin`**.
- Se requiere introducir la contraseña definida en la variable de entorno `ADMIN_PASSWORD`.
- **Funciones:**
  - Visualizar la cantidad de participantes completados versus desertores.
  - Ver el balance de los grupos asignados (Control, Emocional, Racional).
  - Exportación: Contiene un botón para generar y descargar un archivo **CSV** consolidado (Export CSV) listo para ser procesado estadísticamente (ej. en SPSS, R o JASP).

---

## 10. Problemas Conocidos y Lecciones Aprendidas

Durante el desarrollo se solventaron varios bugs críticos, cuyo conocimiento es clave para el mantenimiento futuro:

- **Desajuste del campo `participantId` (Causa Raíz Principal)**: El módulo `sync.ts` del cliente enviaba el UUID del participante en un campo llamado `participantId`, pero la API del servidor (`POST /api/session`) solo buscaba un campo llamado `id`. El servidor, al no encontrar `id`, generaba un UUID completamente nuevo y guardaba al participante bajo ese UUID "fantasma". Cuando luego el cliente enviaba las respuestas con su UUID original, Supabase las rechazaba por violación de clave foránea (FK constraint). El servidor tragaba silenciosamente el error, devolvía un falso HTTP 201 (éxito), y el cliente borraba los datos de su cola local creyendo que se habían guardado. **Solución:** Se modificó el servidor para aceptar tanto `id` como `participantId` del payload. **Lección:** Siempre verificar que los nombres de campo del payload del cliente coincidan exactamente con los que espera el servidor, y nunca devolver un éxito falso cuando una operación de base de datos falla.
- **Restricciones de RLS (Upsert vs Insert con anon_key)**: La operación `upsert` requiere permisos de UPDATE además de INSERT. Como el rol `anon` solo tiene permiso de INSERT en las políticas RLS, los upserts fallaban silenciosamente. **Solución:** Se cambió a `insert` puro con manejo de errores de duplicados (código 23505).
- **Bug de dependencia en `useCallback` en barra de progreso**: El componente `StimulusReadingScreen` listaba `handleFinish` (un `useCallback`) como dependencia del `useEffect` que controla el timer. Como `page.tsx` pasa funciones inline como props, React las recreaba en cada render → `handleFinish` cambiaba → el efecto se reiniciaba → `performance.now()` se reseteaba → la barra quedaba en 0%. **Solución:** Se almacenan los callbacks en `useRef` y el efecto del timer depende únicamente de `[imageLoaded]`.
- **MockStore ocultando errores en producción**: Cuando Supabase rechazaba una inserción, el servidor guardaba en un `InMemoryMockStore` temporal y devolvía HTTP 201 (éxito). En Vercel (serverless), ese mockStore se destruye con cada cold start, perdiendo los datos irreversiblemente. **Solución:** El servidor ahora devuelve HTTP 500 cuando Supabase falla, forzando al cliente a reintentar con backoff exponencial en vez de borrar los datos.

---

## 11. Desarrollo Local

Para correr el proyecto localmente en tu entorno de desarrollo:

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/Franco4447/psicologia-experimental-web.git
   cd web-experimento
   ```
2. **Instala dependencias:**
   ```bash
   npm install
   ```
3. **Configura el entorno:**
   - Copia `.env.example` a `.env.local`
   - Rellena las claves con tus datos de Supabase.
   ```bash
   cp .env.example .env.local
   ```
4. **Ejecuta el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   El servidor arrancará típicamente en [http://localhost:3000](http://localhost:3000).

---

## 12. Pautas de Contribución y Desarrollo Futuro

Para futuros desarrollos y mantenimiento del proyecto, por favor seguir las siguientes reglas:

- **Cuidado con el Estado del Experimento**: Nunca mutar el estado global directamente. Siempre generar un despacho (`dispatch`) de una acción válida según la tipificación del estado de React.
- **Tipado estricto**: Mantener un esquema fuerte de TypeScript. Todo DTO que conecte la API con el Frontend debe estar claramente tipado en los tipos compartidos.
- **Migraciones de Base de Datos**: No realizar cambios "en caliente" (hot edits) en el schema desde el panel de Supabase. Escribir migraciones SQL y testearlas.
- **Evitar la sobrecarga del Cliente**: Mantener todo procesamiento pesado y conexión a la base de datos desde los serverless endpoints, para asegurar que equipos de bajos recursos o conexiones inestables no sufran trabas en la UI.
