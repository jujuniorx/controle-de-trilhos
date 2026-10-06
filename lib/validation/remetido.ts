import { z } from 'zod';
import { validarReemprego } from '@/lib/domain/regras';
import { PERFIS, MARCAS, PLACA_REGEX, CLASSIFICACOES_SC } from '@/lib/validation/recebimento';

export const TIPOS_REMETIDO = ['VENDA', 'TRANS', 'INDUS'] as const;
export const CLASSIFICACOES_REEMPREGO_REMETIDO = ['G1', 'G2', 'G3'] as const;

export const preCadastroRemetidoSchema = z.object({
  tipoRemetido: z.enum(TIPOS_REMETIDO),
  reservaPedido: z.string().trim().min(1, 'Informe a reserva/pedido.'),
  destino: z.string().trim().min(1, 'Informe o destino.'),
  numeroDocumento: z.string().regex(/^\d{1,9}$/, 'Informe a nota fiscal, somente números.').optional(),
});

export type PreCadastroRemetidoInput = z.infer<typeof preCadastroRemetidoSchema>;

export const dadosConfirmacaoSchema = z
  .object({
    data: z.string().min(1, 'Informe a data.'),
    numeroDocumento: z.string().regex(/^\d{1,9}$/, 'Informe a nota fiscal, somente números.').optional(),
    placaCavalo: z.string().regex(PLACA_REGEX, 'Placa inválida. Ex.: ABC1D23').optional(),
    placaCarreta: z.string().regex(PLACA_REGEX, 'Placa inválida. Ex.: ABC1D23').optional(),
    transportadora: z.string().trim().max(120).optional(),
    responsavelPatio: z.string().trim().min(3, 'Informe quem está preenchendo.'),
  })
  .refine((d) => Boolean(d.placaCavalo) || Boolean(d.placaCarreta), {
    message: 'Informe ao menos a placa do cavalo ou da carreta.',
    path: ['placaCavalo'],
  });

const comprimentoSchema = z
  .number()
  .positive('O comprimento precisa ser maior que zero.')
  .transform((v) => Math.round(v * 100) / 100);

const medicaoRemetidoSchema = z.object({
  clientId: z.string().uuid(),
  modo: z.enum(['INDIVIDUAL', 'QTD_COMPRIMENTO']),
  quantidade: z.number().int().min(1).max(99),
  comprimento: comprimentoSchema,
  classificacaoSC: z.enum(CLASSIFICACOES_SC).optional(),
});

// Opcional: o Pátio normalmente não sabe o peso da NF (ler/digitar peso de nota
// fiscal é função do Administrativo/faturamento, não do Pátio). Quando ausente,
// um peso provisório é calculado por metros x fator do perfil (mesma fórmula do
// Reemprego) e sinalizado "a confirmar" até o Administrativo completar com o
// peso real da nota, na conferência — ver lib/services/remetido.ts.
const pesoInformadoSchema = z.number().positive('Informe o peso da nota fiscal, maior que zero.').optional();

const grupoRemetidoBaseSchema = z.object({
  clientId: z.string().uuid(),
  perfil: z.enum(PERFIS),
  pesoInformado: pesoInformadoSchema,
  medicoes: z.array(medicaoRemetidoSchema).min(1, 'Adicione ao menos uma medição.'),
});

const grupoRemetidoNovoSchema = grupoRemetidoBaseSchema
  .extend({
    tipoMaterial: z.literal('NOVO'),
    marca: z.enum(MARCAS).optional(),
    fabricanteOutro: z.string().trim().max(120).optional(),
  })
  .refine((g) => g.marca !== 'OUTROS' || Boolean(g.fabricanteOutro), {
    message: 'Informe o nome do fabricante quando a marca for "Outros".',
    path: ['fabricanteOutro'],
  })
  .refine((g) => g.marca === 'OUTROS' || !g.fabricanteOutro, {
    message: 'Não informe fabricanteOutro quando a marca já é uma das opções fixas.',
    path: ['fabricanteOutro'],
  });

const grupoRemetidoReempregoSchema = grupoRemetidoBaseSchema
  .extend({
    tipoMaterial: z.literal('REEMPREGO'),
    classificacao: z.enum(CLASSIFICACOES_REEMPREGO_REMETIDO),
    tampao: z.boolean().optional(),
  })
  .refine((g) => !g.tampao || g.classificacao !== 'G3', {
    message: 'Tampão só pode ser classificado como G1 ou G2.',
    path: ['classificacao'],
  })
  .refine(
    (g) => g.medicoes.every((m) => validarReemprego(m.comprimento)),
    'Toda medição de reemprego precisa ter comprimento igual ou maior que 7 m.',
  );

const grupoRemetidoSucataSchema = grupoRemetidoBaseSchema.extend({
  tipoMaterial: z.literal('SUCATA'),
  medicoes: z.array(medicaoRemetidoSchema.required({ classificacaoSC: true })).min(1, 'Adicione ao menos uma medição.'),
});

export const grupoRemetidoSchema = z.discriminatedUnion('tipoMaterial', [
  grupoRemetidoNovoSchema,
  grupoRemetidoReempregoSchema,
  grupoRemetidoSucataSchema,
]);

export type GrupoRemetidoInput = z.infer<typeof grupoRemetidoSchema>;

export const confirmacaoRemetidoSchema = z.object({
  dados: dadosConfirmacaoSchema,
  grupos: z.array(grupoRemetidoSchema).min(1, 'Adicione ao menos um grupo antes de finalizar.'),
});

export type ConfirmacaoRemetidoInput = z.infer<typeof confirmacaoRemetidoSchema>;

/**
 * Lançamento direto pelo Pátio, sem pré-cadastro prévio do Administrativo: reúne numa
 * tela só os campos que normalmente vêm do pré-cadastro (tipoRemetido/reservaPedido/
 * destino) com os da confirmação (dados + grupos) — a Movimentacao nasce direto em
 * PENDENTE_CONFERENCIA, pulando AGUARDANDO_CHEGADA.
 */
export const lancamentoDiretoRemetidoSchema = z.object({
  tipoRemetido: z.enum(TIPOS_REMETIDO),
  reservaPedido: z.string().trim().min(1, 'Informe a reserva/pedido.'),
  destino: z.string().trim().min(1, 'Informe o destino.'),
  dados: dadosConfirmacaoSchema,
  grupos: z.array(grupoRemetidoSchema).min(1, 'Adicione ao menos um grupo antes de finalizar.'),
});

export type LancamentoDiretoRemetidoInput = z.infer<typeof lancamentoDiretoRemetidoSchema>;
