import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { db, salvarRecebimentoLocal } from '@/lib/offline/db';
import { sincronizarPendentes } from '@/lib/offline/sync';
import type { RecebimentoCaminhaoInput } from '@/lib/validation/recebimento';

function montarPayload(overrides?: Partial<RecebimentoCaminhaoInput>): RecebimentoCaminhaoInput {
  return {
    clientId: randomUUID(),
    dados: {
      data: '2026-09-22',
      numeroDocumento: '12345',
      origem: 'Pátio Central',
      placaCavalo: 'ABC1D23',
      responsavelPatio: 'João da Silva',
    },
    grupos: [
      {
        clientId: randomUUID(),
        perfil: 'TR57',
        tipoMaterial: 'REEMPREGO',
        classificacao: 'G1',
        medicoes: [
          {
            clientId: randomUUID(),
            modo: 'INDIVIDUAL',
            quantidade: 1,
            comprimento: 12,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('sincronizarPendentes', () => {
  beforeEach(async () => {
    await db.recebimentos.clear();
  });

  it('marca como SINCRONIZADO e grava serverId quando o servidor aceita (2xx)', async () => {
    const payload = montarPayload();
    await salvarRecebimentoLocal(payload);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, id: 'xyz' }),
    });

    await sincronizarPendentes(fetchMock as unknown as typeof fetch);

    const registro = await db.recebimentos.get(payload.clientId);
    expect(registro?.syncStatus).toBe('SINCRONIZADO');
    expect(registro?.serverId).toBe('xyz');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sync',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
  });

  it('mantém PENDENTE quando a chamada de rede falha (offline, recuperável)', async () => {
    const payload = montarPayload();
    await salvarRecebimentoLocal(payload);

    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await sincronizarPendentes(fetchMock as unknown as typeof fetch);

    const registro = await db.recebimentos.get(payload.clientId);
    expect(registro?.syncStatus).toBe('PENDENTE');
    expect(registro?.erro).toBeUndefined();
  });

  it('marca como ERRO com mensagem quando o servidor responde 401 (não recuperável por retry)', async () => {
    const payload = montarPayload();
    await salvarRecebimentoLocal(payload);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ erro: 'Não autorizado' }),
    });

    await sincronizarPendentes(fetchMock as unknown as typeof fetch);

    const registro = await db.recebimentos.get(payload.clientId);
    expect(registro?.syncStatus).toBe('ERRO');
    expect(registro?.erro).toBe('Não autorizado');
  });

  it('marca como ERRO com mensagem quando o servidor responde 400 (payload inválido)', async () => {
    const payload = montarPayload();
    await salvarRecebimentoLocal(payload);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ erro: 'Payload inválido' }),
    });

    await sincronizarPendentes(fetchMock as unknown as typeof fetch);

    const registro = await db.recebimentos.get(payload.clientId);
    expect(registro?.syncStatus).toBe('ERRO');
    expect(registro?.erro).toBe('Payload inválido');
  });

  it('marca como ERRO com mensagem quando o servidor responde 422 (regra de negócio)', async () => {
    const payload = montarPayload();
    await salvarRecebimentoLocal(payload);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ ok: false, erro: 'Fator do perfil não cadastrado.' }),
    });

    await sincronizarPendentes(fetchMock as unknown as typeof fetch);

    const registro = await db.recebimentos.get(payload.clientId);
    expect(registro?.syncStatus).toBe('ERRO');
    expect(registro?.erro).toBe('Fator do perfil não cadastrado.');
  });

  it('só tenta sincronizar registros PENDENTE, ignorando os já SINCRONIZADO', async () => {
    const payload = montarPayload();
    await salvarRecebimentoLocal(payload);
    await db.recebimentos.update(payload.clientId, { syncStatus: 'SINCRONIZADO', serverId: 'ja-sincronizado' });

    const fetchMock = vi.fn();
    await sincronizarPendentes(fetchMock as unknown as typeof fetch);

    expect(fetchMock).not.toHaveBeenCalled();
    const registro = await db.recebimentos.get(payload.clientId);
    expect(registro?.syncStatus).toBe('SINCRONIZADO');
    expect(registro?.serverId).toBe('ja-sincronizado');
  });

  it('reclama um registro preso em SINCRONIZANDO além do limite (aba fechada/refresh/requisição travada) e o resincroniza com sucesso na mesma chamada', async () => {
    const payload = montarPayload();
    // Simula um registro órfão: entrou em SINCRONIZANDO numa sessão anterior (aba
    // fechada, hard refresh, requisição que nunca voltou) e nunca mais foi tocado.
    await db.recebimentos.put({
      clientId: payload.clientId,
      payload,
      syncStatus: 'SINCRONIZANDO',
      criadoEm: Date.now(),
      syncIniciadoEm: Date.now() - 5 * 60 * 1000, // 5 minutos atrás — bem além do limite
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, id: 'recuperado' }),
    });

    await sincronizarPendentes(fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const registro = await db.recebimentos.get(payload.clientId);
    expect(registro?.syncStatus).toBe('SINCRONIZADO');
    expect(registro?.serverId).toBe('recuperado');
  });

  it('não reclama um registro SINCRONIZANDO recente (pode ser uma requisição genuinamente em andamento nesta mesma sessão)', async () => {
    const payload = montarPayload();
    await db.recebimentos.put({
      clientId: payload.clientId,
      payload,
      syncStatus: 'SINCRONIZANDO',
      criadoEm: Date.now(),
      syncIniciadoEm: Date.now(), // acabou de começar
    });

    const fetchMock = vi.fn();
    await sincronizarPendentes(fetchMock as unknown as typeof fetch);

    expect(fetchMock).not.toHaveBeenCalled();
    const registro = await db.recebimentos.get(payload.clientId);
    expect(registro?.syncStatus).toBe('SINCRONIZANDO');
  });
});
