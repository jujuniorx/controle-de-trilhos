import { z } from 'zod';
import { validarReemprego } from '@/lib/domain/regras';
import { PERFIS, MARCAS, PLACA_REGEX, CLASSIFICACOES_SC, NF_REGEX, MSG_NF_INVALIDA } from '@/lib/validation/recebimento';

const MSG_PLACA_INVALIDA = 'Placa inválida. Ex.: ABC1D23 (Mercosul) ou CMG1234 (padrão antigo).';
const MSG_PELO_MENOS_UMA_PLACA =
  'Informe ao menos uma placa: a do cavalo ou a de uma das carretas (no máximo 2 carretas).';

export const TIPOS_REMETIDO = ['VENDA', 'TRANS', 'INDUS'] as const;

/**
 * "Diversos" do Remetido: tocos de sucata pesados juntos, SEM medição. O Pátio só lança o
 * grupo (perfil TOCO, material SUCATA); o peso real vem da pesagem do caminhão e só o
 * Administrativo informa (PesoGrupoPainel). Na planilha: Peças e Metros ficam "-".
 */
export const PERFIL_TOCO = 'TOCO' as const;
export const CLASSIFICACOES_REEMPREGO_REMETIDO = ['G1', 'G2', 'G3'] as const;

export const preCadastroRemetidoSchema = z.object({
  // Opcional: no "Aguardando chegada" o Pátio mede os trilhos antes do caminhão
  // chegar e muitas vezes não sabe o tipo (Venda/Transferência/Industrialização).
  // O Administrativo completa depois — ver informarTipoRemetido em services/remetido.
  // Só o destino é obrigatório.
  tipoRemetido: z.enum(TIPOS_REMETIDO).optional(),
  // Opcional: o Pátio não precisa informar (igual ao lançamento direto); fica nulo.
  reservaPedido: z.string().trim().min(1).optional(),
  destino: z.string().trim().min(1, 'Informe o destino.'),
  numeroDocumento: z.string().regex(NF_REGEX, MSG_NF_INVALIDA).optional(),
});

export type PreCadastroRemetidoInput = z.infer<typeof preCadastroRemetidoSchema>;

// Pré-cadastro feito pelo Pátio, que pode estar sem internet: nasce com um clientId
// (gerado no tablet) para o servidor aceitar o reenvio sem duplicar — mesmo contrato
// do Recebimento (lib/offline/sync.ts + POST /api/sync).
export const preCadastroSyncSchema = preCadastroRemetidoSchema.extend({
  clientId: z.string().uuid(),
});
export type PreCadastroSyncInput = z.infer<typeof preCadastroSyncSchema>;

// Base da confirmação: sem a regra de placa. No "Aguardando chegada" o Pátio só mede;
// a placa vem da Portaria (ela é quem sabe quando a carreta chega), então não é exigida aqui.
const dadosConfirmacaoBaseSchema = z.object({
    data: z.string().min(1, 'Informe a data.'),
    numeroDocumento: z.string().regex(NF_REGEX, MSG_NF_INVALIDA).optional(),
    placaCavalo: z.string().regex(PLACA_REGEX, MSG_PLACA_INVALIDA).optional(),
    placaCarreta: z.string().regex(PLACA_REGEX, MSG_PLACA_INVALIDA).optional(),
    placaCarreta2: z.string().regex(PLACA_REGEX, MSG_PLACA_INVALIDA).optional(),
    transportadora: z.string().trim().max(120).optional(),
    responsavelPatio: z.string().trim().min(3, 'Informe quem está preenchendo.'),
    observacao: z.string().trim().max(500, 'Observação: no máximo 500 caracteres.').optional(),
});

// Lançamento direto (Pátio com o caminhão na frente): aqui a placa é obrigatória.
export const dadosConfirmacaoSchema = dadosConfirmacaoBaseSchema.refine(
  (d) => Boolean(d.placaCavalo) || Boolean(d.placaCarreta) || Boolean(d.placaCarreta2),
  { message: MSG_PELO_MENOS_UMA_PLACA, path: ['placaCavalo'] },
);

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
// O peso é SEMPRE em toneladas (o fator do perfil é t/m). Um grupo de remetido cabe
// numa carreta, então acima disso quase certamente o valor foi digitado em kg
// (ex.: 31180 em vez de 31,18) — recusar evita gravar um peso 1000x maior.
export const PESO_MAX_GRUPO_T = 100;
export const MSG_PESO_UNIDADE = `Peso em toneladas, no máximo ${PESO_MAX_GRUPO_T} t por grupo. Se a nota está em kg, divida por 1000 (ex.: 31180 kg = 31,18 t).`;

const pesoInformadoSchema = z
  .number()
  .positive('Informe o peso da nota fiscal, maior que zero.')
  .max(PESO_MAX_GRUPO_T, MSG_PESO_UNIDADE)
  .optional();

const grupoRemetidoBaseSchema = z.object({
  clientId: z.string().uuid(),
  perfil: z.enum(PERFIS),
  pesoInformado: pesoInformadoSchema,
  medicoes: z.array(medicaoRemetidoSchema).min(1, 'Adicione ao menos uma medição.'),
});

const grupoRemetidoNovoSchema = grupoRemetidoBaseSchema
  .extend({
    tipoMaterial: z.literal('NOVO'),
    // Obrigatória só para NOVO (Bloco 1.5) — Reemprego e Sucata não têm marca.
    marca: z.enum(MARCAS, { message: 'Selecione a marca/fabricante.' }),
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

const grupoRemetidoSucataSchema = grupoRemetidoBaseSchema
  .extend({
    tipoMaterial: z.literal('SUCATA'),
    // TOCO = Diversos (só peso, sem medição). Os demais perfis exigem medições com classificação SC.
    perfil: z.enum([...PERFIS, PERFIL_TOCO]),
    medicoes: z.array(medicaoRemetidoSchema.required({ classificacaoSC: true })),
  })
  .refine((g) => g.perfil === PERFIL_TOCO || g.medicoes.length >= 1, {
    message: 'Adicione ao menos uma medição.',
    path: ['medicoes'],
  })
  .refine((g) => g.perfil !== PERFIL_TOCO || g.medicoes.length === 0, {
    message: 'Diversos (TOCO) não tem medição — só o peso, informado depois pelo Administrativo.',
    path: ['medicoes'],
  })
  .refine((g) => g.perfil !== PERFIL_TOCO || g.pesoInformado == null, {
    message: 'O peso do Diversos é informado pelo Administrativo, depois da pesagem.',
    path: ['pesoInformado'],
  });

export const grupoRemetidoSchema = z.discriminatedUnion('tipoMaterial', [
  grupoRemetidoNovoSchema,
  grupoRemetidoReempregoSchema,
  grupoRemetidoSucataSchema,
]);

export type GrupoRemetidoInput = z.infer<typeof grupoRemetidoSchema>;

export const confirmacaoRemetidoSchema = z.object({
  dados: dadosConfirmacaoBaseSchema,
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
  // Opcional aqui (Bloco 2.2): o Pátio, lançando direto sem pré-cadastro, não
  // tem essa informação (Venda/Transferência/Industrialização é decisão do
  // Administrativo/faturamento). Completado depois na conferência — ver
  // lib/services/remetido.ts#informarTipoRemetido.
  tipoRemetido: z.enum(TIPOS_REMETIDO).optional(),
  // Opcional aqui também: no lançamento direto pelo Pátio o campo foi removido
  // da tela (o Administrativo não usa essa referência nesse fluxo) — o campo
  // em si continua existindo no banco e no pré-cadastro/Admin, intocado.
  reservaPedido: z.string().trim().min(1).optional(),
  destino: z.string().trim().min(1, 'Informe o destino.'),
  dados: dadosConfirmacaoSchema,
  grupos: z.array(grupoRemetidoSchema).min(1, 'Adicione ao menos um grupo antes de finalizar.'),
});

export type LancamentoDiretoRemetidoInput = z.infer<typeof lancamentoDiretoRemetidoSchema>;
