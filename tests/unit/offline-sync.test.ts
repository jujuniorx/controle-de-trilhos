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
});
