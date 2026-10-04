import { describe, it, expect } from 'vitest';
import { resumoPesoRemetido } from '@/lib/services/remetido';
import type { MovimentacaoRemetidoComGrupos } from '@/lib/services/remetido';

function grupo(pesoInformado: number) {
  return { pesoInformado } as unknown as MovimentacaoRemetidoComGrupos['grupos'][number];
}

describe('resumoPesoRemetido', () => {
  it('soma o pesoInformado de todos os grupos', () => {
    const mov = { grupos: [grupo(10.5), grupo(2.25)] } as unknown as MovimentacaoRemetidoComGrupos;
    expect(resumoPesoRemetido(mov)).toBe(12.75);
  });

  it('retorna 0 quando não há grupos', () => {
    const mov = { grupos: [] } as unknown as MovimentacaoRemetidoComGrupos;
    expect(resumoPesoRemetido(mov)).toBe(0);
  });
});
