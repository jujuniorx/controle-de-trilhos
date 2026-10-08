import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { entrarNoPatio, entrarNoAdmin } from './helpers';

const MARCADOR = `E2E-REMETIDO-${Date.now()}`;
const MARCADOR_DIRETO = `${MARCADOR}-DIRETO`;

test.describe('Fluxo real do Remetido — pré-cadastro (Admin) + confirmação (Pátio)', () => {
  test.afterAll(async () => {
    const ids = (
      await prisma.movimentacao.findMany({ where: { reservaPedido: { startsWith: MARCADOR } }, select: { id: true } })
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

    await page.getByPlaceholder('Ex.: 12,500').fill('12,5');

    await page.getByRole('button', { name: 'Confirmar chegada e salvar' }).click();
    await page.waitForURL('**/patio/remetidos');

    await entrarNoAdmin(page);
    await page.goto(`/admin/remetidos/${movimentacaoId}`);
    await expect(page.getByText('PENDENTE DE CONFERÊNCIA').first()).toBeVisible();
    await expect(page.getByText('TOTAL (da NF): 12.500 t')).toBeVisible();

    const movimentacao = await prisma.movimentacao.findUniqueOrThrow({
      where: { id: movimentacaoId },
      include: { grupos: true },
    });
    expect(movimentacao.status).toBe('PENDENTE_CONFERENCIA');
    expect(movimentacao.grupos).toHaveLength(1);
    expect(Number(movimentacao.grupos[0].pesoInformado)).toBe(12.5);
  });

  test('lançamento direto pelo Pátio, sem pré-cadastro do Administrativo', async ({ page }) => {
    await entrarNoPatio(page);
    await page.goto('/patio/remetidos');
    await page.getByRole('link', { name: '+ Novo remetido' }).click();
    await page.waitForURL('**/patio/remetidos/novo');

    await page.locator('#f-tipo-remetido').selectOption('VENDA');
    await page.locator('#f-reserva-pedido').fill(MARCADOR_DIRETO);
    await page.locator('#f-destino').fill('Usina Rondonópolis');

    await page.locator('#f-cavalo').fill('ABC1D23');
    await page.locator('#f-resp').fill('Teste E2E Direto');

    await page.locator('select').nth(1).selectOption('TR22'); // Perfil do novo grupo
    await page.getByRole('button', { name: 'Adicionar grupo' }).click();
    await page.getByLabel('Marca do Grupo 1').selectOption('NIPPON');
    await page.getByPlaceholder('Comprimento (m)').fill('4,65');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(page.getByText('4.65 m', { exact: true })).toBeVisible();
    await page.getByPlaceholder('Ex.: 12,500').fill('9,4');

    await page.getByRole('button', { name: 'Lançar remetido' }).click();
    await page.waitForURL('**/patio/remetidos');

    const movimentacao = await prisma.movimentacao.findFirstOrThrow({
      where: { reservaPedido: MARCADOR_DIRETO },
      include: { grupos: true, remetidoDetalhe: true },
    });
    expect(movimentacao.tipo).toBe('REMETIDO');
    expect(movimentacao.status).toBe('PENDENTE_CONFERENCIA');
    expect(movimentacao.remetidoDetalhe?.tipoRemetido).toBe('VENDA');
    expect(movimentacao.grupos).toHaveLength(1);
    expect(Number(movimentacao.grupos[0].pesoInformado)).toBe(9.4);
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
});
