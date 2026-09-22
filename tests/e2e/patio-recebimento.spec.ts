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

    await page.getByRole('button', { name: 'Lançar medidas' }).click();
    await page.getByLabel('Comprimento').fill('4,65');
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByText('1. 4.65 m')).toBeVisible();

    await page.getByRole('button', { name: 'Voltar aos grupos', exact: true }).click();
    await page.getByRole('button', { name: 'Ver resumo' }).click();

    await expect(page.getByText('0.102 t').first()).toBeVisible();
    await expect(page.getByText('Peso total')).toBeVisible();

    await page.getByRole('button', { name: 'Finalizar e salvar' }).click();
    await page.waitForURL('**/confirmado');
    await expect(page.getByText('0.102')).toBeVisible();
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
    await expect(page.getByText('0.816')).toBeVisible();
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

    await expect(page.getByText('PENDENTE').first()).toBeVisible();
    await expect(page.getByText('Peso até agora')).toBeVisible();

    await page.getByRole('button', { name: 'Finalizar e salvar' }).click();
    await page.waitForURL('**/confirmado');
    await expect(page.getByText('peso pendente').first()).toBeVisible();
    await expect(page.getByText(/sucata com peso pendente/i)).toBeVisible();
  });
});
