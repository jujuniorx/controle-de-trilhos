import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db';
import { entrarNoPatio, preencherDadosPatio, entrarNoAdmin } from './helpers';

const RESPONSAVEL = 'Teste E2E Admin';

async function criarRecebimentoMistoPeloPatio(page: import('@playwright/test').Page, nf: string) {
  await entrarNoPatio(page);
  await preencherDadosPatio(page, nf, RESPONSAVEL);

  // Grupo 1: NOVO — TR22, 4,65 m → 0,102 t
  await page.getByLabel('Perfil do novo grupo').selectOption('TR22');
  await page.getByLabel('Tipo de material do novo grupo').selectOption('NOVO');
  await page.getByRole('button', { name: 'Adicionar grupo' }).click();
  await page.getByLabel('Marca do Grupo 1').selectOption('NIPPON');
  await page.getByRole('button', { name: 'Lançar medidas' }).click();
  await page.getByLabel('Comprimento').fill('4,65');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.getByRole('button', { name: 'Voltar aos grupos', exact: true }).click();

  // Grupo 2: REEMPREGO — TR68, G2, 12 m → 0,816 t
  await page.getByLabel('Perfil do novo grupo').selectOption('TR68');
  await page.getByLabel('Tipo de material do novo grupo').selectOption('REEMPREGO');
  await page.getByRole('button', { name: 'Adicionar grupo' }).click();
  await page.getByLabel('Classificação do Grupo 2').selectOption('G2');
  await page.getByRole('button', { name: 'Lançar medidas' }).click();
  await page.getByLabel('Comprimento').fill('12,00');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.getByRole('button', { name: 'Voltar aos grupos', exact: true }).click();

  // Grupo 3: SUCATA — TR57, 8,10 m, SC1 (peso sempre pendente)
  await page.getByLabel('Perfil do novo grupo').selectOption('TR57');
  await page.getByLabel('Tipo de material do novo grupo').selectOption('SUCATA');
  await page.getByRole('button', { name: 'Adicionar grupo' }).click();
  await page.getByRole('button', { name: 'Lançar medidas' }).click();
  await page.getByLabel('Comprimento').fill('8,10');
  await page.getByLabel('Classificação SC').selectOption('SC1');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.getByRole('button', { name: 'Voltar aos grupos', exact: true }).click();

  await page.getByRole('button', { name: 'Ver resumo' }).click();
  await page.getByRole('button', { name: 'Finalizar e salvar' }).click();
  await page.waitForURL('**/confirmado');
  // Fluxo local-first: a navegação acontece assim que o registro entra no IndexedDB,
  // ANTES do POST /api/sync. O Administrativo lê do Postgres, então é preciso esperar
  // a sincronização concluir — senão o recebimento ainda não existe para o admin.
  await expect(page.getByText('Sincronizado com sucesso')).toBeVisible();
}

test.describe('Administrativo — listagem e detalhe de recebimentos pendentes', () => {
  test.afterAll(async () => {
    const ids = (
      await prisma.movimentacao.findMany({ where: { responsavelPatio: RESPONSAVEL }, select: { id: true } })
    ).map((m) => m.id);
    await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
    await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  test('lista o recebimento criado pelo Pátio e mostra os dados corretos', async ({ page }) => {
    const nf = String(Date.now()).slice(-9);
    await criarRecebimentoMistoPeloPatio(page, nf);

    await entrarNoAdmin(page);
    await expect(page.getByRole('cell', { name: nf })).toBeVisible();
    const row = page.locator('tr', { has: page.getByRole('cell', { name: nf }) });
    await expect(row.getByText('Rondonópolis')).toBeVisible();
    await expect(row.getByText('XYZ9E88 / ABC1D23')).toBeVisible();
    await expect(row.getByText(RESPONSAVEL)).toBeVisible();
    await expect(row.getByText('PENDENTE_CONFERENCIA')).toBeVisible();
  });

  test('abre o detalhe e mostra grupos, medições e "Peso até agora" (sucata pendente)', async ({ page }) => {
    const nf = String(Date.now()).slice(-9);
    await criarRecebimentoMistoPeloPatio(page, nf);

    await entrarNoAdmin(page);
    const row = page.locator('tr', { has: page.getByRole('cell', { name: nf }) });
    await row.getByRole('link', { name: 'Ver detalhes' }).click();
    await page.waitForURL('**/admin/recebimentos/**');

    await expect(page.getByRole('heading', { name: `Recebimento — NF ${nf}` })).toBeVisible();
    await expect(page.getByText('Rondonópolis')).toBeVisible();

    // Grupo NOVO
    await expect(page.getByText('TR22 — NOVO')).toBeVisible();
    await expect(page.getByText('0.102 t')).toBeVisible();

    // Grupo REEMPREGO
    await expect(page.getByText('TR68 — REEMPREGO')).toBeVisible();
    await expect(page.getByText('Classificação: G2')).toBeVisible();
    await expect(page.getByText('0.816 t')).toBeVisible();

    // Grupo SUCATA — TR57 fator 0.057 x 8.10m = 0.462t (estimativa, mesma fórmula do Reemprego).
    await expect(page.getByText('TR57 — SUCATA')).toBeVisible();
    await expect(page.getByText('0.462 t').first()).toBeVisible();
    await expect(page.getByText('(estimado, a confirmar)').first()).toBeVisible();
    await expect(page.getByText('SC1')).toBeVisible();

    // Resumo: NUNCA "Peso total" enquanto o peso REAL da sucata está pendente.
    // Escopado à seção "Resumo de peso" — a seção "Totais do recebimento" tem
    // seus próprios rótulos/valores de peso e getByText é case-insensitive por padrão.
    const resumoPeso = page.locator('section', { has: page.getByRole('heading', { name: 'Resumo de peso' }) });
    await expect(resumoPeso.getByText('Peso até agora')).toBeVisible();
    await expect(resumoPeso.getByText('Peso total')).toHaveCount(0);
    await expect(resumoPeso.getByText('0.918 t')).toBeVisible(); // 0.102 + 0.816, sem a sucata
    await expect(resumoPeso.getByText(/SUCATA — peso estimado/)).toBeVisible();
  });
});
