import { z } from 'zod';
import { MARCAS, PERFIS, nfOpcional } from '@/lib/validation/recebimento';
import { FORMAS_NOVO } from '@/lib/validation/remetido';

/** Toda barra nova que chega de vagão tem 24 m. */
export const METROS_BARRA_VAGAO = 24;

const linhaVagaoSchema = z
  .object({
    perfil: z.enum(PERFIS, { message: 'Escolha o perfil.' }),
    marca: z.enum(MARCAS, { message: 'Escolha a marca.' }),
    fabricanteOutro: z.string().trim().max(120).optional(),
    formaNovo: z.enum(FORMAS_NOVO, { message: 'Escolha se é barra lisa ou tala.' }),
    barras: z.number({ message: 'Informe o número de barras.' }).int('Número de barras inteiro.').min(1, 'Pelo menos 1 barra.').max(999),
  })
  .refine((l) => l.marca !== 'OUTROS' || Boolean(l.fabricanteOutro), {
    message: 'Informe o nome do fabricante quando a marca for "Outros".',
    path: ['fabricanteOutro'],
  });

/** Checklist do Pátio na chegada de um vagão de trilho novo (lisas e talas separadas). */
export const chegadaVagaoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
  vagao: z
    .string()
    .trim()
    .min(1, 'Informe a identificação do vagão.')
    .max(60)
    .transform((v) => v.replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR')),
  numeroDocumento: nfOpcional,
  responsavelPatio: z.string().trim().min(3, 'Informe quem está preenchendo.'),
  observacao: z.string().trim().max(500).optional(),
  linhas: z.array(linhaVagaoSchema).min(1, 'Adicione ao menos uma linha.'),
});

export type ChegadaVagaoInput = z.infer<typeof chegadaVagaoSchema>;
