'use server';

import { redirect } from 'next/navigation';
import { lancamentoDiretoRemetidoSchema, preCadastroRemetidoSchema } from '@/lib/validation/remetido';
import { criarRemetidoDireto, criarPreCadastroRemetido } from '@/lib/services/remetido';
import { requirePatioAcesso } from '@/lib/services/requirePatioAcesso';

export interface CriarRemetidoDiretoResultado {
  ok: boolean;
  erro?: string;
}

export async function criarRemetidoDiretoAction(input: unknown): Promise<CriarRemetidoDiretoResultado> {
  await requirePatioAcesso();

  const parsed = lancamentoDiretoRemetidoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: 'Dados inválidos. Revise os campos e tente novamente.' };
  }

  try {
    await criarRemetidoDireto(crypto.randomUUID(), parsed.data);
    return { ok: true };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao lançar o remetido.';
    return { ok: false, erro: mensagem };
  }
}

export interface EstadoPreCadastroPatio {
  erro?: string;
}

/** Remetido "aguardando chegada": o Pátio cadastra agora e confirma o carregamento quando o caminhão chegar. */
export async function criarPreCadastroPatioAction(
  _estadoAnterior: EstadoPreCadastroPatio,
  formData: FormData,
): Promise<EstadoPreCadastroPatio> {
  await requirePatioAcesso();

  const numeroDocumento = String(formData.get('numeroDocumento') ?? '').trim();
  const parsed = preCadastroRemetidoSchema.safeParse({
    tipoRemetido: formData.get('tipoRemetido'),
    reservaPedido: formData.get('reservaPedido'),
    destino: formData.get('destino'),
    numeroDocumento: numeroDocumento || undefined,
  });
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos. Revise os campos.' };
  }

  try {
    await criarPreCadastroRemetido(crypto.randomUUID(), parsed.data, 'Pátio');
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Erro ao cadastrar o remetido.' };
  }
  redirect('/patio/remetidos');
}
