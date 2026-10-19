/** Regras puras da Portaria (sem banco) — testáveis e usadas pelo serviço e pelas telas. */

export type EstadoPortaria = 'AGUARDANDO_CARRETA' | 'CHEGOU' | 'LIBERADA' | 'SAIU';

export interface MovimentacaoPortariaBasica {
  status: string;
  chegadaPortariaEm: Date | null;
  carretaLiberadaEm: Date | null;
  saidaPortariaEm: Date | null;
}

/**
 * Remetido: a carreta ainda não chegou → a Portaria registrou a chegada → o Pátio liberou →
 * a Portaria confirmou a saída. (Remetidos antigos, liberados pelo fluxo anterior, contam como liberados.)
 */
export function estadoPortaria(m: MovimentacaoPortariaBasica): EstadoPortaria {
  if (m.saidaPortariaEm) return 'SAIU';
  if (m.carretaLiberadaEm) return 'LIBERADA';
  if (m.chegadaPortariaEm) return 'CHEGOU';
  return 'AGUARDANDO_CARRETA';
}

export const ROTULO_ESTADO: Record<EstadoPortaria, string> = {
  AGUARDANDO_CARRETA: 'Aguardando a carreta',
  CHEGOU: 'Chegou — aguardando o Pátio',
  LIBERADA: 'Liberada pelo Pátio — pode sair',
  SAIU: 'Saiu',
};

/** Portaria: por que NÃO dá para registrar a chegada da carreta (null = pode). */
export function motivoNaoPodeRegistrarChegada(
  m: MovimentacaoPortariaBasica,
  placaCavalo: string | null | undefined,
  placaCarreta: string | null | undefined,
  placaCarreta2?: string | null,
): string | null {
  if (m.saidaPortariaEm) return 'Esta carreta já saiu.';
  if (m.chegadaPortariaEm || m.carretaLiberadaEm) return 'A chegada desta carreta já foi registrada.';
  if (!placaCavalo && !placaCarreta && !placaCarreta2) return 'Informe ao menos uma placa (cavalo ou carreta) para registrar a chegada.';
  return null;
}

/** Pátio: por que NÃO dá para liberar a carreta (null = pode). */
export function motivoNaoPodeLiberar(m: MovimentacaoPortariaBasica): string | null {
  if (m.saidaPortariaEm) return 'Esta carreta já saiu.';
  if (m.carretaLiberadaEm) return 'A carreta já foi liberada.';
  if (!m.chegadaPortariaEm) return 'A carreta ainda não chegou na Portaria.';
  return null;
}

/** Portaria: por que NÃO dá para confirmar a saída (null = pode). */
export function motivoNaoPodeConfirmarSaida(m: MovimentacaoPortariaBasica): string | null {
  if (m.saidaPortariaEm) return 'A saída desta carreta já foi confirmada.';
  if (!m.carretaLiberadaEm) return 'O Pátio ainda não liberou esta carreta.';
  return null;
}

export function formatarCpf(digitos: string | null | undefined): string {
  const d = (digitos ?? '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;
}

export function formatarTelefone(digitos: string | null | undefined): string {
  const d = (digitos ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

// ── Recebimento: chegada do caminhão ─────────────────────────────────────────

export type EstadoChegada = 'AGUARDANDO_LIBERACAO' | 'LIBERADA' | 'RECEBIDA' | 'SAIU' | 'CANCELADA';

export interface ChegadaBasica {
  liberadaEm: Date | null;
  canceladaEm: Date | null;
  movimentacaoId: string | null;
  descarregadaEm?: Date | null;
  saidaEm: Date | null;
  cargaDescarga?: boolean;
  cargaCarregadaEm?: Date | null;
}

/**
 * Recebimento: rascunho na Portaria (AGUARDANDO_LIBERACAO) → chegada registrada, o Pátio vê (LIBERADA)
 * → o Pátio descarregou (RECEBIDA) → a Portaria confirmou a saída (SAIU). As chaves antigas foram mantidas;
 * só os rótulos mudaram.
 */
export function estadoChegada(c: ChegadaBasica): EstadoChegada {
  if (c.canceladaEm) return 'CANCELADA';
  if (c.saidaEm) return 'SAIU';
  if (c.movimentacaoId || c.descarregadaEm) return 'RECEBIDA';
  if (c.liberadaEm) return 'LIBERADA';
  return 'AGUARDANDO_LIBERACAO';
}

export const ROTULO_ESTADO_CHEGADA: Record<EstadoChegada, string> = {
  AGUARDANDO_LIBERACAO: 'Preencher e registrar a chegada',
  LIBERADA: 'Chegou — aguardando o Pátio',
  RECEBIDA: 'Descarregado — pode sair',
  SAIU: 'Saiu',
  CANCELADA: 'Cancelada',
};

/** Mensagem de por que NÃO dá para registrar a chegada, ou null se pode. */
export function motivoNaoPodeLiberarChegada(
  c: ChegadaBasica,
  placaCavalo: string | null | undefined,
  placaCarreta: string | null | undefined,
  placaCarreta2?: string | null,
): string | null {
  const estado = estadoChegada(c);
  if (estado === 'CANCELADA') return 'Esta chegada foi cancelada.';
  if (estado === 'SAIU') return 'Este caminhão já saiu.';
  if (estado === 'RECEBIDA') return 'O Pátio já descarregou este caminhão.';
  if (estado === 'LIBERADA') return 'A chegada já foi registrada.';
  if (!placaCavalo && !placaCarreta && !placaCarreta2) return 'Informe ao menos uma placa (cavalo ou carreta) para registrar a chegada.';
  return null;
}

/** Portaria: por que NÃO dá para confirmar a saída do caminhão do recebimento (null = pode). */
export function motivoNaoPodeConfirmarSaidaChegada(c: ChegadaBasica): string | null {
  const estado = estadoChegada(c);
  if (estado === 'SAIU') return 'A saída deste caminhão já foi confirmada.';
  if (estado === 'CANCELADA') return 'Esta chegada foi cancelada.';
  if (estado !== 'RECEBIDA') return 'O Pátio ainda não terminou de descarregar este caminhão.';
  if (c.cargaDescarga && !c.cargaCarregadaEm) return 'Este caminhão ainda não foi carregado. A saída só sai depois do carregamento.';
  return null;
}

/** Pátio, carga e descarga: por que NÃO dá para confirmar o carregamento (null = pode). Medição da carga é obrigatória. */
export function motivoNaoPodeMarcarCarregada(c: ChegadaBasica, medidaM: number | null): string | null {
  const estado = estadoChegada(c);
  if (estado === 'CANCELADA') return 'Esta chegada foi cancelada.';
  if (estado === 'SAIU') return 'Este caminhão já saiu.';
  if (!c.cargaDescarga) return 'Este caminhão não é de carga e descarga.';
  if (!c.descarregadaEm) return 'Confirme primeiro que o caminhão foi descarregado.';
  if (c.cargaCarregadaEm) return 'O carregamento deste caminhão já foi confirmado.';
  if (medidaM === null || !Number.isFinite(medidaM) || medidaM <= 0) return 'Informe a medição da carga antes de liberar a saída.';
  return null;
}
