import { db, type ItemFila } from '@/lib/offline/db';

// O que a sincronização precisa de uma fila local (Dexie). Tipo estrutural simples, e não
// o EntityTable genérico do Dexie, porque o UpdateSpec dele não aceita ItemFila<P> genérico.
type RegistroFila = ItemFila<unknown>;
interface TabelaFila {
  where(indice: 'syncStatus'): { equals(valor: string): { toArray(): Promise<RegistroFila[]> } };
  update(chave: string, mudancas: Partial<RegistroFila>): Promise<number>;
}

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

// Status HTTP que representam uma falha transitória do lado do servidor/rede, e não
// uma rejeição definitiva do payload: 408 (timeout da requisição), 429 (rate limit)
// e toda a faixa 5xx (banco indisponível, cold start do Neon, pool esgotado, deploy
// em andamento, erro de plataforma na borda). Nada disso se resolve com intervenção
// humana — só com o tempo — então o registro volta para PENDENTE e será reenviado
// pelo próximo gatilho (mount, evento `online`, intervalo de 30s do IndicadorSincronizacao).
function ehFalhaRecuperavel(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

/**
 * Percorre as filas locais (Dexie) — Recebimentos e pré-cadastros de Remetido — e tenta
 * enviar o que ainda não foi sincronizado ao servidor, um de cada vez.
 *
 * Regras de status pós-tentativa:
 * - 2xx (res.ok): SINCRONIZADO + serverId (id real da Movimentacao no servidor).
 * - 4xx terminal (401/400/422): ERRO + mensagem — falha de autorização, payload ou
 *   regra de negócio não se resolve reenviando o mesmo payload sem intervenção, e
 *   reenviar em loop só queimaria bateria e banco.
 * - 5xx / 408 / 429: volta para PENDENTE — falha de infraestrutura, transitória.
 * - fetch() lança exceção (rede indisponível): volta para PENDENTE — recuperável,
 *   uma próxima chamada (retry manual ou automático) tentará de novo.
 *
 * ERRO é, portanto, reservado estritamente para o que NÃO se resolve reenviando —
 * porque nenhum gatilho reconsulta registros em ERRO: só `/patio/recebimentos/
 * {clientId}/confirmado` oferece um retry manual, e o operador normalmente já saiu
 * dessa página. Classificar uma falha transitória como ERRO equivale a perder o dado.
 */
export async function sincronizarPendentes(fetchImpl: typeof fetch = fetch): Promise<void> {
  // Duas filas independentes, mesma regra: Recebimentos (POST /api/sync) e pré-cadastros
  // de Remetido "aguardando chegada" (POST /api/sync/pre-cadastro). Em sequência, não
  // em paralelo, para não disputar o banco do servidor nem a rede do tablet.
  await sincronizarFila(db.recebimentos as unknown as TabelaFila, '/api/sync', fetchImpl);
  await sincronizarFila(db.preCadastros as unknown as TabelaFila, '/api/sync/pre-cadastro', fetchImpl);
}

async function sincronizarFila(tabela: TabelaFila, url: string, fetchImpl: typeof fetch): Promise<void> {
  await reclamarSincronizandoOrfaos(tabela);

  const pendentes = await tabela.where('syncStatus').equals('PENDENTE').toArray();

  for (const registro of pendentes) {
    await tabela.update(registro.clientId, {
      syncStatus: 'SINCRONIZANDO',
      syncIniciadoEm: Date.now(),
    });

    try {
      const resposta = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registro.payload),
      });

      const corpo = (await resposta.json().catch(() => ({}))) as RespostaSync;

      if (resposta.ok) {
        await tabela.update(registro.clientId, {
          syncStatus: 'SINCRONIZADO',
          serverId: corpo.id,
          erro: undefined,
          syncIniciadoEm: undefined,
        });
      } else if (ehFalhaRecuperavel(resposta.status)) {
        // Mesmo tratamento de uma falha de rede: continua na fila, sem marcar erro
        // para o operador — não há nada que ele possa fazer, e vai ser reenviado.
        await tabela.update(registro.clientId, {
          syncStatus: 'PENDENTE',
          erro: undefined,
          syncIniciadoEm: undefined,
        });
      } else {
        await tabela.update(registro.clientId, {
          syncStatus: 'ERRO',
          erro: corpo.erro ?? `Falha ao sincronizar (HTTP ${resposta.status}).`,
          syncIniciadoEm: undefined,
        });
      }
    } catch {
      // Falha de rede (offline, timeout, etc.) — recuperável, tenta de novo depois.
      await tabela.update(registro.clientId, { syncStatus: 'PENDENTE', syncIniciadoEm: undefined });
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
async function reclamarSincronizandoOrfaos(tabela: TabelaFila): Promise<void> {
  const agora = Date.now();
  const emAndamento = await tabela.where('syncStatus').equals('SINCRONIZANDO').toArray();

  for (const registro of emAndamento) {
    const iniciadoEm = registro.syncIniciadoEm ?? 0;
    if (agora - iniciadoEm > LIMITE_SINCRONIZANDO_MS) {
      await tabela.update(registro.clientId, { syncStatus: 'PENDENTE', syncIniciadoEm: undefined });
    }
  }
}
