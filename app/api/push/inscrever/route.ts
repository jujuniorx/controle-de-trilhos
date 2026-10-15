import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { validarAcessoPatio } from '@/lib/services/patioAcesso';
import { removerInscricaoPush, salvarInscricaoPush } from '@/lib/services/push';

const inscricaoSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(300), auth: z.string().min(1).max(100) }),
});

async function autorizado(): Promise<boolean> {
  const token = (await cookies()).get('acesso_patio')?.value;
  return token ? validarAcessoPatio(token) : false;
}

/** O tablet do Pátio se inscreve para receber o aviso "carreta liberada". Só com o acesso do Pátio. */
export async function POST(request: NextRequest) {
  if (!(await autorizado())) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  const parsed = inscricaoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: 'Inscrição inválida' }, { status: 400 });
  await salvarInscricaoPush(parsed.data.endpoint, parsed.data.keys.p256dh, parsed.data.keys.auth);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!(await autorizado())) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });
  const parsed = z.object({ endpoint: z.string().min(1).max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: 'Pedido inválido' }, { status: 400 });
  await removerInscricaoPush(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
