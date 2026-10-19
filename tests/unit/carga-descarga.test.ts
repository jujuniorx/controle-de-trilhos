import { describe, expect, it } from 'vitest';
import { motivoNaoPodeConfirmarSaidaChegada, motivoNaoPodeMarcarCarregada } from '@/lib/domain/portaria';

const base = { liberadaEm: new Date(), canceladaEm: null, movimentacaoId: null, saidaEm: null };
const agora = new Date();

describe('carga e descarga: saída', () => {
  it('caminhão comum: pode sair logo depois de descarregar', () => {
    expect(motivoNaoPodeConfirmarSaidaChegada({ ...base, descarregadaEm: agora, cargaDescarga: false })).toBeNull();
  });

  it('carga e descarga: não sai antes do carregamento', () => {
    expect(motivoNaoPodeConfirmarSaidaChegada({ ...base, descarregadaEm: agora, cargaDescarga: true, cargaCarregadaEm: null })).toMatch(/carregado/);
  });

  it('carga e descarga: sai depois do carregamento', () => {
    expect(motivoNaoPodeConfirmarSaidaChegada({ ...base, descarregadaEm: agora, cargaDescarga: true, cargaCarregadaEm: agora })).toBeNull();
  });
});

describe('carga e descarga: carregamento', () => {
  const descarregado = { ...base, descarregadaEm: agora, cargaDescarga: true, cargaCarregadaEm: null };

  it('exige a medição da carga', () => {
    expect(motivoNaoPodeMarcarCarregada(descarregado, null)).toMatch(/medição/);
    expect(motivoNaoPodeMarcarCarregada(descarregado, 0)).toMatch(/medição/);
    expect(motivoNaoPodeMarcarCarregada(descarregado, -3)).toMatch(/medição/);
  });

  it('com medição válida, libera', () => {
    expect(motivoNaoPodeMarcarCarregada(descarregado, 120.5)).toBeNull();
  });

  it('não confirma antes de descarregar', () => {
    expect(motivoNaoPodeMarcarCarregada({ ...base, descarregadaEm: null, cargaDescarga: true, cargaCarregadaEm: null }, 10)).toMatch(/descarregado/);
  });

  it('não marca carregamento de caminhão comum', () => {
    expect(motivoNaoPodeMarcarCarregada({ ...descarregado, cargaDescarga: false }, 10)).toMatch(/não é de carga/);
  });

  it('não confirma duas vezes', () => {
    expect(motivoNaoPodeMarcarCarregada({ ...descarregado, cargaCarregadaEm: agora }, 10)).toMatch(/já foi confirmado/);
  });
});
