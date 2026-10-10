import { z } from 'zod';
import { PERFIS, NF_REGEX } from '@/lib/validation/recebimento';

export const TIPOS_MOVIMENTACAO = ['RECEBIMENTO', 'REMETIDO'] as const;
export const MATERIAIS_RELATORIO = ['NOVO', 'REEMPREGO', 'SUCATA'] as const;
export const STATUS_RELATORIO = ['AGUARDANDO_CHEGADA', 'PENDENTE_CONFERENCIA', 'CONFERIDO'] as const;

/**
 * Filtros vêm de searchParams (tudo string | undefined) — tratamos aqui
 * mesmo o que a UI nunca deveria mandar fora da lista, porque searchParams
 * pode ser manipulado livremente na URL.
 */
export const filtrosRelatorioSchema = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  tipo: z.enum(TIPOS_MOVIMENTACAO).optional().catch(undefined),
  perfil: z.enum(PERFIS).optional().catch(undefined),
  material: z.enum(MATERIAIS_RELATORIO).optional().catch(undefined),
  origemDestino: z.string().trim().min(1).max(120).optional().catch(undefined),
  numeroDocumento: z.string().trim().regex(NF_REGEX).optional().catch(undefined),
  status: z.enum(STATUS_RELATORIO).optional().catch(undefined),
});

export type FiltrosRelatorioInput = z.infer<typeof filtrosRelatorioSchema>;
