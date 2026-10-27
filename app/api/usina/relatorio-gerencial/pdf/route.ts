import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { montarDadosRelatorio, montarTrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { gerarOnePageUsinaPdf } from '@/lib/pdf/onePageUsina';
import { colunasValidas, ehIsoValido, modoValido } from '@/lib/usina/periodo';

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Baixa a one page da usina em PDF (A4 paisagem), para qualquer aparelho. */
export async function GET(request: NextRequest) {
  await requireAdmin();
  const pedido = request.nextUrl.searchParams.get('data') ?? undefined;
  const data = ehIsoValido(pedido) ? pedido : hojeSP();
  const [dados, tril] = await Promise.all([montarDadosRelatorio(data), montarTrilheirosRelatorio(data)]);
  const modo = modoValido(request.nextUrl.searchParams.get('modo') ?? undefined);
  const colunas = colunasValidas(request.nextUrl.searchParams.getAll('col'));
  // Diário: mesmo layout do semanal e do mensal, com os valores do dia e as observações do dia embaixo.
  const NOME_SETOR: Record<string, string> = { estaleiro: 'Estaleiro', geracao: 'Geração', serra: 'Serra', caminhao: 'Caminhão', trilheiros: 'Trilheiros' };
  const observacoesDoDia = Object.entries(dados.observacoes ?? {})
    .filter(([chave, texto]) => texto && chave.startsWith(`${data}|`))
    .map(([chave, texto]) => `${NOME_SETOR[chave.split('|')[1] ?? ''] ?? chave.split('|')[1]}: ${texto}`);
  const pdf =
    modo === 'diario'
      ? gerarOnePageUsinaPdf(dados, tril, 'diario', colunas, observacoesDoDia)
      : gerarOnePageUsinaPdf(dados, tril, modo === 'mensal' ? 'mensal' : 'semanal', colunas);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="relatorio-gerencial-usina-${data}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
