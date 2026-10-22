import { z } from 'zod';
import { PLACA_REGEX } from '@/lib/validation/recebimento';

/** Campo em branco vira "não informado" — na Portaria nada é obrigatório, exceto uma placa para liberar. */
function opcional<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());
}

/** Valida CPF pelos dígitos verificadores (evita erro de digitação; recusa 111.111.111-11). */
export function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const dv = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce((acc, d, i) => acc + Number(d) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(digitos.slice(0, 9), 10) === Number(digitos[9]) && dv(digitos.slice(0, 10), 11) === Number(digitos[10]);
}

const placa = opcional(
  z
    .string()
    .trim()
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .pipe(z.string().regex(PLACA_REGEX, 'Placa inválida. Ex.: ABC1D23 (Mercosul) ou CMG1234 (padrão antigo).')),
);

// Só confere o tamanho (11 números). Não confere os dígitos verificadores de propósito: a Portaria
// copia de um documento e um número errado não pode impedir de salvar nem de liberar a carreta.
const cpf = opcional(
  z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{11}$/, 'CPF precisa ter 11 números.')),
);

const telefone = opcional(
  z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{10,11}$/, 'Telefone inválido. Informe DDD + número.')),
);

const capacidade = opcional(
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(v.replace(',', '.'))))
    .pipe(z.number().positive('A capacidade precisa ser maior que zero.').max(200, 'Capacidade muito alta (máx. 200 t).')),
);

const comprimento = opcional(
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(v.replace(',', '.'))))
    .pipe(z.number().positive('O comprimento precisa ser maior que zero.').max(60, 'Comprimento muito alto (máx. 60 m).')),
);

/** CPF digitado com os pontos e o traço automáticos (000.000.000-00). Só a formatação, não valida dígitos. */
export function formatarCpfDigitado(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  const grupos = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join('.');
  return d.length > 9 ? `${grupos}-${d.slice(9)}` : grupos;
}

const texto = (max: number) => opcional(z.string().trim().max(max, `Máximo de ${max} caracteres.`));

export const dadosPortariaSchema = z.object({
  origem: texto(120),
  destino: texto(120),
  materialPrevisto: texto(120),
  // Recado da Portaria para o Pátio.
  observacao: texto(500),
  transportadora: texto(120),
  motoristaNome: texto(80),
  motoristaCpf: cpf,
  motoristaTelefone: telefone,
  placaCarreta: placa,
  placaCarreta2: placa,
  placaCavalo: placa,
  capacidadeCarga: capacidade,
  comprimentoCarreta: comprimento,
});

export type DadosPortaria = z.infer<typeof dadosPortariaSchema>;

export const MSG_PRECISA_DE_PLACA = 'Informe ao menos uma placa (cavalo ou carreta) para liberar.';

/** Envio criado pela própria Portaria (carreta que chegou sem o Pátio ter cadastrado): destino obrigatório. */
export const novoEnvioPortariaSchema = dadosPortariaSchema
  .extend({ destino: z.string().trim().min(1, 'Informe o destino.').max(120, 'Máximo de 120 caracteres.') })
  .refine((d) => Boolean(d.placaCavalo || d.placaCarreta || d.placaCarreta2), {
    message: 'Informe ao menos uma placa (cavalo ou carreta).',
    path: ['placaCarreta'],
  });
export type NovoEnvioPortariaInput = z.infer<typeof novoEnvioPortariaSchema>;
