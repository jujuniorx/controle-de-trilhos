import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import { fatorPerfil, calcularPeso } from '@/lib/services/calculo';
import type { Perfil } from '@/lib/domain/regras';

const FATORES_OFICIAIS: Record<Perfil, number> = {
  TR22: 0.022,
  TR32: 0.032,
  TR37: 0.037,
  TR40: 0.04,
  TR45: 0.045,
  TR50: 0.05,
  TR54: 0.054,
  TR55: 0.055,
  TR57: 0.057,
  TR60: 0.06,
  TR68: 0.068,
};

describe('fatorPerfil', () => {
  it('lê, para cada um dos 11 perfis, exatamente o fator oficial cadastrado em FatorPerfil', async () => {
    for (const [perfil, fatorEsperado] of Object.entries(FATORES_OFICIAIS) as [Perfil, number][]) {
      expect(await fatorPerfil(perfil)).toBe(fatorEsperado);
    }
  });

  it('todos os 11 perfis do enum PerfilTrilho têm uma linha em FatorPerfil', async () => {
    const registros = await prisma.fatorPerfil.findMany();
    const perfisCadastrados = registros.map((r) => r.perfil).sort();
    expect(perfisCadastrados).toEqual(Object.keys(FATORES_OFICIAIS).sort());
  });

  it('rejeita um perfil sem fator cadastrado (defesa contra lacunas futuras)', async () => {
    const original = await prisma.fatorPerfil.findUniqueOrThrow({ where: { perfil: 'TR32' } });
    await prisma.fatorPerfil.delete({ where: { perfil: 'TR32' } });
    try {
      await expect(fatorPerfil('TR32')).rejects.toThrow(/ainda não cadastrado/);
    } finally {
      await prisma.fatorPerfil.create({ data: { perfil: original.perfil, fator: original.fator } });
    }
  });
});

describe('calcularPeso', () => {
  it('calcula peso com 3 casas decimais para os exemplos confirmados', async () => {
    expect(await calcularPeso(4.65, 'TR22')).toBe(0.102);
    expect(await calcularPeso(10, 'TR37')).toBe(0.37);
    expect(await calcularPeso(12, 'TR57')).toBe(0.684);
    expect(await calcularPeso(12, 'TR68')).toBe(0.816);
  });

  it('calcula peso para todos os 11 perfis usando o fator oficial', async () => {
    for (const [perfil, fatorEsperado] of Object.entries(FATORES_OFICIAIS) as [Perfil, number][]) {
      const esperado = Math.round(10 * fatorEsperado * 1000) / 1000;
      expect(await calcularPeso(10, perfil)).toBe(esperado);
    }
  });

  it('aplica quantidade × metros × fator quando o total de metros já inclui a quantidade', async () => {
    expect(await calcularPeso(5 * 12.0, 'TR68')).toBe(4.08);
  });

  it('propaga o erro quando o perfil não tem fator cadastrado', async () => {
    const original = await prisma.fatorPerfil.findUniqueOrThrow({ where: { perfil: 'TR40' } });
    await prisma.fatorPerfil.delete({ where: { perfil: 'TR40' } });
    try {
      await expect(calcularPeso(10, 'TR40')).rejects.toThrow(/ainda não cadastrado/);
    } finally {
      await prisma.fatorPerfil.create({ data: { perfil: original.perfil, fator: original.fator } });
    }
  });
});
