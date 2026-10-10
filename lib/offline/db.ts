import Dexie, { type EntityTable } from 'dexie';
import type { RecebimentoCaminhaoInput } from '@/lib/validation/recebimento';
import type { PreCadastroSyncInput } from '@/lib/validation/remetido';

export type SyncStatus = 'PENDENTE' | 'SINCRONIZANDO' | 'SINCRONIZADO' | 'ERRO';

// Item de uma fila local (Dexie) que o IndicadorSincronizacao/sincronizarPendentes
// enviam ao servidor. Recebimento e pré-cadastro de remetido usam o mesmo formato.
export interface ItemFila<P> {
  clientId: string;
  payload: P;
  syncStatus: SyncStatus;
  erro?: string;
  criadoEm: number;
  serverId?: string;
  // Timestamp (Date.now()) de quando o registro entrou em SINCRONIZANDO pela última
  // vez. Usado por sincronizarPendentes (lib/offline/sync.ts) para reclamar registros
  // órfãos — presos em SINCRONIZANDO porque a aba fechou/recarregou ou a requisição
  // nunca retornou — de volta para PENDENTE.
  syncIniciadoEm?: number;
}

export type RecebimentoLocal = ItemFila<RecebimentoCaminhaoInput>;
// Remetido "aguardando chegada" cadastrado pelo Pátio (pode ser sem internet).
export type PreCadastroLocal = ItemFila<PreCadastroSyncInput>;

// Rascunho do wizard de Recebimento AINDA EM EDIÇÃO (não finalizado). Uma única
// linha de id fixo 'atual': só existe um caminhão sendo lançado por vez neste
// tablet. `rascunho` é o estado interno do wizard (passo, dados, grupos) —
// shape de responsabilidade do componente, não desta camada (por isso `unknown`).
export interface RascunhoRecebimento {
  id: 'atual';
  clientId: string;
  rascunho: unknown;
  atualizadoEm: number;
}

class TrilhosDB extends Dexie {
  recebimentos!: EntityTable<RecebimentoLocal, 'clientId'>;
  rascunhosRecebimento!: EntityTable<RascunhoRecebimento, 'id'>;
  preCadastros!: EntityTable<PreCadastroLocal, 'clientId'>;

  constructor() {
    super('TrilhosDB');
    this.version(1).stores({
      recebimentos: 'clientId, syncStatus, criadoEm',
    });
    this.version(2).stores({
      recebimentos: 'clientId, syncStatus, criadoEm',
      rascunhosRecebimento: 'id',
    });
    this.version(3).stores({
      recebimentos: 'clientId, syncStatus, criadoEm',
      rascunhosRecebimento: 'id',
      preCadastros: 'clientId, syncStatus, criadoEm',
    });
  }
}

export const db = new TrilhosDB();

export async function salvarRecebimentoLocal(payload: RecebimentoCaminhaoInput): Promise<void> {
  // put (não add): reenviar o mesmo clientId (retry) atualiza o registro existente
  // em vez de lançar erro de chave duplicada.
  await db.recebimentos.put({
    clientId: payload.clientId,
    payload,
    syncStatus: 'PENDENTE',
    criadoEm: Date.now(),
  });
}

export async function salvarPreCadastroLocal(payload: PreCadastroSyncInput): Promise<void> {
  // put (não add): reenviar o mesmo clientId atualiza o registro em vez de falhar.
  await db.preCadastros.put({
    clientId: payload.clientId,
    payload,
    syncStatus: 'PENDENTE',
    criadoEm: Date.now(),
  });
}

export async function salvarRascunhoRecebimento(clientId: string, rascunho: unknown): Promise<void> {
  await db.rascunhosRecebimento.put({ id: 'atual', clientId, rascunho, atualizadoEm: Date.now() });
}

export async function lerRascunhoRecebimento(): Promise<RascunhoRecebimento | undefined> {
  return db.rascunhosRecebimento.get('atual');
}

export async function limparRascunhoRecebimento(): Promise<void> {
  await db.rascunhosRecebimento.delete('atual');
}
