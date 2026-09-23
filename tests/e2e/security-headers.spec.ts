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

  test('CSP é baseada em nonce por requisição, não estática', async ({ page }) => {
    const response = await page.request.get('/patio/acesso');
    const csp = response.headers()['content-security-policy'];
    expect(csp).toBeDefined();

    // Isola a diretiva script-src (vai até o próximo ';' ou o fim do header).
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'));
    expect(scriptSrc, `script-src ausente na CSP: ${csp}`).toBeDefined();

    // Um nonce é aleatório por requisição, então só a forma é verificável. Esta é a
    // asserção que falharia se alguém reintroduzisse uma CSP estática sem nonce —
    // exatamente a regressão que quebrou a hidratação antes.
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=_-]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");

    // Duas requisições não podem receber o mesmo nonce.
    const outra = await page.request.get('/patio/acesso');
    const outroScriptSrc = outra
      .headers()
      ['content-security-policy'].split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith('script-src'));
    expect(outroScriptSrc).not.toBe(scriptSrc);

    // Diretivas sem fallback via default-src, adicionadas como defesa em profundidade.
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
});
