import { z } from 'zod';
import { PLACA_REGEX, MSG_PLACA_INVALIDA } from '@/lib/validation/recebimento';

const placaOpcional = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
  z.union([z.literal(''), z.string().regex(PLACA_REGEX, MSG_PLACA_INVALIDA)]).transform((v) => (v === '' ? null : v)),
);

const textoOpcional = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .transform((v) => (v === '' ? null : v));

/** Campos que o Administrativo pode corrigir num recebimento já lançado (NF tem ação própria). */
export const editarDadosRecebimentoSchema = z
  .object({
    dataMovimentacao: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
      .transform((v) => new Date(`${v}T00:00:00.000Z`)),
    origem: z.string().trim().min(1, 'Informe a origem do material.').max(120, 'Origem muito longa.'),
    tipoTransporte: z.enum(['CAMINHAO', 'VAGAO', 'OUTRO']),
    placaCavalo: placaOpcional,
    placaCarreta: placaOpcional,
    placaCarreta2: placaOpcional,
    responsavelPatio: z.string().trim().min(3, 'Informe quem está preenchendo.').max(80, 'Nome muito longo.'),
    observacao: textoOpcional(500, 'Observação: no máximo 500 caracteres.'),
  })
  .refine((d) => Boolean(d.placaCavalo) || Boolean(d.placaCarreta) || Boolean(d.placaCarreta2), {
    message: 'Informe ao menos uma placa: a do cavalo ou a de uma das carretas.',
    path: ['placaCavalo'],
  });

export type EditarDadosRecebimentoEntrada = z.input<typeof editarDadosRecebimentoSchema>;
export type EditarDadosRecebimentoInput = z.output<typeof editarDadosRecebimentoSchema>;
