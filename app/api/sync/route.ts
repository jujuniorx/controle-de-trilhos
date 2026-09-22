import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validarAcessoPatio } from '@/lib/services/patioAcesso';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';

export async function POST(request: NextRequest) {
  const token = (await cookies()).get('acesso_patio')?.value;
  const autorizado = token ? await validarAcessoPatio(token) : false;
  if (!autorizado) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });

  const body = await request.json();
  const parsed = recebimentoCaminhaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Payload inválido', detalhes: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const movimentacao = await criarRecebimentoCaminhao(parsed.data);
    return NextResponse.json({ ok: true, id: movimentacao.id });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao sincronizar.';
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 422 });
  }
}
