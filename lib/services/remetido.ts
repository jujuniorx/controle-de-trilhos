import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { calcularMetros, calcularPesoEstimado } from '@/lib/services/calculo';
import { registrarHistorico } from '@/lib/services/historico';
import { arredondar3 } from '@/lib/domain/regras';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { MARCA_LABEL } from '@/lib/validation/recebimento';
import type {
  PreCadastroRemetidoInput,
  ConfirmacaoRemetidoInput,
  LancamentoDiretoRemetidoInput,
  GrupoRemetidoInput,
} from '@/lib/validation/remetido';
import type { UsuarioAdmin } from '@/lib/services/conferencia';

export type MovimentacaoRemetidoComGrupos = Prisma.MovimentacaoGetPayload<{
  include: { grupos: { include: { medicoes: true } }; remetidoDetalhe: true; historico: true };
}>;

export async function criarPreCadastroRemetido(
  clientId: string,
  input: PreCadastroRemetidoInput,
): Promise<MovimentacaoRemetidoComGrupos> {
  const movimentacao = await prisma.movimentacao.create({
    data: {
      clientId,
      tipo: 'REMETIDO',
      tipoDocumento: 'NF',
      numeroDocumento: input.numeroDocumento ?? null,
      tipoTransporte: 'CAMINHAO',
      destino: input.destino,
      reservaPedido: input.reservaPedido,
      status: 'AGUARDANDO_CHEGADA',
      remetidoDetalhe: { create: { tipoRemetido: input.tipoRemetido } },
    },
    include: { grupos: { include: { medicoes: true } }, remetidoDetalhe: true, historico: { orderBy: { timestamp: 'desc' } } },
  });

  await registrarHistorico({
    movimentacaoId: movimentacao.id,
    usuarioNome: 'Administrativo',
    acao: 'PRE_CADASTRO',
  });

  return movimentacao;
}

/** Deriva o texto gravado em Grupo.fabricante a partir da marca fechada (ou do texto livre quando "OUTROS"). */
function resolverFabricante(grupo: Extract<GrupoRemetidoInput, { tipoMaterial: 'NOVO' }>): string | null {
  if (!grupo.marca) return null;
  return grupo.marca === 'OUTROS' ? grupo.fabricanteOutro ?? null : MARCA_LABEL[grupo.marca];
}

/** Compartilhado entre confirmarRemetido e criarRemetidoDireto — o grupo nasce do mesmo jeito nos dois fluxos. */
async function criarGruposEMedicoes(
  tx: Prisma.TransactionClient,
  movimentacaoId: string,
  grupos: GrupoRemetidoInput[],
): Promise<void> {
  for (const grupo of grupos) {
    const metrosPorMedicao = grupo.medicoes.map((m) => calcularMetros(m.quantidade, m.comprimento));
    const metrosTotal = metrosPorMedicao.reduce((a, b) => a + b, 0);
    // Sem peso da NF informado pelo Pátio: estimativa provisória, mesma fórmula
    // do Reemprego (metros x fator do perfil) — sinalizada "a confirmar" na
    // Conferência enquanto pesoInformado continuar nulo.
    const pesoCalculado = grupo.pesoInformado == null ? await calcularPesoEstimado(metrosTotal, grupo.perfil) : null;

    const grupoCriado = await tx.grupo.create({
      data: {
        clientId: grupo.clientId,
        movimentacaoId,
        perfil: grupo.perfil,
        tipoMaterial: grupo.tipoMaterial,
        classificacao: grupo.tipoMaterial === 'REEMPREGO' ? grupo.classificacao : null,
        tampao: grupo.tipoMaterial === 'REEMPREGO' ? Boolean(grupo.tampao) : false,
        fabricante: grupo.tipoMaterial === 'NOVO' ? resolverFabricante(grupo) : null,
        metrosTotal,
        pesoCalculado,
        pesoInformado: grupo.pesoInformado ?? null,
      },
    });

    for (const [i, medicao] of grupo.medicoes.entries()) {
      await tx.medicao.create({
        data: {
          clientId: medicao.clientId,
          grupoId: grupoCriado.id,
          modo: medicao.modo,
          quantidade: medicao.quantidade,
          comprimento: medicao.comprimento,
          metros: metrosPorMedicao[i],
          classificacaoSC: grupo.tipoMaterial === 'SUCATA' ? medicao.classificacaoSC : null,
        },
      });
    }
  }
}

export async function confirmarRemetido(
  movimentacaoId: string,
  input: ConfirmacaoRemetidoInput,
): Promise<MovimentacaoRemetidoComGrupos> {
  const existente = await prisma.movimentacao.findUnique({ where: { id: movimentacaoId } });
  if (!existente || existente.tipo !== 'REMETIDO') throw new ErroRegraNegocio('Remetido não encontrado.');
  if (existente.status !== 'AGUARDANDO_CHEGADA') {
    throw new ErroRegraNegocio('Este remetido não está mais aguardando chegada.');
  }

  const movimentacao = await prisma.$transaction(async (tx) => {
    const mov = await tx.movimentacao.update({
      where: { id: movimentacaoId },
      data: {
        status: 'PENDENTE_CONFERENCIA',
        numeroDocumento: input.dados.numeroDocumento ?? existente.numeroDocumento,
        dataMovimentacao: new Date(`${input.dados.data}T00:00:00`),
        placaCavalo: input.dados.placaCavalo ?? null,
        placaCarreta: input.dados.placaCarreta ?? null,
        placaCarreta2: input.dados.placaCarreta2 ?? null,
        transportadora: input.dados.transportadora ?? null,
        responsavelPatio: input.dados.responsavelPatio,
      },
    });

    await criarGruposEMedicoes(tx, mov.id, input.grupos);

    return tx.movimentacao.findUniqueOrThrow({
      where: { id: mov.id },
      include: { grupos: { include: { medicoes: true } }, remetidoDetalhe: true, historico: { orderBy: { timestamp: 'desc' } } },
    });
  });

  await registrarHistorico({
    movimentacaoId: movimentacao.id,
    usuarioNome: `${input.dados.responsavelPatio} (pátio)`,
    acao: 'CONFIRMACAO_CHEGADA',
  });

  // TODO(Estoque): a baixa de estoque do material remetido não existe ainda —
  // não há módulo de Estoque no sistema. Quando existir, este é o ponto onde a
  // baixa deveria ocorrer (ou no momento da CONFERIDO pelo Administrativo).
  // TODO(Offline): esta confirmação é só online (sem fila local/Dexie), por
  // decisão explícita para não arriscar o motor de sincronização do Recebimento
  // perto do prazo. Se o Pátio operar sem conexão no momento da confirmação,
  // avaliar estender o /api/sync para este payload numa rodada futura.

  return movimentacao;
}

/**
 * Lançamento direto pelo Pátio, sem pré-cadastro do Administrativo (V1.2: o
 * pré-cadastro É POSSÍVEL, não é a única via). Cria a Movimentacao já em
 * PENDENTE_CONFERENCIA — pula AGUARDANDO_CHEGADA porque não há "chegada futura"
 * para aguardar, o caminhão já está no pátio preenchendo isso agora.
 */
export async function criarRemetidoDireto(
  clientId: string,
  input: LancamentoDiretoRemetidoInput,
): Promise<MovimentacaoRemetidoComGrupos> {
  const movimentacao = await prisma.$transaction(async (tx) => {
    const mov = await tx.movimentacao.create({
      data: {
        clientId,
        tipo: 'REMETIDO',
        tipoDocumento: 'NF',
        numeroDocumento: input.dados.numeroDocumento ?? null,
        tipoTransporte: 'CAMINHAO',
        destino: input.destino,
        reservaPedido: input.reservaPedido ?? null,
        status: 'PENDENTE_CONFERENCIA',
        dataMovimentacao: new Date(`${input.dados.data}T00:00:00`),
        placaCavalo: input.dados.placaCavalo ?? null,
        placaCarreta: input.dados.placaCarreta ?? null,
        placaCarreta2: input.dados.placaCarreta2 ?? null,
        transportadora: input.dados.transportadora ?? null,
        responsavelPatio: input.dados.responsavelPatio,
        remetidoDetalhe: { create: { tipoRemetido: input.tipoRemetido ?? null } },
      },
    });

    await criarGruposEMedicoes(tx, mov.id, input.grupos);

    return tx.movimentacao.findUniqueOrThrow({
      where: { id: mov.id },
      include: { grupos: { include: { medicoes: true } }, remetidoDetalhe: true, historico: { orderBy: { timestamp: 'desc' } } },
    });
  });

  await registrarHistorico({
    movimentacaoId: movimentacao.id,
    usuarioNome: `${input.dados.responsavelPatio} (pátio)`,
    acao: 'LANCAMENTO_DIRETO',
  });

  // Mesmas pendências do fluxo de confirmação (TODO Estoque / TODO Offline logo acima).

  return movimentacao;
}

/**
 * Completa a NF que o Pátio deixou em aberto na confirmação. Se o remetido já
 * estava CONFERIDO, corrigir a NF reabre para PENDENTE_CONFERENCIA — mesma
 * regra já usada para corrigir pesoSucataReal: dado conferido que muda sempre
 * reabre a conferência.
 */
export async function informarNumeroDocumentoRemetido(
  movimentacaoId: string,
  numeroDocumento: string,
  usuario: UsuarioAdmin,
): Promise<void> {
  const mov = await prisma.movimentacao.findUnique({ where: { id: movimentacaoId } });
  if (!mov || mov.tipo !== 'REMETIDO') throw new ErroRegraNegocio('Remetido não encontrado.');

  const valorAnterior = mov.numeroDocumento;
  const reabrindo = mov.status === 'CONFERIDO';

  await prisma.$transaction(async (tx) => {
    await tx.movimentacao.update({
      where: { id: movimentacaoId },
      data: {
        numeroDocumento,
        ...(reabrindo ? { status: 'PENDENTE_CONFERENCIA', conferidoPorId: null, conferidoEm: null } : {}),
      },
    });

    await tx.historicoAlteracao.create({
      data: {
        movimentacaoId,
        usuarioId: usuario.userId,
        usuarioNome: usuario.nome,
        acao: 'NF_INFORMADA',
        campo: 'numeroDocumento',
        valorAntigo: valorAnterior,
        valorNovo: numeroDocumento,
      },
    });

    if (reabrindo) {
      await tx.historicoAlteracao.create({
        data: {
          movimentacaoId,
          usuarioId: usuario.userId,
          usuarioNome: usuario.nome,
          acao: 'REABERTURA',
          campo: 'status',
          valorAntigo: 'CONFERIDO',
          valorNovo: 'PENDENTE_CONFERENCIA',
        },
      });
    }
  });
}

/** Soma o pesoInformado de cada grupo; sem peso informado, cai na estimativa (pesoCalculado) — "a confirmar". Normaliza se valores estiverem em gramas. */
export function resumoPesoRemetido(movimentacao: MovimentacaoRemetidoComGrupos): number {
  return arredondar3(
    movimentacao.grupos.reduce((acc, g) => {
      let peso = Number(g.pesoInformado ?? g.pesoCalculado ?? 0);
      // Normaliza peso se estiver em gramas (> 1000 toneladas é absurdo)
      peso = peso > 1000 ? peso / 1000 : peso;
      return acc + peso;
    }, 0),
  );
}

/**
 * Completa/corrige o peso da NF de um grupo específico do Remetido, quando o
 * Pátio lançou sem saber o peso (campo opcional — ver Tasks 5-6). Mesma regra de
 * reabertura usada para NF e peso de sucata do Recebimento: corrigir um dado
 * depois de CONFERIDO sempre reabre a conferência.
 */
export async function informarPesoGrupoRemetido(
  grupoId: string,
  peso: number,
  usuario: UsuarioAdmin,
): Promise<void> {
  const grupo = await prisma.grupo.findUnique({
    where: { id: grupoId },
    include: { movimentacao: true },
  });
  if (!grupo || grupo.movimentacao.tipo !== 'REMETIDO') {
    throw new ErroRegraNegocio('Grupo de remetido não encontrado.');
  }

  const valorAnterior = grupo.pesoInformado != null ? Number(grupo.pesoInformado) : null;
  const reabrindo = grupo.movimentacao.status === 'CONFERIDO';

  await prisma.$transaction(async (tx) => {
    await tx.grupo.update({ where: { id: grupoId }, data: { pesoInformado: peso } });

    if (reabrindo) {
      await tx.movimentacao.update({
        where: { id: grupo.movimentacaoId },
        data: { status: 'PENDENTE_CONFERENCIA', conferidoPorId: null, conferidoEm: null },
      });
    }

    await tx.historicoAlteracao.create({
      data: {
        movimentacaoId: grupo.movimentacaoId,
        usuarioId: usuario.userId,
        usuarioNome: usuario.nome,
        acao: 'PESO_NF_INFORMADO',
        campo: 'pesoInformado',
        valorAntigo: valorAnterior != null ? String(valorAnterior) : null,
        valorNovo: String(peso),
      },
    });

    if (reabrindo) {
      await tx.historicoAlteracao.create({
        data: {
          movimentacaoId: grupo.movimentacaoId,
          usuarioId: usuario.userId,
          usuarioNome: usuario.nome,
          acao: 'REABERTURA',
          campo: 'status',
          valorAntigo: 'CONFERIDO',
          valorNovo: 'PENDENTE_CONFERENCIA',
        },
      });
    }
  });
}

/**
 * Completa o Tipo de remetido que o Pátio deixou em aberto no lançamento
 * direto (Bloco 2.2 — campo opcional porque o Pátio não tem essa informação).
 * Mesma regra de reabertura das outras correções pós-conferência.
 */
export async function informarTipoRemetido(
  movimentacaoId: string,
  tipoRemetido: 'VENDA' | 'TRANS' | 'INDUS',
  usuario: UsuarioAdmin,
): Promise<void> {
  const mov = await prisma.movimentacao.findUnique({
    where: { id: movimentacaoId },
    include: { remetidoDetalhe: true },
  });
  if (!mov || mov.tipo !== 'REMETIDO') throw new ErroRegraNegocio('Remetido não encontrado.');

  const valorAnterior = mov.remetidoDetalhe?.tipoRemetido ?? null;
  const reabrindo = mov.status === 'CONFERIDO';

  await prisma.$transaction(async (tx) => {
    await tx.remetidoDetalhe.upsert({
      where: { movimentacaoId },
      create: { movimentacaoId, tipoRemetido },
      update: { tipoRemetido },
    });

    if (reabrindo) {
      await tx.movimentacao.update({
        where: { id: movimentacaoId },
        data: { status: 'PENDENTE_CONFERENCIA', conferidoPorId: null, conferidoEm: null },
      });
    }

    await tx.historicoAlteracao.create({
      data: {
        movimentacaoId,
        usuarioId: usuario.userId,
        usuarioNome: usuario.nome,
        acao: 'TIPO_REMETIDO_INFORMADO',
        campo: 'tipoRemetido',
        valorAntigo: valorAnterior,
        valorNovo: tipoRemetido,
      },
    });

    if (reabrindo) {
      await tx.historicoAlteracao.create({
        data: {
          movimentacaoId,
          usuarioId: usuario.userId,
          usuarioNome: usuario.nome,
          acao: 'REABERTURA',
          campo: 'status',
          valorAntigo: 'CONFERIDO',
          valorNovo: 'PENDENTE_CONFERENCIA',
        },
      });
    }
  });
}

/**
 * Edição administrativa geral de um Remetido já confirmado pelo Pátio (Task
 * 17): Tipo, Reserva/Pedido, Destino, dados da chegada e grupos/medições,
 * tudo de uma vez. Reusa o mesmo formato de entrada do lançamento direto
 * (`LancamentoDiretoRemetidoInput`) e a mesma `criarGruposEMedicoes` usada em
 * `confirmarRemetido`/`criarRemetidoDireto` — nenhuma lógica nova de cálculo
 * de peso/metros, nenhum segundo caminho de validação.
 *
 * Só se aplica a partir de PENDENTE_CONFERENCIA — um pré-cadastro ainda
 * AGUARDANDO_CHEGADA não tem grupos para editar (o Pátio precisa confirmar
 * primeiro; a UI já tem seus próprios painéis para completar Tipo/NF nesse
 * estado — `TipoRemetidoPainel`/`NfPainel`).
 *
 * Mesma regra de reabertura já usada em `informarNumeroDocumentoRemetido`/
 * `informarPesoGrupoRemetido`/`informarTipoRemetido`: se o Remetido já
 * estava CONFERIDO, qualquer edição reabre para PENDENTE_CONFERENCIA — sem
 * isso, "conferido" deixaria de corresponder aos dados reais depois de uma
 * correção. Não inventa uma regra nova: segue o padrão já estabelecido no
 * restante deste arquivo em vez de só reabrir quando peso/medições mudam.
 */
export async function atualizarRemetido(
  movimentacaoId: string,
  input: LancamentoDiretoRemetidoInput,
  usuario: UsuarioAdmin,
): Promise<MovimentacaoRemetidoComGrupos> {
  const existente = await prisma.movimentacao.findUnique({ where: { id: movimentacaoId } });
  if (!existente || existente.tipo !== 'REMETIDO') throw new ErroRegraNegocio('Remetido não encontrado.');
  if (existente.status === 'AGUARDANDO_CHEGADA') {
    throw new ErroRegraNegocio('Este remetido ainda não foi confirmado pelo Pátio — não há grupos para editar.');
  }

  const reabrindo = existente.status === 'CONFERIDO';

  const movimentacao = await prisma.$transaction(async (tx) => {
    // Grupos/medições são recriados do zero a cada edição (mesmo padrão dos
    // dois fluxos de criação) — mais simples e seguro do que tentar diferenciar
    // e atualizar grupo a grupo, e evita qualquer resíduo de medição removida.
    await tx.medicao.deleteMany({ where: { grupo: { movimentacaoId } } });
    await tx.grupo.deleteMany({ where: { movimentacaoId } });

    await tx.movimentacao.update({
      where: { id: movimentacaoId },
      data: {
        reservaPedido: input.reservaPedido ?? null,
        destino: input.destino,
        numeroDocumento: input.dados.numeroDocumento ?? existente.numeroDocumento,
        dataMovimentacao: new Date(`${input.dados.data}T00:00:00`),
        placaCavalo: input.dados.placaCavalo ?? null,
        placaCarreta: input.dados.placaCarreta ?? null,
        placaCarreta2: input.dados.placaCarreta2 ?? null,
        transportadora: input.dados.transportadora ?? null,
        responsavelPatio: input.dados.responsavelPatio,
        ...(reabrindo ? { status: 'PENDENTE_CONFERENCIA' as const, conferidoPorId: null, conferidoEm: null } : {}),
      },
    });

    await tx.remetidoDetalhe.upsert({
      where: { movimentacaoId },
      create: { movimentacaoId, tipoRemetido: input.tipoRemetido ?? null },
      update: { tipoRemetido: input.tipoRemetido ?? null },
    });

    await criarGruposEMedicoes(tx, movimentacaoId, input.grupos);

    return tx.movimentacao.findUniqueOrThrow({
      where: { id: movimentacaoId },
      include: { grupos: { include: { medicoes: true } }, remetidoDetalhe: true, historico: { orderBy: { timestamp: 'desc' } } },
    });
  });

  await registrarHistorico({
    movimentacaoId,
    usuarioId: usuario.userId,
    usuarioNome: usuario.nome,
    acao: 'EDICAO',
  });

  if (reabrindo) {
    await registrarHistorico({
      movimentacaoId,
      usuarioId: usuario.userId,
      usuarioNome: usuario.nome,
      acao: 'REABERTURA',
      campo: 'status',
      valorAntigo: 'CONFERIDO',
      valorNovo: 'PENDENTE_CONFERENCIA',
    });
  }

  return movimentacao;
}

export function buscarRemetidoDetalhe(id: string): Promise<MovimentacaoRemetidoComGrupos | null> {
  return prisma.movimentacao.findUnique({
    where: { id, tipo: 'REMETIDO' },
    include: { grupos: { include: { medicoes: true } }, remetidoDetalhe: true, historico: { orderBy: { timestamp: 'desc' } } },
  });
}

export function listarAguardandoChegada() {
  return prisma.movimentacao.findMany({
    where: { tipo: 'REMETIDO', status: 'AGUARDANDO_CHEGADA' },
    include: { remetidoDetalhe: true },
    orderBy: { id: 'desc' },
  });
}
