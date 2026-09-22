import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import { db, salvarRecebimentoLocal } from '@/lib/offline/db';
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

describe('camada offline (Dexie) para Recebimento', () => {
  it('grava um RecebimentoLocal e lê de volta por clientId, com syncStatus PENDENTE inicial', async () => {
    const payload = montarPayload();

    await salvarRecebimentoLocal(payload);

    const registro = await db.recebimentos.get(payload.clientId);
    expect(registro).toBeDefined();
    expect(registro?.clientId).toBe(payload.clientId);
    expect(registro?.payload).toEqual(payload);
    expect(registro?.syncStatus).toBe('PENDENTE');
    expect(typeof registro?.criadoEm).toBe('number');
  });

  it('não colide quando dois clientId diferentes são salvos', async () => {
    const payloadA = montarPayload();
    const payloadB = montarPayload();

    await salvarRecebimentoLocal(payloadA);
    await salvarRecebimentoLocal(payloadB);

    const registroA = await db.recebimentos.get(payloadA.clientId);
    const registroB = await db.recebimentos.get(payloadB.clientId);

    expect(registroA?.clientId).toBe(payloadA.clientId);
    expect(registroB?.clientId).toBe(payloadB.clientId);
    expect(registroA?.clientId).not.toBe(registroB?.clientId);
  });

  it('salvar duas vezes o mesmo clientId atualiza em vez de duplicar (reenvio do mesmo formulário)', async () => {
    const payload = montarPayload();

    await salvarRecebimentoLocal(payload);
    const contagemAntes = await db.recebimentos.count();

    const payloadAtualizado: RecebimentoCaminhaoInput = {
      ...payload,
      dados: { ...payload.dados, responsavelPatio: 'Maria Souza' },
    };
    await salvarRecebimentoLocal(payloadAtualizado);
    const contagemDepois = await db.recebimentos.count();

    expect(contagemDepois).toBe(contagemAntes);

    const registro = await db.recebimentos.get(payload.clientId);
    expect(registro?.payload.dados.responsavelPatio).toBe('Maria Souza');
  });
});
