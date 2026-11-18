import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { dentroDoLimite } from '@/lib/services/limiteTaxa';
import { ipDoCliente } from '@/lib/services/clienteIp';
import { editarMedicao, removerMedicao } from '@/lib/services/medicoes';

const corpoEdicao = z.object({
  quantidade: z.coerce.number().int().min(1).max(10000),
  comprimento: z.coerce.number().positive().max(50),
});

function resposta(corpo: unknown, status = 200) {
  return NextResponse.json(corpo, { status });
}

/** Corrige uma medição (só o administrativo). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; medicaoId: string }> }) {
  if (!(await dentroDoLimite('medicao', 120, 60_000, await ipDoCliente()))) return resposta({ erro: 'Muitas requisições. Aguarde um minuto.' }, 429);
  const usuario = await requireAdmin();
  try {
    const { id, medicaoId } = await params;
    const entrada = corpoEdicao.safeParse(await req.json().catch(() => null));
    if (!entrada.success) return resposta({ erro: 'Use quantidade inteira e comprimento entre 0 e 50 m.' }, 400);
    await editarMedicao(id, medicaoId, usuario, entrada.data);
    return resposta({ sucesso: true });
  } catch (err) {
    return resposta({ erro: err instanceof Error ? err.message : 'Não foi possível corrigir a medição.' }, 400);
  }
}

/** Apaga uma medição (só o administrativo). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; medicaoId: string }> }) {
  if (!(await dentroDoLimite('medicao', 120, 60_000, await ipDoCliente()))) return resposta({ erro: 'Muitas requisições. Aguarde um minuto.' }, 429);
  const usuario = await requireAdmin();
  try {
    const { id, medicaoId } = await params;
    await removerMedicao(id, medicaoId, usuario);
    return resposta({ sucesso: true });
  } catch (err) {
    return resposta({ erro: err instanceof Error ? err.message : 'Não foi possível apagar a medição.' }, 400);
  }
}
