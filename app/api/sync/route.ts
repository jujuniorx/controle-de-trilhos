import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validarAcessoPatio } from '@/lib/services/patioAcesso';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';
import { ErroRegraNegocio } from '@/lib/services/errors';

/**
 * Recebe um Recebimento capturado offline (fila Dexie) e o persiste.
 *
 * O código de status aqui é contrato com `lib/offline/sync.ts`, que decide a
 * partir dele se o registro local volta para PENDENTE (será reenviado) ou vai
 * para ERRO (terminal, precisa de intervenção):
 * - 401 / 400 / 422 → terminal. Reenviar o mesmo payload nunca vai passar.
 * - 5xx            → recuperável. Falha de infraestrutura, tenta de novo depois.
 */
export async function POST(request: NextRequest) {
  const token = (await cookies()).get('acesso_patio')?.value;
  const autorizado = token ? await validarAcessoPatio(token) : false;
  if (!autorizado) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });

  // Corpo malformado é erro do cliente (400), nunca 500: sem este guard o
  // SyntaxError cairia no handler padrão do Next e viraria um 500 — que o cliente
  // agora trataria como recuperável, gerando um loop de reenvio infinito.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo da requisição não é um JSON válido.' }, { status: 400 });
  }

  const parsed = recebimentoCaminhaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Payload inválido', detalhes: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const movimentacao = await criarRecebimentoCaminhao(parsed.data);
    return NextResponse.json({ ok: true, id: movimentacao.id });
  } catch (erro) {
    // Regra de negócio (ex.: fator do perfil não cadastrado): mensagem escrita por
    // nós, segura de devolver, e terminal — reenviar não resolve.
    if (erro instanceof ErroRegraNegocio) {
      return NextResponse.json({ ok: false, erro: erro.message }, { status: 422 });
    }

    // Qualquer outra exceção (Prisma indisponível, cold start, pool esgotado,
    // deadlock, bug inesperado) é tratada como infraestrutura: 503, recuperável.
    // A mensagem original fica só no log do servidor — devolvê-la ao cliente
    // vazaria detalhes internos do Prisma/schema.
    console.error('[POST /api/sync] falha ao criar recebimento', erro);
    return NextResponse.json(
      { ok: false, erro: 'Falha temporária ao sincronizar. Tentaremos novamente.' },
      { status: 503 },
    );
  }
}
