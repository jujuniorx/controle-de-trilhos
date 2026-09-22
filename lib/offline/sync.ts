import { db } from '@/lib/offline/db';

interface RespostaSync {
  ok?: boolean;
  id?: string;
  erro?: string;
}

// Teto para uma tentativa "em voo": se um registro ficou em SINCRONIZANDO por mais
// tempo que isso, tratamos como órfão (aba fechada, hard refresh, ou requisição que
// nunca retornou — janela real, já que o wizard dispara a sincronização e navega
// embora imediatamente) e devolvemos para PENDENTE. Idempotência do lado do servidor
// (criarRecebimentoCaminhao já faz findUnique por clientId) torna seguro reenviar
// mesmo que a requisição original ainda estivesse, de fato, em andamento.
const LIMITE_SINCRONIZANDO_MS = 15_000;

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
  await reclamarSincronizandoOrfaos();

  const pendentes = await db.recebimentos.where('syncStatus').equals('PENDENTE').toArray();

  for (const registro of pendentes) {
    await db.recebimentos.update(registro.clientId, {
      syncStatus: 'SINCRONIZANDO',
      syncIniciadoEm: Date.now(),
    });

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
          syncIniciadoEm: undefined,
        });
      } else {
        await db.recebimentos.update(registro.clientId, {
          syncStatus: 'ERRO',
          erro: corpo.erro ?? `Falha ao sincronizar (HTTP ${resposta.status}).`,
          syncIniciadoEm: undefined,
        });
      }
    } catch {
      // Falha de rede (offline, timeout, etc.) — recuperável, tenta de novo depois.
      await db.recebimentos.update(registro.clientId, { syncStatus: 'PENDENTE', syncIniciadoEm: undefined });
    }
  }
}

/**
 * Devolve para PENDENTE qualquer registro preso em SINCRONIZANDO há mais que
 * LIMITE_SINCRONIZANDO_MS. Sem isso, um registro cuja aba fechou (ou cuja requisição
 * nunca resolveu) ficaria SINCRONIZANDO para sempre — nada mais o consultaria de
 * volta, e o indicador de sincronização (Task 7) o contaria como pendente sem nunca
 * ter um gatilho que o reprocessasse.
 */
async function reclamarSincronizandoOrfaos(): Promise<void> {
  const agora = Date.now();
  const emAndamento = await db.recebimentos.where('syncStatus').equals('SINCRONIZANDO').toArray();

  for (const registro of emAndamento) {
    const iniciadoEm = registro.syncIniciadoEm ?? 0;
    if (agora - iniciadoEm > LIMITE_SINCRONIZANDO_MS) {
      await db.recebimentos.update(registro.clientId, { syncStatus: 'PENDENTE', syncIniciadoEm: undefined });
    }
  }
}
