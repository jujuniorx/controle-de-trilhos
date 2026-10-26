import { prisma } from '@/lib/db';

/** Setores que têm observação diária (o trilheiro já tem observação por trilheiro). */
export const SETORES_OBSERVACAO = [
  { valor: 'estaleiro', rotulo: 'Estaleiro de solda' },
  { valor: 'geracao', rotulo: 'Geração de trilho' },
  { valor: 'serra', rotulo: 'Recolhimento serra' },
  { valor: 'caminhao', rotulo: 'Caminhão de solda' },
] as const;

const dataBanco = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Observações do período: chave "AAAA-MM-DD|setor". */
export async function observacoesDoPeriodo(inicio: string, fim: string): Promise<Record<string, string>> {
  const linhas = await prisma.observacaoSetorDia.findMany({ where: { data: { gte: dataBanco(inicio), lte: dataBanco(fim) } } });
  return Object.fromEntries(linhas.map((l) => [`${iso(l.data)}|${l.setor}`, l.texto ?? '']));
}

/** Grava a observação de um setor em um dia. Texto vazio apaga a observação. */
export async function salvarObservacaoSetor(data: string, setor: string, texto: string | null) {
  const limpo = texto && texto.trim() ? texto.trim() : null;
  await prisma.observacaoSetorDia.upsert({
    where: { data_setor: { data: dataBanco(data), setor } },
    update: { texto: limpo },
    create: { data: dataBanco(data), setor, texto: limpo },
  });
}
