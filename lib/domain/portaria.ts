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
