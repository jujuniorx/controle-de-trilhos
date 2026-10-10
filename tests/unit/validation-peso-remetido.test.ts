import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PESO_MAX_GRUPO_T, MSG_PESO_UNIDADE, grupoRemetidoSchema } from '@/lib/validation/remetido';
import { MARCAS } from '@/lib/validation/recebimento';

function grupoNovo(pesoInformado?: number) {
  return {
    clientId: randomUUID(),
    tipoMaterial: 'NOVO' as const,
    perfil: 'TR57' as const,
    marca: MARCAS[0],
    pesoInformado,
    medicoes: [{ clientId: randomUUID(), modo: 'INDIVIDUAL' as const, quantidade: 1, comprimento: 11.5 }],
  };
}

describe('peso informado do remetido é em toneladas', () => {
  it('aceita um peso plausível em toneladas', () => {
    expect(grupoRemetidoSchema.safeParse(grupoNovo(31.18)).success).toBe(true);
    expect(grupoRemetidoSchema.safeParse(grupoNovo(PESO_MAX_GRUPO_T)).success).toBe(true);
  });

  it('aceita ausência de peso (o Pátio não informa o peso da NF)', () => {
    expect(grupoRemetidoSchema.safeParse(grupoNovo(undefined)).success).toBe(true);
  });

  it('recusa peso digitado em kg (31180 em vez de 31,18)', () => {
    const r = grupoRemetidoSchema.safeParse(grupoNovo(31180));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain(MSG_PESO_UNIDADE);
  });
});
