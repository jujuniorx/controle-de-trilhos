import type { Page } from '@playwright/test';

export async function entrarNoPatio(page: Page) {
  await page.goto('/patio/acesso');
  await page.locator('input[name="pin"]').fill(process.env.PATIO_PIN_TESTE ?? '1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/patio');
}

export async function preencherDadosPatio(page: Page, nf: string, responsavel = 'Teste E2E') {
  await page.goto('/patio/recebimentos/novo');
  await page.locator('#f-nf').fill(nf);
  await page.locator('#f-origem').fill('Rondonópolis');
  await page.locator('#f-cavalo').fill('ABC1D23');
  await page.locator('#f-carreta').fill('XYZ9E88');
  await page.locator('#f-resp').fill(responsavel);
  await page.getByRole('button', { name: 'Próximo' }).click();
}

export async function entrarNoAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill(process.env.ADMIN_EMAIL ?? 'admin-teste@controle-trilhos.local');
  await page.locator('input[name="senha"]').fill(process.env.ADMIN_SENHA_INICIAL ?? 'SenhaTeste123!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/admin');
}
