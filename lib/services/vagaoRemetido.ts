import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { calcularPesoEstimado } from '@/lib/services/calculo';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { registrarHistorico } from '@/lib/services/historico';
import { MARCA_LABEL } from '@/lib/validation/recebimento';
import type { LinhaTlsInput, RemetidoVagaoInput } from '@/lib/validation/vagaoRemetido';
import { METROS_TLS } from '@/lib/estoque/trilhos';

/**
 * Vagões: os remetidos de vagão (B.O. do trilheiro) que o Administrativo lança, e os
 * recebimentos de vagão que o Pátio lança. O remetido de vagão é uma movimentação
 * REMETIDO comum (sai nos relatórios e no Excel como as outras), já conferida, com um
 * grupo de TLS por linha do B.O. e a lista de vagões.
 */

const incluirDetalhe = {
  grupos: { include: { medicoes: true } },
  remetidoDetalhe: true,
  vagoes: { orderBy: { ordem: 'asc' } },
  historico: { orderBy: { timestamp: 'desc' } },
} as const satisfies Prisma.MovimentacaoInclude;

export type RemetidoVagaoDetalhe = Prisma.MovimentacaoGetPayload<{ include: typeof incluirDetalhe }>;

function fabricanteDaLinha(l: LinhaTlsInput): string | null {
  if (l.material !== 'NOVO' || !l.marca) return null;
  return l.marca === 'OUTROS' ? l.fabricanteOutro?.trim() || null : MARCA_LABEL[l.marca];
}

/** Lança o B.O. do trilheiro como remetido de vagão, já conferido pelo Administrativo. */
export async function criarRemetidoVagao(input: RemetidoVagaoInput, ator: { userId: string; nome: string }): Promise<string> {
  const [principal, ...extras] = input.nfs;
  const pesos = await Promise.all(input.linhas.map((l) => calcularPesoEstimado(l.quantidade * METROS_TLS, l.perfil)));

  const id = await prisma.$transaction(
    async (tx) => {
      const mov = await tx.movimentacao.create({
        data: {
          clientId: randomUUID(),
          tipo: 'REMETIDO',
          tipoDocumento: 'NF',
          numeroDocumento: principal ?? null,
          numerosDocumentoExtras: extras,
          tipoTransporte: 'VAGAO',
          trilheiro: input.trilheiro,
          destino: input.destino,
          dataMovimentacao: new Date(`${input.data}T00:00:00`),
          responsavelPatio: ator.nome,
          observacao: input.observacao || null,
          valorNf: input.valorNf,
          movimentaEstoque: input.movimentaEstoque,
          status: 'CONFERIDO',
          conferidoPorId: ator.userId,
          conferidoEm: new Date(),
          remetidoDetalhe: { create: { tipoRemetido: input.tipoRemetido } },
        },
        select: { id: true },
      });

      for (const [i, l] of input.linhas.entries()) {
        const metros = l.quantidade * METROS_TLS;
        await tx.grupo.create({
          data: {
            clientId: randomUUID(),
            movimentacaoId: mov.id,
            perfil: l.perfil,
            tipoMaterial: l.material,
            classificacao: null,
            fabricante: fabricanteDaLinha(l),
            tls: true,
            metrosTotal: metros,
            pesoCalculado: pesos[i],
            medicoes: {
              create: { clientId: randomUUID(), modo: 'QTD_COMPRIMENTO', quantidade: l.quantidade, comprimento: METROS_TLS, metros },
            },
          },
        });
      }

      if (input.vagoes.length > 0) {
        await tx.vagaoRemetido.createMany({
          data: input.vagoes.map((v, ordem) => ({
            movimentacaoId: mov.id,
            ordem,
            serie: v.serie,
            numero: v.numero,
            pesoLiquido: v.pesoLiquido,
            pesoBruto: v.pesoBruto,
          })),
        });
      }
      return mov.id;
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  await registrarHistorico({ movimentacaoId: id, usuarioId: ator.userId, usuarioNome: ator.nome, acao: 'REMETIDO_VAGAO_LANCADO' });
  return id;
}

export async function buscarRemetidoVagao(id: string): Promise<RemetidoVagaoDetalhe | null> {
  const mov = await prisma.movimentacao.findUnique({ where: { id }, include: incluirDetalhe });
  if (!mov || mov.tipo !== 'REMETIDO' || mov.tipoTransporte !== 'VAGAO') return null;
  return mov;
}

/** Liga ou desliga a saída do estoque de um remetido de vagão (fica no histórico). */
export async function definirMovimentaEstoque(id: string, movimenta: boolean, ator: { userId: string; nome: string }): Promise<void> {
  const mov = await prisma.movimentacao.findUnique({ where: { id }, select: { tipo: true, tipoTransporte: true, movimentaEstoque: true } });
  if (!mov || mov.tipo !== 'REMETIDO' || mov.tipoTransporte !== 'VAGAO') throw new ErroRegraNegocio('Remetido de vagão não encontrado.');
  if (mov.movimentaEstoque === movimenta) return;
  await prisma.movimentacao.update({ where: { id }, data: { movimentaEstoque: movimenta } });
  await registrarHistorico({
    movimentacaoId: id,
    usuarioId: ator.userId,
    usuarioNome: ator.nome,
    acao: 'ESTOQUE_ALTERADO',
    campo: 'movimentaEstoque',
    valorAntigo: mov.movimentaEstoque ? 'Movimenta o estoque' : 'Não movimenta o estoque',
    valorNovo: movimenta ? 'Movimenta o estoque' : 'Não movimenta o estoque',
  });
}

const incluirLista = { grupos: { include: { medicoes: true } }, vagoes: { orderBy: { ordem: 'asc' } } } as const satisfies Prisma.MovimentacaoInclude;
export type ItemListaVagao = Prisma.MovimentacaoGetPayload<{ include: typeof incluirLista }>;

/** Remetidos ou recebimentos de vagão, do mais recente para o mais antigo. */
export function listarVagoes(tipo: 'REMETIDO' | 'RECEBIMENTO', limite = 200): Promise<ItemListaVagao[]> {
  return prisma.movimentacao.findMany({
    where: { tipo, tipoTransporte: 'VAGAO' },
    include: incluirLista,
    orderBy: [{ dataMovimentacao: 'desc' }, { createdAt: 'desc' }],
    take: limite,
  });
}
