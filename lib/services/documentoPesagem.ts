import { prisma } from '@/lib/db';
import { enviarArquivoR2, gerarUrlTemporariaR2 } from '@/lib/storage/r2';
import type { UsuarioAdmin } from '@/lib/services/conferencia';

export const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const EXTENSOES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png'] as const;
export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB

export class DocumentoPesagemError extends Error {}

interface AssinaturaArquivo {
  mime: string;
  bytes: number[];
}

// Verifica os primeiros bytes do arquivo (magic numbers) — nunca confia só na
// extensão ou no content-type declarado pelo navegador, que são trivialmente
// falsificáveis.
const ASSINATURAS: AssinaturaArquivo[] = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
];

function assinaturaValida(bytes: Buffer, mime: string): boolean {
  const assinatura = ASSINATURAS.find((a) => a.mime === mime);
  if (!assinatura) return false;
  return assinatura.bytes.every((b, i) => bytes[i] === b);
}

function extensaoDe(nomeArquivo: string): string {
  const partes = nomeArquivo.toLowerCase().split('.');
  return partes.length > 1 ? partes[partes.length - 1] : '';
}

function mimeEsperadoParaExtensao(ext: string): string | null {
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return null;
}

// Remove separadores de caminho, caracteres de controle e qualquer coisa fora
// de um charset seguro — o nome sanitizado só compõe a chave de armazenamento
// junto com um UUID gerado no servidor, nunca é usado isoladamente como chave.
const MARCAS_COMBINANTES = /[̀-ͯ]/g;

export function sanitizarNomeArquivo(nomeOriginal: string): string {
  const semAcentos = nomeOriginal.normalize('NFKD').replace(MARCAS_COMBINANTES, '');
  const seguro = semAcentos.replace(/[^a-zA-Z0-9._-]/g, '_');
  return seguro.slice(-100) || 'arquivo';
}

export interface ArquivoRecebido {
  nomeOriginal: string;
  contentType: string;
  bytes: Buffer;
}

export function validarArquivo(arquivo: ArquivoRecebido): string | null {
  if (!arquivo.bytes || arquivo.bytes.length === 0) return 'Nenhum arquivo recebido.';
  if (arquivo.bytes.length > TAMANHO_MAXIMO_BYTES) {
    return `Arquivo maior que ${TAMANHO_MAXIMO_BYTES / (1024 * 1024)} MB.`;
  }
  const ext = extensaoDe(arquivo.nomeOriginal);
  if (!EXTENSOES_PERMITIDAS.includes(ext as (typeof EXTENSOES_PERMITIDAS)[number])) {
    return 'Formato não permitido. Envie PDF, JPG ou PNG.';
  }
  if (!TIPOS_PERMITIDOS.includes(arquivo.contentType as (typeof TIPOS_PERMITIDOS)[number])) {
    return 'Tipo de arquivo não permitido. Envie PDF, JPG ou PNG.';
  }
  const mimeEsperado = mimeEsperadoParaExtensao(ext);
  if (arquivo.contentType !== mimeEsperado) {
    return 'A extensão do arquivo não corresponde ao tipo declarado.';
  }
  if (!assinaturaValida(arquivo.bytes, arquivo.contentType)) {
    return 'O conteúdo do arquivo não corresponde a um documento válido.';
  }
  return null;
}

/**
 * Envia (ou substitui) o documento de pesagem de uma Movimentacao. O
 * documento pertence sempre à Movimentacao inteira — grupoId nunca é
 * definido. Se já existir um documento de pesagem, ele é substituído
 * (não é criado um segundo Anexo), mas a substituição só ocorre depois de
 * registrar a chave anterior no histórico — nada é apagado silenciosamente.
 */
export async function enviarDocumentoPesagem(
  movimentacaoId: string,
  arquivo: ArquivoRecebido,
  usuario: UsuarioAdmin,
): Promise<void> {
  const erroValidacao = validarArquivo(arquivo);
  if (erroValidacao) throw new DocumentoPesagemError(erroValidacao);

  const mov = await prisma.movimentacao.findUnique({ where: { id: movimentacaoId } });
  if (!mov) throw new DocumentoPesagemError('Recebimento não encontrado.');

  const chave = `documentos-pesagem/${movimentacaoId}/${crypto.randomUUID()}-${sanitizarNomeArquivo(arquivo.nomeOriginal)}`;

  await enviarArquivoR2(chave, arquivo.bytes, arquivo.contentType);

  const existente = await prisma.anexo.findFirst({ where: { movimentacaoId, tipo: 'DOCUMENTO_PESAGEM' } });

  await prisma.$transaction(async (tx) => {
    if (existente) {
      await tx.historicoAlteracao.create({
        data: {
          movimentacaoId,
          usuarioId: usuario.userId,
          usuarioNome: usuario.nome,
          acao: 'ANEXO_SUBSTITUIDO',
          campo: 'documentoPesagem',
          valorAntigo: existente.url,
          valorNovo: chave,
        },
      });
      await tx.anexo.update({
        where: { id: existente.id },
        data: { url: chave, uploadedById: usuario.userId, uploadedAt: new Date() },
      });
    } else {
      await tx.anexo.create({
        data: { movimentacaoId, tipo: 'DOCUMENTO_PESAGEM', url: chave, uploadedById: usuario.userId },
      });
      await tx.historicoAlteracao.create({
        data: {
          movimentacaoId,
          usuarioId: usuario.userId,
          usuarioNome: usuario.nome,
          acao: 'ANEXO',
          campo: 'documentoPesagem',
          valorNovo: chave,
        },
      });
    }
  });
}

/** Gera uma URL temporária (padrão: 5 minutos) para abrir um documento já anexado. */
export async function obterUrlTemporariaDocumento(anexoId: string): Promise<string> {
  const anexo = await prisma.anexo.findUnique({ where: { id: anexoId } });
  if (!anexo) throw new DocumentoPesagemError('Documento não encontrado.');
  return gerarUrlTemporariaR2(anexo.url);
}
