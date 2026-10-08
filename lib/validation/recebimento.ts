import { z } from 'zod';
import { validarReemprego } from '@/lib/domain/regras';

export const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

// Aceita o formato real usado pela empresa, com traço (ex.: "087781-1"), além
// de só números (Bloco 2.3).
export const NF_REGEX = /^\d{1,9}(-\d{1,4})?$/;
export const MSG_NF_INVALIDA = 'Informe a nota fiscal (números, pode ter traço — ex.: 087781-1).';

export const PERFIS = [
  'TR22', 'TR32', 'TR37', 'TR40', 'TR45', 'TR50', 'TR54', 'TR55', 'TR57', 'TR60', 'TR68',
] as const;

export const CLASSIFICACOES_REEMPREGO = ['G1', 'G2', 'G3'] as const;
export const CLASSIFICACOES_SC = ['SC1', 'SC2', 'SC3'] as const;

// Lista fechada de marcas (V1.2 §11) — "OUTROS" libera o texto livre em fabricanteOutro.
export const MARCAS = ['NIPPON', 'EVRAZ', 'PANGANG', 'OUTROS'] as const;
export const MARCA_LABEL: Record<Exclude<(typeof MARCAS)[number], 'OUTROS'>, string> = {
  NIPPON: 'Nippon',
  EVRAZ: 'Evraz',
  PANGANG: 'Pangang',
};

// Aceita os dois formatos que convivem na frota real: Mercosul (ABC1D23) e o
// padrão antigo brasileiro (3 letras + 4 dígitos, ex.: CMG1234) — o 5º
// caractere é letra OU dígito.
const MSG_PLACA_INVALIDA = 'Placa inválida. Ex.: ABC1D23 (Mercosul) ou CMG1234 (padrão antigo).';
const MSG_PELO_MENOS_UMA_PLACA =
  'Informe ao menos uma placa: a do cavalo ou a de uma das carretas (no máximo 2 carretas).';

export const dadosCarregamentoSchema = z
  .object({
    data: z.string().min(1, 'Informe a data do recebimento.'),
    numeroDocumento: z.string().regex(NF_REGEX, MSG_NF_INVALIDA),
    origem: z.string().trim().min(1, 'Informe a origem do material.'),
    // Nenhuma placa é individualmente obrigatória — a regra é "pelo menos uma
    // das três" (refine abaixo). Um cavalo pode puxar até 2 carretas; a 2ª é opcional.
    placaCavalo: z.string().regex(PLACA_REGEX, MSG_PLACA_INVALIDA).optional(),
    placaCarreta: z.string().regex(PLACA_REGEX, MSG_PLACA_INVALIDA).optional(),
    placaCarreta2: z.string().regex(PLACA_REGEX, MSG_PLACA_INVALIDA).optional(),
    transportadora: z.string().trim().max(120).optional(),
    responsavelPatio: z.string().trim().min(3, 'Informe quem está preenchendo.'),
  })
  .refine((d) => Boolean(d.placaCavalo) || Boolean(d.placaCarreta) || Boolean(d.placaCarreta2), {
    message: MSG_PELO_MENOS_UMA_PLACA,
    path: ['placaCavalo'],
  });

// Metragem sem limite máximo; normalizada para 2 casas decimais (convenção já usada no protótipo).
const comprimentoSchema = z
  .number()
  .positive('O comprimento precisa ser maior que zero.')
  .transform((v) => Math.round(v * 100) / 100);

const medicaoSchema = z.object({
  clientId: z.string().uuid(),
  modo: z.enum(['INDIVIDUAL', 'QTD_COMPRIMENTO']),
  quantidade: z.number().int().min(1).max(99),
  comprimento: comprimentoSchema,
  classificacaoSC: z.enum(CLASSIFICACOES_SC).optional(),
});

const grupoNovoSchema = z
  .object({
    clientId: z.string().uuid(),
    perfil: z.enum(PERFIS),
    tipoMaterial: z.literal('NOVO'),
    // Obrigatória só para NOVO (Bloco 1.5) — Reemprego e Sucata não têm marca.
    marca: z.enum(MARCAS, { message: 'Selecione a marca/fabricante.' }),
    fabricanteOutro: z.string().trim().max(120).optional(),
    medicoes: z
      .array(medicaoSchema.omit({ classificacaoSC: true }))
      .min(1, 'Adicione ao menos uma medição.'),
  })
  .refine((g) => g.marca !== 'OUTROS' || Boolean(g.fabricanteOutro), {
    message: 'Informe o nome do fabricante quando a marca for "Outros".',
    path: ['fabricanteOutro'],
  })
  .refine((g) => g.marca === 'OUTROS' || !g.fabricanteOutro, {
    message: 'Não informe fabricanteOutro quando a marca já é uma das opções fixas.',
    path: ['fabricanteOutro'],
  });

const grupoReempregoSchema = z.object({
  clientId: z.string().uuid(),
  perfil: z.enum(PERFIS),
  tipoMaterial: z.literal('REEMPREGO'),
  classificacao: z.enum(CLASSIFICACOES_REEMPREGO),
  medicoes: z
    .array(medicaoSchema.omit({ classificacaoSC: true }))
    .min(1, 'Adicione ao menos uma medição.')
    .refine(
      (medicoes) => medicoes.every((m) => validarReemprego(m.comprimento)),
      'Toda medição de reemprego precisa ter comprimento igual ou maior que 7 m.',
    ),
});

const grupoSucataSchema = z.object({
  clientId: z.string().uuid(),
  perfil: z.enum(PERFIS),
  tipoMaterial: z.literal('SUCATA'),
  medicoes: z
    .array(medicaoSchema.required({ classificacaoSC: true }))
    .min(1, 'Adicione ao menos uma medição.'),
});

export const grupoSchema = z.discriminatedUnion('tipoMaterial', [
  grupoNovoSchema,
  grupoReempregoSchema,
  grupoSucataSchema,
]);

export const recebimentoCaminhaoSchema = z.object({
  clientId: z.string().uuid(),
  dados: dadosCarregamentoSchema,
  grupos: z.array(grupoSchema).min(1, 'Adicione ao menos um grupo antes de finalizar.'),
});

export type DadosCarregamentoInput = z.infer<typeof dadosCarregamentoSchema>;
export type MedicaoInput = z.infer<typeof medicaoSchema>;
export type GrupoInput = z.infer<typeof grupoSchema>;
export type RecebimentoCaminhaoInput = z.infer<typeof recebimentoCaminhaoSchema>;
