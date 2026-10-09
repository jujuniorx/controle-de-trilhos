import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { entrarNoPatio, entrarNoAdmin } from './helpers';

const MARCADOR = `E2E-REMETIDO-${Date.now()}`;

test.describe('Fluxo real do Remetido — pré-cadastro (Admin) + confirmação (Pátio)', () => {
  test.afterAll(async () => {
    const ids = (
      await prisma.movimentacao.findMany({
        where: {
          OR: [
            { reservaPedido: { startsWith: MARCADOR } },
            { responsavelPatio: 'Teste E2E Direto' },
            { responsavelPatio: 'Teste E2E Edicao' },
          ],
        },
        select: { id: true },
      })
    ).map((m) => m.id);
    await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
    await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  test('pré-cadastro pelo Admin, confirmação pelo Pátio com grupo NOVO', async ({ page }) => {
    await entrarNoAdmin(page);

    await page.goto('/admin/remetidos/novo');
    await page.locator('#tipoRemetido').selectOption('VENDA');
    await page.locator('#reservaPedido').fill(MARCADOR);
    await page.locator('#destino').fill('Usina Rondonópolis');
    await page.getByRole('button', { name: 'Criar pré-cadastro' }).click();
    await page.waitForURL(/\/admin\/remetidos\/(?!novo)[a-z0-9]+$/);

    const detalheUrl = page.url();
    const movimentacaoId = detalheUrl.split('/').pop()!;
    await expect(page.getByText('AGUARDANDO CHEGADA')).toBeVisible();

    await entrarNoPatio(page);
    await page.goto('/patio/remetidos');
    await expect(page.getByText(MARCADOR)).toBeVisible();
    await page.getByText(MARCADOR).click();
    await page.waitForURL(`**/patio/remetidos/${movimentacaoId}/confirmar`);

    await page.locator('#f-nf').fill(String(Date.now()).slice(-9));
    await page.locator('#f-cavalo').fill('ABC1D23');
    await page.locator('#f-resp').fill('Teste E2E Remetido');

    await page.locator('select').first().selectOption('TR22'); // Perfil do novo grupo
    await page.getByRole('button', { name: 'Adicionar grupo' }).click();
    await page.getByLabel('Marca do Grupo 1').selectOption('NIPPON');

    // O grupo recém-criado já fica ativo (activeGrupoId), então o bloco de
    // lançar medidas já aparece aberto — sem precisar clicar "Lançar medidas".
    await page.getByPlaceholder('Comprimento (m)').fill('4,65');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(page.getByText('4.65 m', { exact: true })).toBeVisible();

    // Peso da NF foi removido do wizard do Pátio (Task 5) — o peso passa a ser
    // sempre a estimativa automática (metros × fator do perfil) até o Admin
    // confirmar o peso real depois, pela PesoGrupoPainel.
    await page.getByRole('button', { name: 'Confirmar chegada e salvar' }).click();
    await page.waitForURL('**/patio/remetidos');

    await entrarNoAdmin(page);
    await page.goto(`/admin/remetidos/${movimentacaoId}`);
    await expect(page.getByText('PENDENTE DE CONFERÊNCIA').first()).toBeVisible();
    // TR22 × 4.65 m com fator 0,022 (seed) = 0,102 t — estimativa automática,
    // já que nenhum peso foi informado pelo Pátio. Bloco "Totais do remetido" (Task 18.6).
    const totais = page.locator('section', { has: page.getByRole('heading', { name: 'Totais do remetido' }) });
    await expect(totais.getByText('0.102', { exact: false })).toBeVisible();

    const movimentacao = await prisma.movimentacao.findUniqueOrThrow({
      where: { id: movimentacaoId },
      include: { grupos: true },
    });
    expect(movimentacao.status).toBe('PENDENTE_CONFERENCIA');
    expect(movimentacao.grupos).toHaveLength(1);
    expect(movimentacao.grupos[0].pesoInformado).toBeNull();
    expect(Number(movimentacao.grupos[0].pesoCalculado)).toBeCloseTo(0.102, 3);
  });

  test('lançamento direto pelo Pátio, sem pré-cadastro do Administrativo', async ({ page }) => {
    await entrarNoPatio(page);
    await page.goto('/patio/remetidos');
    await page.getByRole('link', { name: '+ Novo remetido' }).click();
    await page.waitForURL('**/patio/remetidos/novo');

    await page.locator('#f-tipo-remetido').selectOption('VENDA');
    // Reserva/Pedido foi removida desta tela de propósito (lançamento direto) —
    // sem campo e sem id #f-reserva-pedido para preencher.
    await page.locator('#f-destino').fill('Usina Rondonópolis');

    await page.locator('#f-cavalo').fill('ABC1D23');
    await page.locator('#f-resp').fill('Teste E2E Direto');

    await page.locator('select').nth(1).selectOption('TR22'); // Perfil do novo grupo
    await page.getByRole('button', { name: 'Adicionar grupo' }).click();
    await page.getByLabel('Marca do Grupo 1').selectOption('NIPPON');
    await page.getByPlaceholder('Comprimento (m)').fill('4,65');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(page.getByText('4.65 m', { exact: true })).toBeVisible();
    // Peso da NF foi removido do wizard do Pátio (Task 5) — o peso passa a ser
    // sempre a estimativa automática até o Admin confirmar o peso real depois.

    await page.getByRole('button', { name: 'Lançar remetido' }).click();
    await page.waitForURL('**/patio/remetidos');

    const movimentacao = await prisma.movimentacao.findFirstOrThrow({
      where: { responsavelPatio: 'Teste E2E Direto' },
      include: { grupos: true, remetidoDetalhe: true },
    });
    expect(movimentacao.tipo).toBe('REMETIDO');
    expect(movimentacao.status).toBe('PENDENTE_CONFERENCIA');
    expect(movimentacao.remetidoDetalhe?.tipoRemetido).toBe('VENDA');
    expect(movimentacao.reservaPedido).toBeNull(); // Campo removido desta tela — salva sem ele
    expect(movimentacao.grupos).toHaveLength(1);
    expect(movimentacao.grupos[0].pesoInformado).toBeNull();
    expect(Number(movimentacao.grupos[0].pesoCalculado)).toBeCloseTo(0.102, 3);
  });

  test('exportação Excel: rota protegida por admin retorna um .xlsx válido com o Remetido recém-criado', async ({ page }) => {
    await entrarNoAdmin(page);
    const resposta = await page.request.get(`/api/relatorios/exportar?origemDestino=${encodeURIComponent('Rondonópolis')}`);
    expect(resposta.status()).toBe(200);
    expect(resposta.headers()['content-type']).toContain('spreadsheetml');

    const buffer = await resposta.body();
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    expect(workbook.getWorksheet('Recebidos')).toBeDefined();
    const remetidos = workbook.getWorksheet('Remetidos')!;
    expect(remetidos).toBeDefined();

    const linhas = remetidos.getRows(2, remetidos.rowCount - 1) ?? [];
    // Reserva/Pedido (coluna 6) sai maiúsculo no Excel (Bloco 5.2) — MARCADOR já é
    // só maiúsculas/dígitos/hífen, então a comparação direta continua válida.
    const linha = linhas.find((r) => String(r.getCell(6).value) === MARCADOR); // Reserva/Pedido
    expect(linha, 'linha do Remetido recém-criado não encontrada na planilha').toBeDefined();
    expect(linha!.getCell(10).value).toBe('TR22'); // Perfil
  });

  test('Admin edita um Remetido existente (Task 17) — reabre a conferência quando já estava CONFERIDO (Task 18)', async ({ page }) => {
    const responsavelEdicao = 'Teste E2E Edicao';
    await entrarNoPatio(page);
    await page.goto('/patio/remetidos/novo');
    await page.locator('#f-tipo-remetido').selectOption('VENDA');
    await page.locator('#f-destino').fill('Usina Rondonópolis');
    await page.locator('#f-nf').fill(String(Date.now()).slice(-9));
    await page.locator('#f-cavalo').fill('ABC1D23');
    await page.locator('#f-resp').fill(responsavelEdicao);
    await page.locator('select').nth(1).selectOption('TR22'); // Perfil do novo grupo
    await page.getByRole('button', { name: 'Adicionar grupo' }).click();
    await page.getByLabel('Marca do Grupo 1').selectOption('NIPPON');
    await page.getByPlaceholder('Comprimento (m)').fill('4,65');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await page.getByRole('button', { name: 'Lançar remetido' }).click();
    await page.waitForURL('**/patio/remetidos');

    const movimentacao = await prisma.movimentacao.findFirstOrThrow({ where: { responsavelPatio: responsavelEdicao } });

    await entrarNoAdmin(page);
    await page.goto(`/admin/remetidos/${movimentacao.id}`);
    // Task 18: título amigável (nunca o CUID), barras por grupo, bloco de totais.
    await expect(page.getByRole('heading', { name: /Remetido — NF \d+/ })).toBeVisible();
    await expect(page.getByText('1 barra', { exact: false })).toBeVisible();
    await expect(page.getByText('Totais do remetido')).toBeVisible();

    // Confere antes de editar, para provar que a edição reabre a conferência.
    await page.getByRole('button', { name: 'Conferir recebimento' }).click();
    await expect(page.getByText('CONFERIDO', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conferir recebimento' })).toHaveCount(0);

    await page.getByRole('link', { name: 'Editar remetido' }).click();
    await page.waitForURL(`**/admin/remetidos/${movimentacao.id}/editar`);
    await page.locator('#f-destino').fill('Usina Sorriso');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await page.waitForURL(`**/admin/remetidos/${movimentacao.id}`);

    await expect(page.getByText('PENDENTE DE CONFERÊNCIA').first()).toBeVisible();
    await expect(page.getByText('Usina Sorriso')).toBeVisible();
    await expect(page.getByText('Remetido editado pelo Administrativo')).toBeVisible();
    await expect(page.getByText('Conferência reaberta')).toBeVisible();

    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: movimentacao.id } });
    expect(atualizado.status).toBe('PENDENTE_CONFERENCIA');
    expect(atualizado.destino).toBe('Usina Sorriso');
  });
});
