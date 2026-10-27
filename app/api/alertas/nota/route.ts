import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { enviarAvisosNotaPendente } from '@/lib/services/notaEmitida';

export const dynamic = 'force-dynamic';

function autorizado(request: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const enviado = request.headers.get('authorization') ?? '';
  const esperado = `Bearer ${segredo}`;
  const a = Buffer.from(enviado);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Disparado a cada 30 min por um serviço de cron externo (com o cabeçalho Authorization: Bearer CRON_SECRET).
 * Manda o aviso de nota pendente ao admin (a cada 30 min) e ao Pátio (a cada 1 h).
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ erro: 'CRON_SECRET não configurado.' }, { status: 503 });
  }
  if (!autorizado(request)) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }
  const enviados = await enviarAvisosNotaPendente();
  return NextResponse.json({ ok: true, enviados });
}
