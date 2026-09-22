import Dexie, { type EntityTable } from 'dexie';
import type { RecebimentoCaminhaoInput } from '@/lib/validation/recebimento';

export type SyncStatus = 'PENDENTE' | 'SINCRONIZANDO' | 'SINCRONIZADO' | 'ERRO';

export interface RecebimentoLocal {
  clientId: string;
  payload: RecebimentoCaminhaoInput;
  syncStatus: SyncStatus;
  erro?: string;
  criadoEm: number;
  serverId?: string;
}

class TrilhosDB extends Dexie {
  recebimentos!: EntityTable<RecebimentoLocal, 'clientId'>;

  constructor() {
    super('TrilhosDB');
    this.version(1).stores({
      recebimentos: 'clientId, syncStatus, criadoEm',
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
