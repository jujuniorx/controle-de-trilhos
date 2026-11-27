import { z } from 'zod';
import { MARCAS } from '@/lib/validation/recebimento';

/** O trilheiro leva TLS de 312 m; só estes perfis têm TLS no estoque. */
export const PERFIS_TLS = ['TR60', 'TR68'] as const;
export const TRILHEIROS_VAGAO = ['E40', 'E42', 'E46'] as const;
export const TIPOS_REMETIDO_VAGAO = ['TRANS', 'VENDA', 'INDUS'] as const;

/** NF do B.O. do trilheiro: números longos (ex.: 2100310798), pode ter traço. */
export const NF_VAGAO_REGEX = /^\d{1,12}(-\d{1,4})?$/;

/**
 * Notas do B.O. digitadas num campo só, separadas por barra, vírgula ou espaço:
 * "2100310798/2100310799" vira ["2100310798", "2100310799"]. Sem repetição, na ordem digitada.
 */
export function separarNfs(texto: string): string[] {
  const partes = texto
    .split(/[\s,;/]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return [...new Set(partes)];
}

/** Número escrito no jeito brasileiro: "64,90", "64.90" ou "1.063.017,60". Vazio -> null. Texto que não é número -> NaN (o schema recusa). */
export function lerNumeroBr(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '');
  if (!limpo) return null;
  // Aceita "1.189,65" (milhar com ponto) e "64.90" (decimal com ponto).
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  return /^\d+(\.\d+)?$/.test(normalizado) ? Number(normalizado) : Number.NaN;
}

export interface VagaoDigitado {
  serie: string;
  numero: string;
  pesoLiquido: string;
  pesoBruto: string;
}

/**
 * Lista de vagões colada (do B.O. digitado ou de uma planilha), uma linha por vagão:
 * "PDT 844028-0 64,90 86,90", com ou sem o número da linha na frente ("2 PDT ...").
 * Devolve os vagões lidos e as linhas que não deu para entender.
 */
export function lerListaVagoes(texto: string): { vagoes: VagaoDigitado[]; naoLidas: string[] } {
  const vagoes: VagaoDigitado[] = [];
  const naoLidas: string[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const partes = linha.split(/[\s;]+/).filter(Boolean);
    // Número da linha na frente (1, 2, 3...) antes da série.
    if (partes.length > 1 && /^\d{1,2}$/.test(partes[0]) && /^[A-Za-z]/.test(partes[1])) partes.shift();
    const [serie, numero, liquido = '', bruto = ''] = partes;
    if (!serie || !/^[A-Za-z]{2,5}$/.test(serie) || !numero || !/\d/.test(numero)) {
      naoLidas.push(linha);
      continue;
    }
    vagoes.push({ serie: serie.toUpperCase(), numero, pesoLiquido: liquido, pesoBruto: bruto });
  }
  return { vagoes, naoLidas };
}

const toneladas = z
  .number()
  .refine((n) => Number.isFinite(n), 'Peso inválido. Use números, ex.: 64,90.')
  .refine((n) => n >= 0 && n < 1000, 'Peso fora do normal para um vagão.')
  .nullable();

const linhaTlsSchema = z
  .object({
    perfil: z.enum(PERFIS_TLS, { message: 'Escolha o perfil.' }),
    material: z.enum(['NOVO', 'REEMPREGO'], { message: 'Escolha Novo ou Reemprego.' }),
    marca: z.enum(MARCAS).optional(),
    fabricanteOutro: z.string().trim().max(120).optional(),
    quantidade: z.number({ message: 'Informe a quantidade de TLS.' }).int('Use número inteiro de TLS.').min(1, 'Pelo menos 1 TLS.').max(200, 'Quantidade de TLS fora do normal.'),
  })
  .refine((l) => l.material !== 'NOVO' || Boolean(l.marca), { message: 'Escolha o fabricante do TLS novo.', path: ['marca'] })
  .refine((l) => l.material !== 'NOVO' || l.marca !== 'OUTROS' || Boolean(l.fabricanteOutro), {
    message: 'Informe o nome do fabricante.',
    path: ['fabricanteOutro'],
  });

const vagaoSchema = z.object({
  serie: z
    .string()
    .trim()
    .min(1, 'Informe a série do vagão.')
    .max(10)
    .transform((v) => v.toLocaleUpperCase('pt-BR')),
  numero: z.string().trim().min(1, 'Informe o número do vagão.').max(20),
  pesoLiquido: toneladas,
  pesoBruto: toneladas,
});

/** Remetido de vagão: o B.O. do trilheiro, lançado pelo Administrativo. */
export const remetidoVagaoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data do B.O.'),
  trilheiro: z.enum(TRILHEIROS_VAGAO, { message: 'Escolha o trilheiro.' }),
  nfs: z
    .array(z.string().regex(NF_VAGAO_REGEX, 'Nota fiscal inválida. Use só números, ex.: 2100310798.'))
    .max(10, 'No máximo 10 notas fiscais.'),
  destino: z
    .string()
    .trim()
    .min(2, 'Informe o destino.')
    .max(120)
    .transform((v) => v.replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR')),
  tipoRemetido: z.enum(TIPOS_REMETIDO_VAGAO),
  valorNf: z.number().refine((n) => Number.isFinite(n) && n >= 0, 'Valor da NF inválido.').nullable(),
  observacao: z.string().trim().max(500).optional(),
  movimentaEstoque: z.boolean(),
  linhas: z.array(linhaTlsSchema).min(1, 'Adicione ao menos uma linha de TLS.').max(10),
  vagoes: z.array(vagaoSchema).max(60, 'No máximo 60 vagões.'),
});

export type RemetidoVagaoInput = z.infer<typeof remetidoVagaoSchema>;
export type LinhaTlsInput = RemetidoVagaoInput['linhas'][number];
