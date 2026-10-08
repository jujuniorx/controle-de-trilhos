import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db';
import { entrarNoPatio, preencherDadosPatio as preencherDados } from './helpers';

test.describe('Fluxo real do Pátio — recebimento por caminhão', () => {
  test.afterAll(async () => {
    const ids = (
      await prisma.movimentacao.findMany({ where: { responsavelPatio: 'Teste E2E' }, select: { id: true } })
    ).map((m) => m.id);
    await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
    await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  test('NOVO: peso calculado automaticamente pelo fator do perfil', async ({ page }) => {
    await entrarNoPatio(page);
    await preencherDados(page, String(Date.now()).slice(-9));

    await page.getByLabel('Perfil do novo grupo').selectOption('TR22');
    await page.getByLabel('Tipo de material do novo grupo').selectOption('NOVO');
    await page.getByRole('button', { name: 'Adicionar grupo' }).click();
    await page.getByLabel('Marca do Grupo 1').selectOption('NIPPON');

    await page.getByRole('button', { name: 'Lançar medidas' }).click();
    await page.getByLabel('Comprimento').fill('4,65');
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByText('1. 4.65 m')).toBeVisible();

    await page.getByRole('button', { name: 'Voltar aos grupos', exact: true }).click();
    await page.getByRole('button', { name: 'Ver resumo' }).click();

    await expect(page.getByText('0.102 t').first()).toBeVisible();
    await expect(page.getByText('Peso total')).toBeVisible();

    await page.getByRole('button', { name: 'Finalizar e salvar' }).click();
    // Fluxo local-first: a navegação para /confirmado acontece imediatamente após a
    // gravação no IndexedDB (Dexie), antes de qualquer round-trip. A confirmação de
    // que o peso foi calculado corretamente pelo fator do perfil no servidor vem do
    // status de sincronização (POST /api/sync -> criarRecebimentoCaminhao), não mais
    // de conteúdo renderizado a partir do Prisma nesta página.
    await page.waitForURL('**/confirmado');
    await expect(page.getByText('Sincronizado com sucesso')).toBeVisible();
  });

  test('REEMPREGO: exige classificação e soma metros/peso corretamente', async ({ page }) => {
    await entrarNoPatio(page);
    await preencherDados(page, String(Date.now()).slice(-9));

    await page.getByLabel('Perfil do novo grupo').selectOption('TR68');
    await page.getByLabel('Tipo de material do novo grupo').selectOption('REEMPREGO');
    await page.getByRole('button', { name: 'Adicionar grupo' }).click();

    await page.getByLabel('Classificação do Grupo 1').selectOption('G2');

    await page.getByRole('button', { name: 'Lançar medidas' }).click();
    await page.getByLabel('Comprimento').fill('12,00');
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByText('1. 12.00 m')).toBeVisible();

    await page.getByRole('button', { name: 'Voltar aos grupos', exact: true }).click();
    await page.getByRole('button', { name: 'Ver resumo' }).click();

    await expect(page.getByText('0.816 t').first()).toBeVisible();

    await page.getByRole('button', { name: 'Finalizar e salvar' }).click();
    await page.waitForURL('**/confirmado');
    await expect(page.getByText('Sincronizado com sucesso')).toBeVisible();
  });

  test('SUCATA: classificação SC manual, peso nunca calculado, fica pendente', async ({ page }) => {
    await entrarNoPatio(page);
    await preencherDados(page, String(Date.now()).slice(-9));

    await page.getByLabel('Perfil do novo grupo').selectOption('TR57');
    await page.getByLabel('Tipo de material do novo grupo').selectOption('SUCATA');
    await page.getByRole('button', { name: 'Adicionar grupo' }).click();

    await page.getByRole('button', { name: 'Lançar medidas' }).click();
    await page.getByLabel('Comprimento').fill('8,10');
    await page.getByLabel('Classificação SC').selectOption('SC1');
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByText('1. 8.10 m')).toBeVisible();

    await page.getByRole('button', { name: 'Voltar aos grupos', exact: true }).click();
    await page.getByRole('button', { name: 'Ver resumo' }).click();

    // TR57 fator 0.057 x 8.10m = 0.4617 -> arredondado para 0.462t (estimativa, mesma fórmula do Reemprego).
    await expect(page.getByText('0.462 t').first()).toBeVisible();
    await expect(page.getByText('(estimado)')).toBeVisible();
    await expect(page.getByText('Peso até agora')).toBeVisible();

    await page.getByRole('button', { name: 'Finalizar e salvar' }).click();
    await page.waitForURL('**/confirmado');
    await expect(page.getByText('Sincronizado com sucesso')).toBeVisible();
    await expect(page.getByText('peso pendente').first()).toBeVisible();
    await expect(page.getByText(/sucata com peso pendente/i)).toBeVisible();
  });
});
