'use server';

import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { pesoSucataRealSchema } from '@/lib/validation/conferencia';
import { informarPesoSucataReal, conferirRecebimento, ConferenciaError } from '@/lib/services/conferencia';
import { enviarDocumentoPesagem, obterUrlTemporariaDocumento, DocumentoPesagemError } from '@/lib/services/documentoPesagem';

export interface AcaoResultado {
  ok: boolean;
  erro?: string;
}

export interface AcaoUrlResultado {
  ok: boolean;
  url?: string;
  erro?: string;
}

async function usuarioAtual() {
  const { userId } = await requireAdmin();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { userId, nome: user.nome };
}

function mensagemErro(erro: unknown): string {
  if (erro instanceof ConferenciaError || erro instanceof DocumentoPesagemError) return erro.message;
  return 'Não foi possível concluir a ação. Tente novamente.';
}

export async function informarPesoSucataAction(movimentacaoId: string, peso: number): Promise<AcaoResultado> {
  const parsed = pesoSucataRealSchema.safeParse(peso);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Peso inválido.' };
  }

  const usuario = await usuarioAtual();
  try {
    await informarPesoSucataReal(movimentacaoId, parsed.data, usuario);
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: mensagemErro(erro) };
  }
}

export async function conferirRecebimentoAction(movimentacaoId: string): Promise<AcaoResultado> {
  const usuario = await usuarioAtual();
  try {
    await conferirRecebimento(movimentacaoId, usuario);
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: mensagemErro(erro) };
  }
}

export async function enviarDocumentoPesagemAction(movimentacaoId: string, formData: FormData): Promise<AcaoResultado> {
  const usuario = await usuarioAtual();

  const arquivo = formData.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: 'Selecione um arquivo antes de enviar.' };
  }

  try {
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    await enviarDocumentoPesagem(movimentacaoId, { nomeOriginal: arquivo.name, contentType: arquivo.type, bytes }, usuario);
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: mensagemErro(erro) };
  }
}

export async function obterUrlDocumentoAction(anexoId: string): Promise<AcaoUrlResultado> {
  await usuarioAtual();
  try {
    const url = await obterUrlTemporariaDocumento(anexoId);
    return { ok: true, url };
  } catch (erro) {
    return { ok: false, erro: mensagemErro(erro) };
  }
}
