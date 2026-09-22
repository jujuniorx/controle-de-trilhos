import { test, expect } from '@playwright/test';

test.describe('Security Headers', () => {
  test('GET /patio/acesso returns required security headers', async ({ page }) => {
    // Make a request to /patio/acesso and check response headers
    const response = await page.request.get('/patio/acesso');

    // Verify status is OK (redirect or success)
    expect(response.status()).toBeLessThan(500);

    // Check for required security headers
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['strict-transport-security']).toBeDefined();
    expect(headers['content-security-policy']).toBeDefined();
  });
});
