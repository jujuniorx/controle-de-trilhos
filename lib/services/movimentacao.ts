import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { calcularMetros, calcularPeso, calcularPesoEstimado } from '@/lib/services/calculo';
import { arredondar3 } from '@/lib/domain/regras';
import { registrarHistorico } from '@/lib/services/historico';
import { MARCA_LABEL, type RecebimentoCaminhaoInput } from '@/lib/validation/recebimento';

/** Deriva o texto gravado em Grupo.fabricante a partir da marca fechada (ou do texto livre quando "OUTROS"). */
function resolverFabricante(
  grupo: Extract<RecebimentoCaminhaoInput['grupos'][number], { tipoMaterial: 'NOVO' }>,
): string | null {
  if (!grupo.marca) return null;
  return grupo.marca === 'OUTROS' ? grupo.fabricanteOutro ?? null : MARCA_LABEL[grupo.marca];
}

interface GrupoParaCriar {
  clientId: string;
  perfil: RecebimentoCaminhaoInput['grupos'][number]['perfil'];
  tipoMaterial: 'NOVO' | 'REEMPREGO' | 'SUCATA';
  classificacao: 'G1' | 'G2' | 'G3' | null;
  fabricante: string | null;
  metrosTotal: number;
  pesoCalculado: number | null;
  medicoes: {
    clientId: string;
    modo: 'INDIVIDUAL' | 'QTD_COMPRIMENTO';
    quantidade: number;
    comprimento: number;
    metros: number;
    classificacaoSC: 'SC1' | 'SC2' | 'SC3' | null;
  }[];
}

async function prepararGrupos(input: RecebimentoCaminhaoInput): Promise<GrupoParaCriar[]> {
  const gruposParaCriar: GrupoParaCriar[] = [];

  for (const grupo of input.grupos) {
    const metrosPorMedicao = grupo.medicoes.map((m) => calcularMetros(m.quantidade, m.comprimento));
    const metrosTotal = metrosPorMedicao.reduce((a, b) => a + b, 0);

    if (grupo.tipoMaterial === 'SUCATA') {
      // Estimativa (metros x fator) — NUNCA pode bloquear o salvamento do Pátio.
      // Se o fator do perfil não estiver cadastrado, fica sem estimativa (null),
      // igual ao comportamento anterior a esta estimativa existir. O peso REAL
      // continua vivendo em Movimentacao.pesoSucataReal (ver resumoPeso()/conferirRecebimento()).
      const pesoCalculado = await calcularPesoEstimado(metrosTotal, grupo.perfil);
      gruposParaCriar.push({
        clientId: grupo.clientId,
        perfil: grupo.perfil,
        tipoMaterial: 'SUCATA',
        classificacao: null,
        fabricante: null,
        metrosTotal,
        pesoCalculado,
        medicoes: grupo.medicoes.map((m, i) => ({
          clientId: m.clientId,
          modo: m.modo,
          quantidade: m.quantidade,
          comprimento: m.comprimento,
          metros: metrosPorMedicao[i],
          classificacaoSC: m.classificacaoSC,
        })),
      });
      continue;
    }

    // NOVO e REEMPREGO: peso é obrigatório — perfil sem fator cadastrado bloqueia
    // de propósito (regra de negócio já existente e testada).
    const pesoCalculado = await calcularPeso(metrosTotal, grupo.perfil);
    gruposParaCriar.push({
      clientId: grupo.clientId,
      perfil: grupo.perfil,
      tipoMaterial: grupo.tipoMaterial,
      classificacao: grupo.tipoMaterial === 'REEMPREGO' ? grupo.classificacao : null,
      fabricante: grupo.tipoMaterial === 'NOVO' ? resolverFabricante(grupo) : null,
      metrosTotal,
      pesoCalculado,
      medicoes: grupo.medicoes.map((m, i) => ({
        clientId: m.clientId,
        modo: m.modo,
        quantidade: m.quantidade,
        comprimento: m.comprimento,
        metros: metrosPorMedicao[i],
        classificacaoSC: null,
      })),
    });
  }

  return gruposParaCriar;
}

export async function criarRecebimentoCaminhao(input: RecebimentoCaminhaoInput) {
  const existente = await prisma.movimentacao.findUnique({
    where: { clientId: input.clientId },
    include: { grupos: { include: { medicoes: true } } },
  });
  if (existente) return existente;

  const gruposParaCriar = await prepararGrupos(input);

  const movimentacao = await prisma.$transaction(async (tx) => {
    const mov = await tx.movimentacao.create({
      data: {
        clientId: input.clientId,
        tipo: 'RECEBIMENTO',
        tipoDocumento: 'NF',
        numeroDocumento: input.dados.numeroDocumento,
        tipoTransporte: 'CAMINHAO',
        placaCavalo: input.dados.placaCavalo ?? null,
        placaCarreta: input.dados.placaCarreta ?? null,
        placaCarreta2: input.dados.placaCarreta2 ?? null,
        transportadora: input.dados.transportadora ?? null,
        origem: input.dados.origem,
        responsavelPatio: input.dados.responsavelPatio,
        dataMovimentacao: new Date(`${input.dados.data}T00:00:00`),
      },
    });

    for (const grupo of gruposParaCriar) {
      const grupoCriado = await tx.grupo.create({
        data: {
          clientId: grupo.clientId,
          movimentacaoId: mov.id,
          perfil: grupo.perfil,
          tipoMaterial: grupo.tipoMaterial,
          classificacao: grupo.classificacao,
          fabricante: grupo.fabricante,
          metrosTotal: grupo.metrosTotal,
          pesoCalculado: grupo.pesoCalculado,
        },
      });

      for (const medicao of grupo.medicoes) {
        await tx.medicao.create({
          data: {
            clientId: medicao.clientId,
            grupoId: grupoCriado.id,
            modo: medicao.modo,
            quantidade: medicao.quantidade,
            comprimento: medicao.comprimento,
            metros: medicao.metros,
            classificacaoSC: medicao.classificacaoSC,
          },
        });
      }
    }

    return tx.movimentacao.findUniqueOrThrow({
      where: { id: mov.id },
      include: { grupos: { include: { medicoes: true } } },
    });
  });

  await registrarHistorico({
    movimentacaoId: movimentacao.id,
    usuarioNome: `${input.dados.responsavelPatio} (pátio)`,
    acao: 'CRIACAO',
  });

  return movimentacao;
}

export type MovimentacaoComGrupos = Prisma.MovimentacaoGetPayload<{
  include: { grupos: { include: { medicoes: true } }; anexos: true; historico: true };
}>;

export function listarPendentesConferencia() {
  return prisma.movimentacao.findMany({
    where: { status: 'PENDENTE_CONFERENCIA' },
    orderBy: { dataMovimentacao: 'desc' },
  });
}

export function buscarMovimentacaoDetalhe(id: string): Promise<MovimentacaoComGrupos | null> {
  return prisma.movimentacao.findUnique({
    where: { id },
    include: {
      grupos: { include: { medicoes: true } },
      anexos: true,
      historico: { orderBy: { timestamp: 'desc' } },
    },
  });
}

export interface ResumoPeso {
  temSucata: boolean;
  pesoNovo: number;
  pesoReemprego: number;
  /** Soma de NOVO + REEMPREGO — mantido para compatibilidade com o resumo já usado na conferência. */
  pesoNovoReemprego: number;
  /** Estimativa (metros x fator) para os grupos SUCATA — "a confirmar" até o Admin informar pesoSucataReal. */
  pesoSucataEstimado: number;
  pesoSucataReal: number | null;
  pendente: boolean;
  pesoTotal: number | null;
}

function somaPeso(movimentacao: MovimentacaoComGrupos, tipo: 'NOVO' | 'REEMPREGO' | 'SUCATA'): number {
  return arredondar3(
    movimentacao.grupos
      .filter((g) => g.tipoMaterial === tipo)
      .reduce((acc, g) => acc + Number(g.pesoCalculado ?? 0), 0),
  );
}

export function resumoPeso(movimentacao: MovimentacaoComGrupos): ResumoPeso {
  const temSucata = movimentacao.grupos.some((g) => g.tipoMaterial === 'SUCATA');
  const pesoNovo = somaPeso(movimentacao, 'NOVO');
  const pesoReemprego = somaPeso(movimentacao, 'REEMPREGO');
  const pesoNovoReemprego = arredondar3(pesoNovo + pesoReemprego);
  const pesoSucataEstimado = somaPeso(movimentacao, 'SUCATA');
  const pesoSucataReal = movimentacao.pesoSucataReal != null ? Number(movimentacao.pesoSucataReal) : null;
  const pendente = temSucata && pesoSucataReal == null;
  const pesoTotal = pendente ? null : arredondar3(pesoNovoReemprego + (pesoSucataReal ?? 0));
  return { temSucata, pesoNovo, pesoReemprego, pesoNovoReemprego, pesoSucataEstimado, pesoSucataReal, pendente, pesoTotal };
}
