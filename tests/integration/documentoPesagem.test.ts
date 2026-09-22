import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type S3rver from 's3rver';
import { prisma } from '@/lib/db';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';
import { informarPesoSucataReal } from '@/lib/services/conferencia';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';
import {
  enviarDocumentoPesagem,
  obterUrlTemporariaDocumento,
  DocumentoPesagemError,
} from '@/lib/services/documentoPesagem';
import { iniciarS3Mock, pararS3Mock, envS3Mock } from '../../scripts/s3-mock';

const uuid = () => crypto.randomUUID();
const RESPONSAVEL = 'Teste Integração DocumentoPesagem';
const ADMIN = { userId: 'admin-teste-documento', nome: 'Admin Teste Documento' };

const PDF = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from('-1.4 conteúdo original')]);
const PDF_V2 = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.from('-1.4 conteúdo corrigido')]);

let servidorS3: S3rver;

beforeAll(async () => {
  servidorS3 = await iniciarS3Mock();
  Object.assign(process.env, envS3Mock());
});

afterAll(async () => {
  await pararS3Mock(servidorS3);
});

function dadosBase() {
  return {
    data: '2026-09-20',
    numeroDocumento: String(Math.floor(Math.random() * 900000) + 100000),
    origem: 'Rondonópolis',
    placaCavalo: 'ABC1D23',
    placaCarreta: 'XYZ9E88',
    responsavelPatio: RESPONSAVEL,
  };
}

async function criarComSucata() {
  const input = recebimentoCaminhaoSchema.parse({
    clientId: uuid(),
    dados: dadosBase(),
    grupos: [
      {
        clientId: uuid(),
        perfil: 'TR57',
        tipoMaterial: 'SUCATA',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' }],
      },
    ],
  });
  return criarRecebimentoCaminhao(input);
}

describe('enviarDocumentoPesagem (contra um S3 compatível local, mesmo código do R2 real)', () => {
  it('1/6/7. envia o arquivo, cria o Anexo vinculado à Movimentacao (nunca a um Grupo) e grava histórico', async () => {
    const mov = await criarComSucata();
    await enviarDocumentoPesagem(mov.id, { nomeOriginal: 'pesagem.pdf', contentType: 'application/pdf', bytes: PDF }, ADMIN);

    const anexos = await prisma.anexo.findMany({ where: { movimentacaoId: mov.id } });
    expect(anexos).toHaveLength(1);
    expect(anexos[0].tipo).toBe('DOCUMENTO_PESAGEM');
    expect(anexos[0].grupoId).toBeNull(); // 7. nunca associado a um Grupo
    expect(anexos[0].url).toContain(mov.id); // chave organizada por movimentacaoId

    const historico = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: mov.id, acao: 'ANEXO' } });
    expect(historico).toHaveLength(1);
    expect(historico[0].usuarioId).toBe(ADMIN.userId);
  });

  it('2. rejeita tipo de arquivo não permitido antes de qualquer upload/gravação', async () => {
    const mov = await criarComSucata();
    await expect(
      enviarDocumentoPesagem(mov.id, { nomeOriginal: 'planilha.xlsx', contentType: 'application/vnd.ms-excel', bytes: PDF }, ADMIN),
    ).rejects.toThrow(DocumentoPesagemError);
    expect(await prisma.anexo.count({ where: { movimentacaoId: mov.id } })).toBe(0);
  });

  it('3. rejeita arquivo acima do limite de tamanho', async () => {
    const mov = await criarComSucata();
    const grande = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024 + 1)]);
    await expect(
      enviarDocumentoPesagem(mov.id, { nomeOriginal: 'pesagem.pdf', contentType: 'application/pdf', bytes: grande }, ADMIN),
    ).rejects.toThrow(/maior que/i);
  });

  it('9. o documento enviado pode ser aberto por uma URL temporária válida', async () => {
    const mov = await criarComSucata();
    await enviarDocumentoPesagem(mov.id, { nomeOriginal: 'pesagem.pdf', contentType: 'application/pdf', bytes: PDF }, ADMIN);
    const anexo = await prisma.anexo.findFirstOrThrow({ where: { movimentacaoId: mov.id } });

    const url = await obterUrlTemporariaDocumento(anexo.id);
    expect(url).toContain('http');
    const resposta = await fetch(url);
    expect(resposta.status).toBe(200);
    const corpo = Buffer.from(await resposta.arrayBuffer());
    expect(corpo.equals(PDF)).toBe(true);
  });

  it('10. substituir um documento existente registra histórico com a chave anterior antes de trocar a referência', async () => {
    const mov = await criarComSucata();
    await enviarDocumentoPesagem(mov.id, { nomeOriginal: 'pesagem.pdf', contentType: 'application/pdf', bytes: PDF }, ADMIN);
    const anexoAntes = await prisma.anexo.findFirstOrThrow({ where: { movimentacaoId: mov.id } });

    await enviarDocumentoPesagem(mov.id, { nomeOriginal: 'pesagem-v2.pdf', contentType: 'application/pdf', bytes: PDF_V2 }, ADMIN);

    const anexosDepois = await prisma.anexo.findMany({ where: { movimentacaoId: mov.id } });
    expect(anexosDepois).toHaveLength(1); // substitui a referência, não duplica
    expect(anexosDepois[0].url).not.toBe(anexoAntes.url);

    const historico = await prisma.historicoAlteracao.findMany({
      where: { movimentacaoId: mov.id, acao: 'ANEXO_SUBSTITUIDO' },
    });
    expect(historico).toHaveLength(1);
    expect(historico[0].valorAntigo).toBe(anexoAntes.url);
    expect(historico[0].valorNovo).toBe(anexosDepois[0].url);

    // A URL antiga não fica acessível pela nova referência — comprova que o conteúdo mudou de verdade.
    const url = await obterUrlTemporariaDocumento(anexosDepois[0].id);
    const corpo = Buffer.from(await (await fetch(url)).arrayBuffer());
    expect(corpo.equals(PDF_V2)).toBe(true);
  });

  it('11. anexar o documento não define pesoSucataReal', async () => {
    const mov = await criarComSucata();
    await enviarDocumentoPesagem(mov.id, { nomeOriginal: 'pesagem.pdf', contentType: 'application/pdf', bytes: PDF }, ADMIN);
    const atualizada = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atualizada.pesoSucataReal).toBeNull();
  });

  it('12. informar o peso real sozinho não cria nem altera nenhum documento anexado', async () => {
    const mov = await criarComSucata();
    await informarPesoSucataReal(mov.id, 1.25, ADMIN);
    expect(await prisma.anexo.count({ where: { movimentacaoId: mov.id } })).toBe(0);
  });

  it('rejeita anexar documento a um recebimento inexistente', async () => {
    await expect(
      enviarDocumentoPesagem('id-inexistente', { nomeOriginal: 'pesagem.pdf', contentType: 'application/pdf', bytes: PDF }, ADMIN),
    ).rejects.toThrow(/não encontrado/i);
  });

  afterAll(async () => {
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
});
