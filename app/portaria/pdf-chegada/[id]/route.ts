import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validarSessao } from '@/lib/services/auth';
import { buscarFichaChegada } from '@/lib/services/chegada';
import { gerarFichaPortariaPdf, nomeArquivoFicha } from '@/lib/pdf/fichaPortaria';

/** Baixa a ficha em PDF de uma chegada (recebimento) para mandar no WhatsApp com a foto do caminhão. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get('sessao_admin')?.value;
  const sessao = token ? await validarSessao(token) : null;
  if (!sessao) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 });

  const ficha = await buscarFichaChegada((await params).id);
  if (!ficha) return NextResponse.json({ erro: 'Chegada não encontrada' }, { status: 404 });

  const pdf = gerarFichaPortariaPdf(ficha);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomeArquivoFicha(ficha)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
