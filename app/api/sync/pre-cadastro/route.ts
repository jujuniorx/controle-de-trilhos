import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validarAcessoPatio } from '@/lib/services/patioAcesso';
import { preCadastroSyncSchema } from '@/lib/validation/remetido';
import { criarPreCadastroRemetido } from '@/lib/services/remetido';
import { ErroRegraNegocio } from '@/lib/services/errors';

/**
 * Recebe um pré-cadastro de remetido ("aguardando chegada") capturado no Pátio —
 * possivelmente sem internet, via fila Dexie — e o persiste. Idempotente por clientId.
 *
 * Mesmo contrato de status de POST /api/sync (lib/offline/sync.ts decide por ele):
 * 401 / 400 / 422 são terminais; 5xx é recuperável e será reenviado.
 */
export async function POST(request: NextRequest) {
  const token = (await cookies()).get('acesso_patio')?.value;
  const autorizado = token ? await validarAcessoPatio(token) : false;
  if (!autorizado) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo da requisição não é um JSON válido.' }, { status: 400 });
  }

  const parsed = preCadastroSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Payload inválido', detalhes: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { clientId, ...dados } = parsed.data;
    const movimentacao = await criarPreCadastroRemetido(clientId, dados, 'Pátio');
    return NextResponse.json({ ok: true, id: movimentacao.id });
  } catch (erro) {
    if (erro instanceof ErroRegraNegocio) {
      return NextResponse.json({ ok: false, erro: erro.message }, { status: 422 });
    }
    console.error('[POST /api/sync/pre-cadastro] falha ao criar pré-cadastro', erro);
    return NextResponse.json(
      { ok: false, erro: 'Falha temporária ao sincronizar. Tentaremos novamente.' },
      { status: 503 },
    );
  }
}
