import { test, expect } from '@playwright/test';

test.describe('Participant Experiment Flow & State Machine', () => {
  test('Completes full experiment journey: Welcome -> Consent -> Demographics -> Induction -> Stimulus -> Rating -> Next Trial', async ({
    page,
  }) => {
    // 1. Welcome Screen
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Investigación sobre Percepción y Evaluación de Titulares/i })
    ).toBeVisible();
    await expect(page.getByText('Universidad Favaloro · Facultad de Psicología')).toBeVisible();

    const startBtn = page.getByRole('button', { name: /Comenzar Experimento/i });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // 2. Consent Screen
    await expect(
      page.getByRole('heading', { name: /Formulario de Consentimiento Informado/i })
    ).toBeVisible();

    const continueConsentBtn = page.getByRole('button', { name: /Continuar a Datos Demográficos/i });
    await expect(continueConsentBtn).toBeDisabled();

    // Check mandatory consent
    await page.locator('#consent-checkbox').check();
    await expect(continueConsentBtn).toBeEnabled();
    await continueConsentBtn.click();

    // 3. Demographics Screen
    await expect(
      page.getByRole('heading', { name: /Cuestionario Demográfico y Académico/i })
    ).toBeVisible();

    // Fill Demographics
    await page.fill('#age-input', '23');
    await page.locator('label', { hasText: 'Femenino' }).click();
    await page.locator('label', { hasText: /^Sí$/ }).click();
    await page.locator('label', { hasText: 'Psicoanálisis' }).click();
    await page.fill('#university-input', 'Universidad Favaloro');

    // Submit Demographics
    const submitDemographicsBtn = page.getByRole('button', {
      name: /Continuar a las Instrucciones/i,
    });
    await submitDemographicsBtn.click();

    // 4. Induction Screen
    await expect(
      page.getByRole('heading', { name: /Pautas.*Evaluación/i })
    ).toBeVisible();
    await expect(page.getByText(/Instrucciones: Modo de Procesamiento/i)).toBeVisible();

    const acknowledgeInductionBtn = page.getByRole('button', {
      name: /Comenzar Evaluación de Titulares/i,
    });
    await acknowledgeInductionBtn.click();

    // 5. Reading Phase (Trial 1)
    await expect(page.getByText(/Fase de Lectura/i)).toBeVisible();
    await expect(page.getByText(/Noticia 1 de 20/i)).toBeVisible();

    const progressBar = page.getByRole('progressbar');
    await expect(progressBar).toBeVisible();

    // Verify live countdown readout is present
    await expect(page.getByText(/restantes/i)).toBeVisible();

    // Wait for exposure completion (15 seconds + buffer for rendering/animation)
    // The reading screen automatically transitions to rating upon timer completion
    await expect(
      page.getByRole('heading', { name: /¿Recuerda haber visto o leído este evento con anterioridad?/i })
    ).toBeVisible({ timeout: 30000 });

    // 6. Rating Phase (Trial 1)
    await expect(page.getByText(/Evaluación de Memoria/i)).toBeVisible();

    // Select Option 1 (Murphy & León Scale)
    await page.locator('text=Recuerdo claramente haber visto/leído este evento').click();

    const advanceBtn = page.getByRole('button', { name: /Siguiente noticia/i });
    await expect(advanceBtn).toBeEnabled();
    await advanceBtn.click();

    // 7. Transition to Trial 2 confirms state machine loop
    await expect(page.getByText(/Noticia 2 de 20/i)).toBeVisible();
  });
});
