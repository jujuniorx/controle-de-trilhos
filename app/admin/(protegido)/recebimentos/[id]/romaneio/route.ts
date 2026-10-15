import type { NextRequest } from 'next/server';
import { buscarMovimentacaoDetalhe } from '@/lib/services/movimentacao';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { htmlRomaneioRecebimento, paginaMensagem, respostaHtml } from '@/lib/romaneio';

// Route handler (e não page.tsx): o romaneio é um documento HTML completo, pronto para
// imprimir, sem o layout do painel. A geração do HTML está em lib/romaneio.ts.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Fora do try: sem sessão, requireAdmin() faz redirect() (que é uma exceção do Next).
  await requireAdmin();
  const { id } = await params;

  try {
    const mov = await buscarMovimentacaoDetalhe(id);
    if (!mov) return respostaHtml(paginaMensagem('Recebimento não encontrado.'), 404);
    // O middleware coloca o nonce do CSP neste cabeçalho; o script dos botões precisa dele.
    return respostaHtml(htmlRomaneioRecebimento(mov, req.headers.get('x-nonce')));
  } catch (err) {
    console.error('Erro ao gerar romaneio de recebimento:', id, err);
    return respostaHtml(paginaMensagem('Não foi possível gerar o romaneio. Tente novamente.'), 500);
  }
}
