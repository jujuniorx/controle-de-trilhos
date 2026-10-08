import { describe, it, expect, vi, afterAll } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { criarAcessoPatio } from '@/lib/services/patioAcesso';
import { POST } from '@/app/api/sync/route';

const mockCookies = vi.mocked(cookies);

const uuid = () => crypto.randomUUID();
const RESPONSAVEL = 'Teste Sync Route';
const tokenIdsCriados: string[] = [];

function dadosBase() {
  return {
    data: '2026-09-20',
    numeroDocumento: String(Math.floor(Math.random() * 900000) + 100000),
    origem: 'Rondonópolis',
    placaCavalo: 'ABC1D23',
    placaCarreta: 'XYZ9E88',
    responsavelPatio: RESPONSAVEL,
  };
}

function payloadValido(clientId: string) {
  return {
    clientId,
    dados: dadosBase(),
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

/** Cria um token real de acesso ao Pátio no banco e devolve o valor a usar no cookie de teste. */
async function tokenAcessoValido(): Promise<string> {
  const { token } = await criarAcessoPatio();
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const registro = await prisma.patioAcessoToken.findUniqueOrThrow({ where: { tokenHash: hash } });
  tokenIdsCriados.push(registro.id);
  return token;
}

function semCookie(): void {
  mockCookies.mockResolvedValue({ get: () => undefined } as unknown as Awaited<ReturnType<typeof cookies>>);
}

function comCookie(token: string): void {
  mockCookies.mockResolvedValue({
    get: (nome: string) => (nome === 'acesso_patio' ? { name: nome, value: token } : undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/sync', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/sync', () => {
  it('sem cookie acesso_patio → 401, nenhuma Movimentacao criada', async () => {
    semCookie();
    const clientId = uuid();

    const res = await POST(request(payloadValido(clientId)));

    expect(res.status).toBe(401);
    const total = await prisma.movimentacao.count({ where: { clientId } });
    expect(total).toBe(0);
  });

  it('cookie válido + payload válido → 200, cria a Movimentacao', async () => {
    const token = await tokenAcessoValido();
    comCookie(token);
    const clientId = uuid();

    const res = await POST(request(payloadValido(clientId)));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.id).toBe('string');

    const mov = await prisma.movimentacao.findUnique({ where: { clientId } });
    expect(mov).not.toBeNull();
    expect(mov?.id).toBe(json.id);
  });

  it('mesmo clientId enviado duas vezes → 200 nas duas, mesmo id, sem duplicar', async () => {
    const token = await tokenAcessoValido();
    comCookie(token);
    const clientId = uuid();
    const payload = payloadValido(clientId);

    const res1 = await POST(request(payload));
    const json1 = await res1.json();
    const res2 = await POST(request(payload));
    const json2 = await res2.json();

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(json2.id).toBe(json1.id);

    const total = await prisma.movimentacao.count({ where: { clientId } });
    expect(total).toBe(1);
  });

  it('payload malformado (grupos vazio) → 400, nenhuma Movimentacao criada', async () => {
    const token = await tokenAcessoValido();
    comCookie(token);
    const clientId = uuid();
    const payload = { ...payloadValido(clientId), grupos: [] };

    const res = await POST(request(payload));

    expect(res.status).toBe(400);
    const total = await prisma.movimentacao.count({ where: { clientId } });
    expect(total).toBe(0);
  });

  it('corpo que não é JSON válido → 400 limpo (não um 500 do handler padrão do Next)', async () => {
    const token = await tokenAcessoValido();
    comCookie(token);

    const requisicao = new NextRequest('http://localhost/api/sync', {
      method: 'POST',
      body: 'isto não é json {',
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(requisicao);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(typeof json.erro).toBe('string');
  });

  afterAll(async () => {
    await prisma.patioAcessoToken.deleteMany({ where: { id: { in: tokenIdsCriados } } });
    const ids = (
      await prisma.movimentacao.findMany({ where: { responsavelPatio: RESPONSAVEL }, select: { id: true } })
    ).map((m) => m.id);
    await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
    await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });
});
