/**
 * Classificação de falhas de POST /api/sync — a metade servidora do contrato que
 * lib/offline/sync.ts consome para decidir entre PENDENTE (reenviar) e ERRO
 * (terminal). Aqui o serviço e a autorização são mockados de propósito: o que está
 * sob teste é só o mapeamento exceção → status, sem depender do banco.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => ({ name: 'acesso_patio', value: 'token-de-teste' }) }),
}));

vi.mock('@/lib/services/patioAcesso', () => ({
  validarAcessoPatio: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/services/movimentacao', () => ({
  criarRecebimentoCaminhao: vi.fn(),
}));

import { NextRequest } from 'next/server';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { POST } from '@/app/api/sync/route';

const criarMock = vi.mocked(criarRecebimentoCaminhao);

const uuid = () => crypto.randomUUID();

function payloadValido() {
  return {
    clientId: uuid(),
    dados: {
      data: '2026-09-20',
      numeroDocumento: '123456',
      origem: 'Rondonópolis',
      placaCavalo: 'ABC1D23',
      responsavelPatio: 'Teste Classificacao',
    },
    grupos: [
      {
        clientId: uuid(),
        perfil: 'TR22',
        tipoMaterial: 'NOVO',
        marca: 'NIPPON',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 5 }],
      },
    ],
  };
}

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/sync', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/sync — recuperável vs terminal', () => {
  beforeEach(() => {
    criarMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('erro de regra de negócio → 422 (terminal) com a mensagem própria da aplicação', async () => {
    criarMock.mockRejectedValue(new ErroRegraNegocio('Fator do perfil TR22 ainda não cadastrado.'));

    const res = await POST(request(payloadValido()));

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.erro).toBe('Fator do perfil TR22 ainda não cadastrado.');
  });

  it('falha de infraestrutura → 503 (recuperável), sem vazar a mensagem interna', async () => {
    criarMock.mockRejectedValue(
      new Error("Can't reach database server at `ep-xyz.neon.tech`:5432 (prisma internals)"),
    );

    const res = await POST(request(payloadValido()));

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.erro).not.toMatch(/neon\.tech|prisma/i);
    expect(json.erro).toBe('Falha temporária ao sincronizar. Tentaremos novamente.');
  });

  it('exceção com forma inesperada (não-Error) → 503, tratada como infraestrutura', async () => {
    criarMock.mockRejectedValue('string solta');

    const res = await POST(request(payloadValido()));

    expect(res.status).toBe(503);
  });

  it('corpo não-JSON → 400 e o serviço nunca é chamado', async () => {
    const requisicao = new NextRequest('http://localhost/api/sync', {
      method: 'POST',
      body: '{{{ não é json',
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(requisicao);

    expect(res.status).toBe(400);
    expect(criarMock).not.toHaveBeenCalled();
  });
});
