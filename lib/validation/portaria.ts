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

const cpf = opcional(
  z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .pipe(z.string().refine(cpfValido, 'CPF inválido. Confira os números.')),
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

const texto = (max: number) => opcional(z.string().trim().max(max, `Máximo de ${max} caracteres.`));

export const dadosPortariaSchema = z.object({
  origem: texto(120),
  destino: texto(120),
  materialPrevisto: texto(120),
  transportadora: texto(120),
  motoristaNome: texto(80),
  motoristaCpf: cpf,
  motoristaTelefone: telefone,
  placaCarreta: placa,
  placaCavalo: placa,
  capacidadeCarga: capacidade,
});

export type DadosPortaria = z.infer<typeof dadosPortariaSchema>;

export const MSG_PRECISA_DE_PLACA = 'Informe ao menos uma placa (cavalo ou carreta) para liberar.';
