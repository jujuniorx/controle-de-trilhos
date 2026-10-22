import { test, expect } from '@playwright/test';

test.describe('PWA — manifest e Service Worker', () => {
  test('manifesto carrega e Service Worker registra', async ({ page }) => {
    // Navigate to the app
    await page.goto('/patio/acesso');

    // Wait for Service Worker to register (check that it's in the page context)
    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return false;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        return registration.active !== null;
      } catch {
        return false;
      }
    });

    expect(swReady).toBe(true);

    // Verify that manifest.json responds with 200
    const manifestResponse = await page.request.get('/manifest.json');
    expect(manifestResponse.status()).toBe(200);

    // Verify manifest content
    const manifestData = await manifestResponse.json();
    expect(manifestData.name).toBe('Controle de Trilhos');
    expect(manifestData.short_name).toBe('Trilhos');
    expect(manifestData.start_url).toBe('/patio/acesso');
    expect(manifestData.display).toBe('standalone');
  });
});
