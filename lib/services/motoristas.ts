import { prisma } from '@/lib/db';
import { resumirMotorista, type MotoristaEncontrado } from '@/lib/domain/motoristaPortaria';
import { formatarCpf } from '@/lib/domain/portaria';

/** Quantas viagens de cada tabela entram na busca (as mais recentes). */
const LIMITE = 40;

const num = (d: unknown) => (d == null ? null : Number(d));

/**
 * Portaria: tudo o que já foi preenchido para este CPF, nas cargas (Movimentacao) e nas descargas
 * (ChegadaCaminhao). Só leitura. CPF com menos de 11 números não busca nada.
 */
export async function buscarMotoristaPorCpf(cpfDigitado: string, excluirId?: string): Promise<MotoristaEncontrado | null> {
  const cpf = cpfDigitado.replace(/\D/g, '');
  if (cpf.length !== 11) return null;
  // O CPF é gravado só com números; o formatado cobre algum registro antigo gravado com pontos.
  const formas = [cpf, formatarCpf(cpf)];
  // A viagem que está aberta na tela não conta como "anterior".
  const fora = excluirId ? { id: { not: excluirId } } : {};

  const campos = {
    motoristaNome: true,
    motoristaTelefone: true,
    transportadora: true,
    placaCavalo: true,
    placaCarreta: true,
    placaCarreta2: true,
    capacidadeCarga: true,
    comprimentoCarreta: true,
  } as const;

  const [cargas, descargas] = await Promise.all([
    prisma.movimentacao.findMany({
      where: { motoristaCpf: { in: formas }, ...fora },
      select: { ...campos, createdAt: true, chegadaPortariaEm: true },
      orderBy: { createdAt: 'desc' },
      take: LIMITE,
    }),
    prisma.chegadaCaminhao.findMany({
      where: { motoristaCpf: { in: formas }, canceladaEm: null, ...fora },
      select: { ...campos, criadoEm: true, liberadaEm: true },
      orderBy: { criadoEm: 'desc' },
      take: LIMITE,
    }),
  ]);

  const viagem = (r: (typeof cargas)[number] | (typeof descargas)[number], quando: Date) => ({
    quando,
    nome: r.motoristaNome,
    telefone: r.motoristaTelefone,
    transportadora: r.transportadora,
    placaCavalo: r.placaCavalo,
    placaCarreta: r.placaCarreta,
    placaCarreta2: r.placaCarreta2,
    capacidadeCarga: num(r.capacidadeCarga),
    comprimentoCarreta: num(r.comprimentoCarreta),
  });

  return resumirMotorista([
    ...cargas.map((r) => viagem(r, r.chegadaPortariaEm ?? r.createdAt)),
    ...descargas.map((r) => viagem(r, r.liberadaEm ?? r.criadoEm)),
  ]);
}
