/** Regras puras da Portaria (sem banco) — testáveis e usadas pelo serviço e pelas telas. */

export type EstadoPortaria = 'MEDINDO' | 'AGUARDANDO_CARRETA' | 'LIBERADA';

export interface MovimentacaoPortariaBasica {
  status: string;
  medicaoConcluidaEm: Date | null;
  carretaLiberadaEm: Date | null;
}

export function estadoPortaria(m: MovimentacaoPortariaBasica): EstadoPortaria {
  if (m.carretaLiberadaEm) return 'LIBERADA';
  if (m.medicaoConcluidaEm) return 'AGUARDANDO_CARRETA';
  return 'MEDINDO';
}

export const ROTULO_ESTADO: Record<EstadoPortaria, string> = {
  MEDINDO: 'Pátio medindo',
  AGUARDANDO_CARRETA: 'Medido — aguardando a carreta',
  LIBERADA: 'Carreta liberada',
};

/** Devolve a mensagem de por que NÃO dá para liberar, ou null se pode liberar. */
export function motivoNaoPodeLiberar(
  m: MovimentacaoPortariaBasica,
  placaCavalo: string | null | undefined,
  placaCarreta: string | null | undefined,
): string | null {
  if (m.status !== 'AGUARDANDO_CHEGADA') return 'Este remetido não está mais aguardando chegada.';
  if (m.carretaLiberadaEm) return 'A carreta já foi liberada.';
  if (!m.medicaoConcluidaEm) return 'O Pátio ainda não terminou de medir.';
  if (!placaCavalo && !placaCarreta) return 'Informe ao menos uma placa (cavalo ou carreta) para liberar.';
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

export type EstadoChegada = 'AGUARDANDO_LIBERACAO' | 'LIBERADA' | 'RECEBIDA' | 'CANCELADA';

export interface ChegadaBasica {
  liberadaEm: Date | null;
  canceladaEm: Date | null;
  movimentacaoId: string | null;
}

export function estadoChegada(c: ChegadaBasica): EstadoChegada {
  if (c.canceladaEm) return 'CANCELADA';
  if (c.movimentacaoId) return 'RECEBIDA';
  if (c.liberadaEm) return 'LIBERADA';
  return 'AGUARDANDO_LIBERACAO';
}

export const ROTULO_ESTADO_CHEGADA: Record<EstadoChegada, string> = {
  AGUARDANDO_LIBERACAO: 'Chegou — aguardando liberação',
  LIBERADA: 'Liberado para descarregar',
  RECEBIDA: 'Descarregado',
  CANCELADA: 'Cancelada',
};

/** Mensagem de por que NÃO dá para liberar a chegada, ou null se pode. */
export function motivoNaoPodeLiberarChegada(
  c: ChegadaBasica,
  placaCavalo: string | null | undefined,
  placaCarreta: string | null | undefined,
): string | null {
  const estado = estadoChegada(c);
  if (estado === 'CANCELADA') return 'Esta chegada foi cancelada.';
  if (estado === 'RECEBIDA') return 'O Pátio já descarregou este caminhão.';
  if (estado === 'LIBERADA') return 'O caminhão já foi liberado.';
  if (!placaCavalo && !placaCarreta) return 'Informe ao menos uma placa (cavalo ou carreta) para liberar.';
  return null;
}
