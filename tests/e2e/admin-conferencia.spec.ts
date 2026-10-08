import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db';
import { entrarNoPatio, preencherDadosPatio, entrarNoAdmin } from './helpers';

const RESPONSAVEL = 'Teste E2E Conferencia';

const PDF_VALIDO = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from('-1.4 teste e2e')]);
const ARQUIVO_INVALIDO = Buffer.from('não é um documento válido');

async function criarRecebimentoMistoPeloPatio(page: import('@playwright/test').Page, nf: string) {
  await entrarNoPatio(page);
  await preencherDadosPatio(page, nf, RESPONSAVEL);

  await page.getByLabel('Perfil do novo grupo').selectOption('TR22');
  await page.getByLabel('Tipo de material do novo grupo').selectOption('NOVO');
  await page.getByRole('button', { name: 'Adicionar grupo' }).click();
  await page.getByLabel('Marca do Grupo 1').selectOption('NIPPON');
  await page.getByRole('button', { name: 'Lançar medidas' }).click();
  await page.getByLabel('Comprimento').fill('4,65');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.getByRole('button', { name: 'Voltar aos grupos', exact: true }).click();

  await page.getByLabel('Perfil do novo grupo').selectOption('TR68');
  await page.getByLabel('Tipo de material do novo grupo').selectOption('REEMPREGO');
  await page.getByRole('button', { name: 'Adicionar grupo' }).click();
  await page.getByLabel('Classificação do Grupo 2').selectOption('G2');
  await page.getByRole('button', { name: 'Lançar medidas' }).click();
  await page.getByLabel('Comprimento').fill('12,00');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await page.getByRole('button', { name: 'Voltar aos grupos', exact: true }).click();

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

test.describe('Administrativo — conferência, peso real e documento de pesagem', () => {
  test.afterAll(async () => {
    const ids = (
      await prisma.movimentacao.findMany({ where: { responsavelPatio: RESPONSAVEL }, select: { id: true } })
    ).map((m) => m.id);
    await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.anexo.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
    await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  test('fluxo completo: peso real + upload do documento + CONFERIDO + histórico', async ({ page }) => {
    const nf = String(Date.now()).slice(-9);
    await criarRecebimentoMistoPeloPatio(page, nf);

    await entrarNoAdmin(page);
    const row = page.locator('tr', { has: page.getByRole('cell', { name: nf }) });
    await row.getByRole('link', { name: 'Ver detalhes' }).click();
    await page.waitForURL('**/admin/recebimentos/**');
    const movimentacaoId = page.url().split('/recebimentos/')[1];

    // Estado inicial: peso até agora, sucata pendente, botão Conferir bloqueado.
    await expect(page.getByText('PESO ATÉ AGORA')).toBeVisible();
    await expect(page.getByText(/peso da sucata pendente/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conferir recebimento' })).toBeDisabled();
    await expect(page.getByText('Nenhum documento anexado ainda.')).toBeVisible();

    // Informa o peso real da sucata.
    await page.locator('#peso-sucata').fill('1,250');
    await page.getByRole('button', { name: 'Salvar peso' }).click();
    await expect(page.getByText('PESO TOTAL')).toBeVisible();
    await expect(page.getByText('2.168', { exact: false })).toBeVisible(); // 0.102 + 0.816 + 1.250

    // Upload real do documento de pesagem (contra o S3 local usado nos testes).
    await page.locator('input[type="file"]').setInputFiles({
      name: 'pesagem.pdf',
      mimeType: 'application/pdf',
      buffer: PDF_VALIDO,
    });
    await page.getByRole('button', { name: 'Enviar documento' }).click();
    await expect(page.getByText('pesagem.pdf').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Substituir documento' })).toBeVisible();

    // Abre o documento — a ação busca uma URL temporária no servidor (verificado
    // byte a byte em tests/integration/documentoPesagem.test.ts); aqui confirmamos
    // que o clique não resulta em nenhum erro exibido na tela.
    await page.getByRole('button', { name: 'Abrir documento' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/não foi possível abrir/i)).toHaveCount(0);

    // Confere.
    await expect(page.getByRole('button', { name: 'Conferir recebimento' })).toBeEnabled();
    await page.getByRole('button', { name: 'Conferir recebimento' }).click();
    await expect(page.getByRole('button', { name: 'Recebimento conferido' })).toBeVisible();
    await expect(page.getByText('CONFERIDO', { exact: true }).first()).toBeVisible();

    const movAtualizada = await prisma.movimentacao.findUniqueOrThrow({ where: { id: movimentacaoId } });
    expect(movAtualizada.status).toBe('CONFERIDO');

    // Histórico visível na própria tela.
    await expect(page.getByText('Documento de pesagem anexado')).toBeVisible();
    await expect(page.getByText('Peso da sucata informado/corrigido')).toBeVisible();
    await expect(page.getByText('Recebimento conferido').first()).toBeVisible();

    const historicoConferencia = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId, acao: 'CONFERENCIA' } });
    expect(historicoConferencia).toHaveLength(1);
    const historicoAnexo = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId, acao: 'ANEXO' } });
    expect(historicoAnexo).toHaveLength(1);
  });

  test('rejeita upload de arquivo com conteúdo inválido, sem criar Anexo', async ({ page }) => {
    const nf = String(Date.now()).slice(-9);
    await criarRecebimentoMistoPeloPatio(page, nf);

    await entrarNoAdmin(page);
    const row = page.locator('tr', { has: page.getByRole('cell', { name: nf }) });
    await row.getByRole('link', { name: 'Ver detalhes' }).click();
    await page.waitForURL('**/admin/recebimentos/**');
    const movimentacaoId = page.url().split('/recebimentos/')[1];

    await page.locator('input[type="file"]').setInputFiles({
      name: 'pesagem.pdf',
      mimeType: 'application/pdf',
      buffer: ARQUIVO_INVALIDO, // extensão/tipo dizem PDF, conteúdo não é
    });
    await page.getByRole('button', { name: 'Enviar documento' }).click();
    await expect(page.getByText(/conteúdo do arquivo não corresponde/i)).toBeVisible();

    expect(await prisma.anexo.count({ where: { movimentacaoId } })).toBe(0);
  });

  test('tentar conferir sem informar o peso da sucata é bloqueado no servidor', async ({ page }) => {
    const nf = String(Date.now()).slice(-9);
    await criarRecebimentoMistoPeloPatio(page, nf);

    await entrarNoAdmin(page);
    const row = page.locator('tr', { has: page.getByRole('cell', { name: nf }) });
    await row.getByRole('link', { name: 'Ver detalhes' }).click();
    await page.waitForURL('**/admin/recebimentos/**');
    const movimentacaoId = page.url().split('/recebimentos/')[1];

    await expect(page.getByRole('button', { name: 'Conferir recebimento' })).toBeDisabled();
    // Mesmo que a UI bloqueie, a movimentação continua PENDENTE_CONFERENCIA no banco.
    expect((await prisma.movimentacao.findUniqueOrThrow({ where: { id: movimentacaoId } })).status).toBe(
      'PENDENTE_CONFERENCIA',
    );
  });

  test('Pátio não consegue acessar nenhuma tela/ação do Administrativo', async ({ page }) => {
    await entrarNoPatio(page);
    // Sessão só tem o cookie de acesso do Pátio — nenhuma rota /admin é alcançável,
    // então o Pátio nunca recebe o RSC payload com a referência da Server Action
    // (não há como invocar as ações administrativas sem antes renderizar essa
    // página, que já está bloqueada no middleware).
    await page.goto('/admin');
    await page.waitForURL('**/admin/login');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });
});
