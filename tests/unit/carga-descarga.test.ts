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

  it('com caminhão descarregado de carga e descarga, pode carregar', () => {
    expect(motivoNaoPodeMarcarCarregada(descarregado)).toBeNull();
  });

  it('não confirma antes de descarregar', () => {
    expect(motivoNaoPodeMarcarCarregada({ ...base, descarregadaEm: null, cargaDescarga: true, cargaCarregadaEm: null })).toMatch(/descarregado/);
  });

  it('não marca carregamento de caminhão comum', () => {
    expect(motivoNaoPodeMarcarCarregada({ ...descarregado, cargaDescarga: false })).toMatch(/não é de carga/);
  });

  it('não confirma duas vezes', () => {
    expect(motivoNaoPodeMarcarCarregada({ ...descarregado, cargaCarregadaEm: agora })).toMatch(/já foi confirmado/);
  });
});
