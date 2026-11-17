import { prisma } from '@/lib/db';

export interface VeiculoCadastrado {
  id: string;
  placaCavalo: string | null;
  placaCarreta: string | null;
  placaCarreta2: string | null;
  capacidadeCarga: number | null;
  comprimentoCarreta: number | null;
}

export interface MotoristaCadastrado {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  transportadora: string | null;
  veiculos: VeiculoCadastrado[];
}

/** Todos os motoristas, com os veículos que já usaram (mais recente primeiro). */
export async function listarMotoristas(): Promise<MotoristaCadastrado[]> {
  const linhas = await prisma.motoristaCadastro.findMany({
    orderBy: { nome: 'asc' },
    include: { veiculos: { orderBy: { ultimoUsoEm: 'desc' } } },
  });
  return linhas.map((m) => ({
    id: m.id,
    nome: m.nome,
    cpf: m.cpf,
    telefone: m.telefone,
    transportadora: m.transportadora,
    veiculos: m.veiculos.map((v) => ({
      id: v.id,
      placaCavalo: v.placaCavalo,
      placaCarreta: v.placaCarreta,
      placaCarreta2: v.placaCarreta2,
      capacidadeCarga: v.capacidadeCarga === null ? null : Number(v.capacidadeCarga),
      comprimentoCarreta: v.comprimentoCarreta === null ? null : Number(v.comprimentoCarreta),
    })),
  }));
}

export interface DadosDoEnvioParaCadastro {
  motoristaNome: string | null;
  motoristaCpf: string | null;
  motoristaTelefone: string | null;
  transportadora: string | null;
  placaCavalo: string | null;
  placaCarreta: string | null;
  placaCarreta2: string | null;
  capacidadeCarga: number | null;
  comprimentoCarreta: number | null;
}

/**
 * Guarda o envio no cadastro do motorista. Motorista novo entra com os dados do envio.
 * Motorista que já existe: o veículo entra no histórico, e CPF, telefone e empresa só mudam
 * se a Portaria tiver marcado "atualizar o cadastro".
 */
export async function guardarNoCadastroDoMotorista(dados: DadosDoEnvioParaCadastro, atualizarCadastro: boolean): Promise<void> {
  const nome = dados.motoristaNome?.trim();
  if (!nome) return;
  const existente = await prisma.motoristaCadastro.findUnique({ where: { nome } });
  const dadosPessoais = { cpf: dados.motoristaCpf || null, telefone: dados.motoristaTelefone || null, transportadora: dados.transportadora || null };
  const motorista = existente
    ? atualizarCadastro
      ? await prisma.motoristaCadastro.update({ where: { id: existente.id }, data: dadosPessoais })
      : existente
    : await prisma.motoristaCadastro.create({ data: { nome, ...dadosPessoais } });

  const placas = { placaCavalo: dados.placaCavalo || null, placaCarreta: dados.placaCarreta || null, placaCarreta2: dados.placaCarreta2 || null };
  if (!placas.placaCavalo && !placas.placaCarreta && !placas.placaCarreta2) return;
  const veiculo = await prisma.veiculoMotorista.findFirst({ where: { motoristaId: motorista.id, ...placas } });
  const medidas = { capacidadeCarga: dados.capacidadeCarga, comprimentoCarreta: dados.comprimentoCarreta, ultimoUsoEm: new Date() };
  if (veiculo) {
    await prisma.veiculoMotorista.update({ where: { id: veiculo.id }, data: medidas });
  } else {
    await prisma.veiculoMotorista.create({ data: { motoristaId: motorista.id, ...placas, ...medidas } });
  }
}
