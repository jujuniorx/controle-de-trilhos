import { NextRequest, NextResponse } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { z } from 'zod';
import { dentroDoLimite } from '@/lib/services/limiteTaxa';
import { ipDoCliente } from '@/lib/services/clienteIp';

const corpoMedicao = z.object({
  grupoId: z.string().min(1).max(64),
  // Quantidade: barras inteiras por medição (1 a 10.000).
  quantidade: z.coerce.number().int().min(1).max(10000),
  // Comprimento em metros por barra: maior que zero e até 50 m.
  comprimento: z.coerce.number().positive().max(50),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await dentroDoLimite('medicao', 120, 60_000, await ipDoCliente()))) {
    return new Response(JSON.stringify({ erro: 'Muitas requisições. Aguarde um minuto.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }
  // Autorização fica fora do try: se a sessão expirar, o redirecionamento do Next passa direto
  // (antes era engolido pelo catch e virava erro 500).
  const user = await requireAdmin();

  try {
    const { id } = await params;
    const corpo = await req.json().catch(() => null);
    const entrada = corpoMedicao.safeParse(corpo);
    if (!entrada.success) {
      return NextResponse.json({ erro: 'Dados inválidos para a medição' }, { status: 400 });
    }
    const { grupoId, quantidade, comprimento } = entrada.data;

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
    const metros = Math.round(quantidade * comprimento * 100) / 100;

    // Adicionar medição
    const medicao = await prisma.medicao.create({
      data: {
        clientId: crypto.randomUUID(),
        grupoId,
        modo: 'INDIVIDUAL',
        quantidade,
        comprimento: new Decimal(comprimento),
        metros: new Decimal(metros),
      },
    });

    // Recalcular totais do grupo
    const medicoes = await prisma.medicao.findMany({
      where: { grupoId },
    });

    const metrosTotal = medicoes.reduce((acc, m) => acc + Number(m.metros), 0);

    await prisma.grupo.update({
      where: { id: grupoId },
      data: { metrosTotal: new Decimal(metrosTotal) },
    });

    // Registrar histórico
    await prisma.historicoAlteracao.create({
      data: {
        movimentacaoId: id,
        acao: 'MEDICAO_ADICIONADA',
        usuarioNome: user.nome,
        usuarioId: user.userId,
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
