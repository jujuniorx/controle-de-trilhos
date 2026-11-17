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
  motoristaNome?: string | null;
  motoristaCpf?: string | null;
  motoristaTelefone?: string | null;
  transportadora?: string | null;
  placaCavalo?: string | null;
  placaCarreta?: string | null;
  placaCarreta2?: string | null;
  capacidadeCarga?: number | null;
  comprimentoCarreta?: number | null;
}

/**
 * Guarda o envio no cadastro do motorista. Motorista novo entra com os dados do envio.
 * Motorista que já existe: CPF, telefone e empresa passam a ser os do último envio salvo
 * (campo vazio não apaga o que já estava), e o veículo entra no histórico com a data do uso.
 */
export async function guardarNoCadastroDoMotorista(dados: DadosDoEnvioParaCadastro): Promise<void> {
  const nome = dados.motoristaNome?.trim();
  if (!nome) return;
  const pessoais = { cpf: dados.motoristaCpf || undefined, telefone: dados.motoristaTelefone || undefined, transportadora: dados.transportadora || undefined };
  const motorista = await prisma.motoristaCadastro.upsert({
    where: { nome },
    create: { nome, cpf: pessoais.cpf ?? null, telefone: pessoais.telefone ?? null, transportadora: pessoais.transportadora ?? null },
    update: pessoais,
  });

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
