# Psicología Experimental - Parcial 2 - Plataforma Web

## Configuración del Entorno Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   Copiar `.env.example` a `.env.local` y llenar con sus credenciales de Supabase.
   
3. Configurar la base de datos Supabase:
   Correr el script ubicado en `supabase/schema.sql` en el SQL Editor de su proyecto de Supabase.

4. Ejecutar localmente:
   ```bash
   npm run dev
   ```

## Deploy en Vercel

1. Crear un proyecto en Vercel y enlazar el repositorio.
2. Configurar las mismas variables de entorno que se encuentran en `.env.example`.
3. El archivo `vercel.json` ya está preparado, Vercel detectará el framework de Next.js automáticamente.
4. El archivo `.github/workflows/deploy.yml` está preparado para despliegues continuos opcionales desde GitHub.
