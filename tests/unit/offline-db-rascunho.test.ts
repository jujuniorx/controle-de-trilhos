import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import { db, salvarRascunhoRecebimento, lerRascunhoRecebimento, limparRascunhoRecebimento } from '@/lib/offline/db';

describe('rascunho de Recebimento em andamento (Dexie)', () => {
  afterEach(async () => {
    await db.rascunhosRecebimento.clear();
  });

  it('salva e lê de volta o rascunho mais recente', async () => {
    await salvarRascunhoRecebimento('client-1', { passo: 2, grupos: ['a'] });

    const registro = await lerRascunhoRecebimento();
    expect(registro?.clientId).toBe('client-1');
    expect(registro?.rascunho).toEqual({ passo: 2, grupos: ['a'] });
    expect(typeof registro?.atualizadoEm).toBe('number');
  });

  it('salvar de novo substitui o rascunho anterior (só existe um por vez)', async () => {
    await salvarRascunhoRecebimento('client-1', { passo: 1 });
    await salvarRascunhoRecebimento('client-1', { passo: 3 });

    const registro = await lerRascunhoRecebimento();
    expect(registro?.rascunho).toEqual({ passo: 3 });
    expect(await db.rascunhosRecebimento.count()).toBe(1);
  });

  it('sem rascunho salvo, a leitura devolve undefined', async () => {
    expect(await lerRascunhoRecebimento()).toBeUndefined();
  });

  it('limpar remove o rascunho', async () => {
    await salvarRascunhoRecebimento('client-1', { passo: 2 });
    await limparRascunhoRecebimento();
    expect(await lerRascunhoRecebimento()).toBeUndefined();
  });
});
