/**
 * Portaria: a partir das viagens anteriores de um CPF (cargas e descargas), monta o que a tela mostra
 * para a Portaria escolher: os dados do motorista (o mais recente de cada campo) e os caminhões que ele
 * já usou, um por combinação de placas, do mais recente para o mais antigo.
 */

export interface ViagemMotorista {
  quando: Date;
  nome: string | null;
  telefone: string | null;
  transportadora: string | null;
  placaCavalo: string | null;
  placaCarreta: string | null;
  placaCarreta2: string | null;
  capacidadeCarga: number | null;
  comprimentoCarreta: number | null;
}

export interface VeiculoMotorista {
  placaCavalo: string | null;
  placaCarreta: string | null;
  placaCarreta2: string | null;
  capacidadeCarga: number | null;
  comprimentoCarreta: number | null;
  transportadora: string | null;
  /** Última viagem com este caminhão (ISO). */
  ultimaVez: string;
  viagens: number;
}

export interface MotoristaEncontrado {
  nome: string | null;
  telefone: string | null;
  transportadora: string | null;
  viagens: number;
  veiculos: VeiculoMotorista[];
}

/** Quantos caminhões diferentes a tela mostra, no máximo. */
export const MAX_VEICULOS = 5;

const limpo = (v: string | null | undefined) => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

export function resumirMotorista(viagens: ViagemMotorista[]): MotoristaEncontrado | null {
  if (viagens.length === 0) return null;
  const ordenadas = [...viagens].sort((a, b) => b.quando.getTime() - a.quando.getTime());
  const primeiro = (f: (v: ViagemMotorista) => string | null) => ordenadas.map((v) => limpo(f(v))).find((x) => x != null) ?? null;

  const veiculos = new Map<string, VeiculoMotorista>();
  for (const v of ordenadas) {
    const cavalo = limpo(v.placaCavalo);
    const carreta = limpo(v.placaCarreta);
    const carreta2 = limpo(v.placaCarreta2);
    if (!cavalo && !carreta && !carreta2) continue;
    const chave = [cavalo, carreta, carreta2].join('|');
    const ja = veiculos.get(chave);
    if (ja) {
      ja.viagens += 1;
      // Viagem mais antiga só completa o que a mais recente deixou em branco.
      ja.capacidadeCarga ??= v.capacidadeCarga;
      ja.comprimentoCarreta ??= v.comprimentoCarreta;
      ja.transportadora ??= limpo(v.transportadora);
      continue;
    }
    veiculos.set(chave, {
      placaCavalo: cavalo,
      placaCarreta: carreta,
      placaCarreta2: carreta2,
      capacidadeCarga: v.capacidadeCarga,
      comprimentoCarreta: v.comprimentoCarreta,
      transportadora: limpo(v.transportadora),
      ultimaVez: v.quando.toISOString(),
      viagens: 1,
    });
  }

  return {
    nome: primeiro((v) => v.nome),
    telefone: primeiro((v) => v.telefone),
    transportadora: primeiro((v) => v.transportadora),
    viagens: ordenadas.length,
    veiculos: [...veiculos.values()].slice(0, MAX_VEICULOS),
  };
}
