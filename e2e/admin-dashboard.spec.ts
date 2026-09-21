import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard & CSV Export', () => {
  test('Enforces password authentication and displays metrics & CSV download', async ({ page }) => {
    await page.goto('/admin');

    // Login Form
    await expect(page.getByRole('heading', { name: /Panel de Control/i })).toBeVisible();

    // Wrong password test
    await page.fill('input[type="password"]', 'wrong-password-123');
    await page.getByRole('button', { name: /Ingresar/i }).click();
    await expect(page.getByText('Contraseña incorrecta')).toBeVisible();

    // Correct password test
    await page.fill('input[type="password"]', 'favaloro-admin-dev');
    await page.getByRole('button', { name: /Ingresar/i }).click();

    // Authenticated Dashboard
    await expect(page.getByRole('heading', { name: /Dashboard del Experimento/i })).toBeVisible();
    await expect(page.getByText('Total Participantes')).toBeVisible();
    await expect(page.getByText('Completados')).toBeVisible();
    await expect(page.getByText('Asignación de Grupos')).toBeVisible();

    // CSV Export verification
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: /Exportar Datos CSV/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('experiment_data.csv');
  });
});
