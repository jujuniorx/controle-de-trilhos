import { db } from '@/lib/offline/db';

interface RespostaSync {
  ok?: boolean;
  id?: string;
  erro?: string;
}

/**
 * Percorre a fila local (Dexie) de Recebimentos ainda não sincronizados e tenta
 * enviá-los ao servidor, um de cada vez, via POST /api/sync.
 *
 * Regras de status pós-tentativa:
 * - 2xx (res.ok): SINCRONIZADO + serverId (id real da Movimentacao no servidor).
 * - 4xx (401/400/422 etc.): ERRO + mensagem — falha de autorização, payload ou regra
 *   de negócio não se resolve reenviando o mesmo payload sem intervenção.
 * - fetch() lança exceção (rede indisponível): volta para PENDENTE — recuperável,
 *   uma próxima chamada (retry manual ou automático) tentará de novo.
 */
export async function sincronizarPendentes(fetchImpl: typeof fetch = fetch): Promise<void> {
  const pendentes = await db.recebimentos.where('syncStatus').equals('PENDENTE').toArray();

  for (const registro of pendentes) {
    await db.recebimentos.update(registro.clientId, { syncStatus: 'SINCRONIZANDO' });

    try {
      const resposta = await fetchImpl('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registro.payload),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as RespostaSync;

      if (resposta.ok) {
        await db.recebimentos.update(registro.clientId, {
          syncStatus: 'SINCRONIZADO',
          serverId: corpo.id,
          erro: undefined,
        });
      } else {
        await db.recebimentos.update(registro.clientId, {
          syncStatus: 'ERRO',
          erro: corpo.erro ?? `Falha ao sincronizar (HTTP ${resposta.status}).`,
        });
      }
    } catch {
      // Falha de rede (offline, timeout, etc.) — recuperável, tenta de novo depois.
      await db.recebimentos.update(registro.clientId, { syncStatus: 'PENDENTE' });
    }
  }
}
