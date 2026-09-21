import { test, expect } from '@playwright/test';

test.describe('Inclusion Criteria & Excluded Participant Routing', () => {
  test('Non-psychology student is routed to Control condition transparently', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Comenzar Experimento/i }).click();

    await page.locator('#consent-checkbox').check();
    await page.getByRole('button', { name: /Continuar a Datos Demográficos/i }).click();

    // Non-psychology student + Otros orientation -> Excluded criteria
    await page.fill('#age-input', '25');
    await page.locator('label', { hasText: 'Masculino' }).click();
    await page.locator('label', { hasText: /^No$/ }).click();
    await page.locator('label', { hasText: 'Otros / Ninguna en particular' }).click();
    await page.fill('#university-input', 'UBA Medicina');

    await page.getByRole('button', { name: /Continuar a las Instrucciones/i }).click();

    // Excluded participants are routed to Control condition
    await expect(
      page.getByRole('heading', { name: /Pautas Generales de Evaluación/i })
    ).toBeVisible();
    await expect(
      page.getByText(/A continuación se le presentará una serie de titulares de noticias reales de 2017-2018/i)
    ).toBeVisible();
  });
});
