import { expect, type Page } from '@playwright/test';

export async function entrarNoPatio(page: Page) {
  await page.goto('/patio/acesso');
  await page.locator('input[name="pin"]').fill(process.env.PATIO_PIN_TESTE ?? '1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/patio');
}

export async function preencherDadosPatio(page: Page, nf: string, responsavel = 'Teste E2E') {
  await page.goto('/patio/recebimentos/novo');

  // O wizard é um Client Component: o HTML do SSR aparece antes de o React hidratar,
  // e o que for digitado nessa janela nunca chega ao estado do React (o campo mostra o
  // texto, mas a validação continua vendo vazio). A data de hoje é um valor exclusivo
  // do cliente (snapshot de servidor vazio), então o campo preenchido é justamente o
  // sinal de que a página já hidratou e aceita digitação.
  await expect(page.locator('#f-data')).not.toHaveValue('');

  await page.locator('#f-nf').fill(nf);
  await page.locator('#f-origem').fill('Rondonópolis');
  await page.locator('#f-cavalo').fill('ABC1D23');
  await page.locator('#f-carreta').fill('XYZ9E88');
  await page.locator('#f-resp').fill(responsavel);
  await page.getByRole('button', { name: 'Próximo' }).click();
}

export async function entrarNoAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[name="identificador"]').fill(process.env.ADMIN_EMAIL ?? 'admin-teste@controle-trilhos.local');
  await page.locator('input[name="senha"]').fill(process.env.ADMIN_SENHA_INICIAL ?? 'SenhaTeste123!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/admin');
}
