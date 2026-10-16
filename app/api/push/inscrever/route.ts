import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { validarAcessoPatio } from '@/lib/services/patioAcesso';
import { validarSessao } from '@/lib/services/auth';
import { removerInscricaoPush, salvarInscricaoPush, type SetorPush } from '@/lib/services/push';

const inscricaoSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(300), auth: z.string().min(1).max(100) }),
});

/** Quem está pedindo: tablet do Pátio (PIN) ou usuário logado (Portaria). Null = sem acesso. */
async function setorDoPedido(): Promise<SetorPush | null> {
  const jar = await cookies();
  const pin = jar.get('acesso_patio')?.value;
  if (pin && (await validarAcessoPatio(pin))) return 'PATIO';
  const sessao = jar.get('sessao_admin')?.value;
  const usuario = sessao ? await validarSessao(sessao) : null;
  if (usuario && usuario.role !== 'ADMIN') return 'PORTARIA';
  return null;
}

/** O aparelho se inscreve para receber avisos: o tablet do Pátio ou o computador/celular da Portaria. */
export async function POST(request: NextRequest) {
  const setor = await setorDoPedido();
  if (!setor) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  const parsed = inscricaoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: 'Inscrição inválida' }, { status: 400 });
  await salvarInscricaoPush(parsed.data.endpoint, parsed.data.keys.p256dh, parsed.data.keys.auth, setor);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!(await setorDoPedido())) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  const parsed = z.object({ endpoint: z.string().min(1).max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: 'Pedido inválido' }, { status: 400 });
  await removerInscricaoPush(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
