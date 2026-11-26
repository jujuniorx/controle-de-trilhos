import { describe, expect, it } from 'vitest';
import {
  chavePosicao,
  movimentoDoPeriodo,
  normalizarFabricante,
  somarSaldos,
  tlsPossiveisPorFabricante,
  toneladas,
  type Lancamento,
  type Posicao,
  type Saldo,
} from '@/lib/estoque/trilhos';

function lanc(p: Posicao, data: string, metros: number, unidades: number | null = null): Lancamento {
  return { ...p, data, metros, unidades, origemTipo: 'AJUSTE', origemId: null, descricao: 'teste' };
}

const LISA_TR60_PANGANG: Posicao = { secao: 'NOVO', perfil: 'TR60', tipo: 'LISA', fabricante: 'PANGANG', classe: 'NORMAL' };
const TALA_TR60_PANGANG: Posicao = { ...LISA_TR60_PANGANG, tipo: 'TALA' };

function saldo(p: Posicao, metros: number): Saldo {
  return { ...p, metros, unidades: null };
}

describe('normalizarFabricante', () => {
  it('junta Pangang 4 e 5 e corrige a grafia da planilha', () => {
    expect(normalizarFabricante('Pangang 4')).toBe('PANGANG');
    expect(normalizarFabricante('Pangang 5')).toBe('PANGANG');
    expect(normalizarFabricante('Arcelormital')).toBe('ARCELORMITTAL');
    expect(normalizarFabricante('Nippon')).toBe('NIPPON');
    expect(normalizarFabricante('qualquer outra')).toBe('DIVERSOS');
    expect(normalizarFabricante('')).toBeNull();
    expect(normalizarFabricante(null)).toBeNull();
  });
});

describe('toneladas', () => {
  it('novo usa só o fator do perfil', () => {
    expect(toneladas({ secao: 'NOVO', perfil: 'TR68' }, 29640)).toBeCloseTo(2015.52, 2);
  });
  it('sucata desconta 5% de desgaste', () => {
    expect(toneladas({ secao: 'SUCATA', perfil: 'TR45' }, 9270.31)).toBeCloseTo(396.3, 1);
  });
});

describe('somarSaldos', () => {
  it('soma os lançamentos da mesma posição', () => {
    const s = somarSaldos([
      lanc(LISA_TR60_PANGANG, '2026-11-25', 100),
      lanc(LISA_TR60_PANGANG, '2026-11-26', -30),
      lanc(LISA_TR60_PANGANG, '2026-11-27', 5),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0]!.metros).toBe(75);
    expect(chavePosicao(s[0]!)).toBe(chavePosicao(LISA_TR60_PANGANG));
  });
});

describe('movimentoDoPeriodo', () => {
  it('separa saldo anterior, entradas e saídas', () => {
    const l = [
      lanc(LISA_TR60_PANGANG, '2026-11-20', 100),
      lanc(LISA_TR60_PANGANG, '2026-11-26', 50),
      lanc(LISA_TR60_PANGANG, '2026-11-27', -20),
    ];
    expect(movimentoDoPeriodo(l, chavePosicao(LISA_TR60_PANGANG), '2026-11-26', '2026-11-27')).toEqual({ anterior: 100, entradas: 50, saidas: 20, saldo: 130 });
  });
});

describe('tlsPossiveisPorFabricante', () => {
  it('TR60 Pangang: a tala trava em 88 TLS', () => {
    const r = tlsPossiveisPorFabricante([saldo(LISA_TR60_PANGANG, 40932), saldo(TALA_TR60_PANGANG, 4224)], 'TR60');
    expect(r[0]).toMatchObject({ fabricante: 'PANGANG', tls: 88, trava: 'TALA', lisasBarras: 1705, talasBarras: 176, sobraLisas: 737, sobraTalas: 0 });
  });
  it('TR68 Nippon sem lisa forma 0 TLS', () => {
    const lisa: Posicao = { secao: 'NOVO', perfil: 'TR68', tipo: 'LISA', fabricante: 'NIPPON', classe: 'NORMAL' };
    const r = tlsPossiveisPorFabricante([saldo(lisa, 0), saldo({ ...lisa, tipo: 'TALA' }, 8088)], 'TR68');
    expect(r[0]).toMatchObject({ fabricante: 'NIPPON', tls: 0, trava: 'LISA', talasBarras: 337 });
  });
  it('saldo negativo conta como zero barras', () => {
    const r = tlsPossiveisPorFabricante([saldo(LISA_TR60_PANGANG, -264), saldo(TALA_TR60_PANGANG, 480)], 'TR60');
    expect(r[0]).toMatchObject({ lisasBarras: 0, tls: 0 });
  });
  it('não conta barras de 21 m nem torcido', () => {
    const r = tlsPossiveisPorFabricante(
      [saldo({ ...LISA_TR60_PANGANG, classe: '21M' }, 2400), saldo({ ...TALA_TR60_PANGANG, classe: 'TORCIDO' }, 480)],
      'TR60',
    );
    expect(r).toHaveLength(0);
  });
});
