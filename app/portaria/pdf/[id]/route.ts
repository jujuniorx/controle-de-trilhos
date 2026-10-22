import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validarSessao } from '@/lib/services/auth';
import { buscarFichaPortaria } from '@/lib/services/portaria';
import { gerarFichaPortariaPdf, nomeArquivoFicha } from '@/lib/pdf/fichaPortaria';

/** Baixa a ficha em PDF do que a Portaria preencheu (para mandar no WhatsApp junto com a foto da carreta). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get('sessao_admin')?.value;
  const sessao = token ? await validarSessao(token) : null;
  if (!sessao) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });

  const ficha = await buscarFichaPortaria((await params).id);
  if (!ficha) return NextResponse.json({ erro: 'Remetido não encontrado' }, { status: 404 });

  const pdf = gerarFichaPortariaPdf(ficha);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomeArquivoFicha(ficha)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
