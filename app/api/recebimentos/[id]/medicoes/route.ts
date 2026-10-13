import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação (apenas Junior/admin)
    const user = await requireAdmin();

    const { id } = await params;
    const { grupoId, quantidade, comprimento } = await req.json();

    if (!grupoId || !quantidade || !comprimento) {
      return NextResponse.json(
        { erro: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    // Verificar se o grupo existe e pertence a este recebimento
    const grupo = await prisma.grupo.findUnique({
      where: { id: grupoId },
      include: { movimentacao: true },
    });

    if (!grupo || grupo.movimentacao.id !== id) {
      return NextResponse.json(
        { erro: 'Grupo não encontrado ou não pertence a este recebimento' },
        { status: 404 }
      );
    }

    // Calcular metros
    const metros = Math.round(Number(quantidade) * Number(comprimento) * 100) / 100;

    // Adicionar medição
    const medicao = await prisma.medicao.create({
      data: {
        clientId: crypto.randomUUID(),
        grupoId,
        modo: 'INDIVIDUAL',
        quantidade: Number(quantidade),
        comprimento: parseFloat(String(comprimento)),
        metros: parseFloat(String(metros)),
      },
    });

    // Recalcular totais do grupo
    const medicoes = await prisma.medicao.findMany({
      where: { grupoId },
    });

    const metrosTotal = medicoes.reduce((acc, m) => acc + Number(m.metros), 0);

    await prisma.grupo.update({
      where: { id: grupoId },
      data: { metrosTotal: parseFloat(String(metrosTotal)) },
    });

    // Registrar histórico
    await prisma.historico.create({
      data: {
        movimentacaoId: id,
        acao: 'MEDICAO_ADICIONADA',
        usuarioNome: user.nome,
        usuarioId: user.id,
      },
    });

    return NextResponse.json({ sucesso: true, medicao });
  } catch (err) {
    console.error('Erro ao adicionar medição:', err);
    return NextResponse.json(
      { erro: 'Erro ao adicionar medição' },
      { status: 500 }
    );
  }
}
