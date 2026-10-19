import { prisma } from '@/lib/db';
import { ErroRegraNegocio } from '@/lib/services/errors';
import type { UsuarioAdmin } from '@/lib/services/conferencia';
import type { EditarDadosRecebimentoInput } from '@/lib/validation/recebimentoEdicao';

const CAMPOS_EDITAVEIS = [
  'dataMovimentacao',
  'origem',
  'tipoTransporte',
  'placaCavalo',
  'placaCarreta',
  'placaCarreta2',
  'responsavelPatio',
  'observacao',
] as const;

type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number];

function paraTexto(campo: CampoEditavel, valor: unknown): string | null {
  if (valor == null || valor === '') return null;
  if (campo === 'dataMovimentacao' && valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor);
}

/**
 * Corrige os dados de um recebimento (data, origem, transporte, placas, responsável, observação).
 * Só grava o que mudou, registra cada campo no histórico e, se já estava CONFERIDO,
 * reabre a conferência (mesma regra das demais correções). Nada é apagado.
 */
export async function editarDadosRecebimento(
  movimentacaoId: string,
  input: EditarDadosRecebimentoInput,
  usuario: UsuarioAdmin,
): Promise<{ alterados: CampoEditavel[] }> {
  const mov = await prisma.movimentacao.findUnique({ where: { id: movimentacaoId } });
  if (!mov || mov.tipo !== 'RECEBIMENTO') throw new ErroRegraNegocio('Recebimento não encontrado.');

  const alteracoes = CAMPOS_EDITAVEIS.flatMap((campo) => {
    const antigo = paraTexto(campo, mov[campo]);
    const novo = paraTexto(campo, input[campo]);
    return antigo === novo ? [] : [{ campo, antigo, novo }];
  });

  if (alteracoes.length === 0) return { alterados: [] };

  const reabrindo = mov.status === 'CONFERIDO';

  await prisma.$transaction(async (tx) => {
    await tx.movimentacao.update({
      where: { id: movimentacaoId },
      data: {
        ...input,
        ...(reabrindo ? { status: 'PENDENTE_CONFERENCIA', conferidoPorId: null, conferidoEm: null } : {}),
      },
    });

    for (const a of alteracoes) {
      await tx.historicoAlteracao.create({
        data: {
          movimentacaoId,
          usuarioId: usuario.userId,
          usuarioNome: usuario.nome,
          acao: 'DADOS_EDITADOS',
          campo: a.campo,
          valorAntigo: a.antigo,
          valorNovo: a.novo,
        },
      });
    }

    if (reabrindo) {
      await tx.historicoAlteracao.create({
        data: {
          movimentacaoId,
          usuarioId: usuario.userId,
          usuarioNome: usuario.nome,
          acao: 'REABERTURA',
          campo: 'status',
          valorAntigo: 'CONFERIDO',
          valorNovo: 'PENDENTE_CONFERENCIA',
        },
      });
    }
  });

  return { alterados: alteracoes.map((a) => a.campo) };
}
