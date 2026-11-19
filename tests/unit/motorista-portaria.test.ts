import { describe, it, expect } from 'vitest';
import { MAX_VEICULOS, resumirMotorista, type ViagemMotorista } from '@/lib/domain/motoristaPortaria';

const base: ViagemMotorista = {
  quando: new Date('2026-11-10T10:00:00Z'),
  nome: 'JOÃO DA SILVA',
  telefone: '14998765432',
  transportadora: 'TRANSLOG',
  placaCavalo: 'ABC1D23',
  placaCarreta: 'XYZ9K88',
  placaCarreta2: null,
  capacidadeCarga: 48,
  comprimentoCarreta: 15.5,
};

describe('resumirMotorista', () => {
  it('sem viagens não acha ninguém', () => {
    expect(resumirMotorista([])).toBeNull();
  });

  it('usa o dado mais recente de cada campo, pulando os vazios', () => {
    const r = resumirMotorista([
      { ...base, quando: new Date('2026-11-01T10:00:00Z'), telefone: '14911112222', transportadora: 'ANTIGA' },
      { ...base, quando: new Date('2026-11-15T10:00:00Z'), telefone: null, transportadora: '  ' },
    ]);
    expect(r).toMatchObject({ nome: 'JOÃO DA SILVA', telefone: '14911112222', transportadora: 'ANTIGA', viagens: 2 });
  });

  it('junta as viagens do mesmo caminhão e põe o mais recente primeiro', () => {
    const r = resumirMotorista([
      { ...base, quando: new Date('2026-11-01T10:00:00Z') },
      { ...base, quando: new Date('2026-11-12T10:00:00Z'), placaCavalo: 'OUT2A11', placaCarreta: 'OUT3B22', capacidadeCarga: null },
      { ...base, quando: new Date('2026-11-05T10:00:00Z') },
    ])!;
    expect(r.veiculos).toHaveLength(2);
    expect(r.veiculos[0]).toMatchObject({ placaCavalo: 'OUT2A11', viagens: 1, ultimaVez: '2026-11-12T10:00:00.000Z' });
    expect(r.veiculos[1]).toMatchObject({ placaCavalo: 'ABC1D23', viagens: 2, ultimaVez: '2026-11-05T10:00:00.000Z' });
  });

  it('viagem antiga completa o limite que a recente deixou em branco', () => {
    const r = resumirMotorista([
      { ...base, quando: new Date('2026-11-12T10:00:00Z'), capacidadeCarga: null, comprimentoCarreta: null },
      { ...base, quando: new Date('2026-11-02T10:00:00Z'), capacidadeCarga: 40, comprimentoCarreta: 14 },
    ])!;
    expect(r.veiculos[0]).toMatchObject({ capacidadeCarga: 40, comprimentoCarreta: 14, viagens: 2 });
  });

  it('viagem sem placa conta para o motorista, mas não vira caminhão', () => {
    const r = resumirMotorista([{ ...base, placaCavalo: null, placaCarreta: '', placaCarreta2: null }])!;
    expect(r.viagens).toBe(1);
    expect(r.veiculos).toHaveLength(0);
  });

  it(`mostra no máximo ${MAX_VEICULOS} caminhões`, () => {
    const viagens = Array.from({ length: MAX_VEICULOS + 3 }, (_, i) => ({
      ...base,
      quando: new Date(Date.UTC(2026, 10, 1 + i)),
      placaCarreta: `AAA${i}B${String(i).padStart(2, '0')}`,
    }));
    expect(resumirMotorista(viagens)!.veiculos).toHaveLength(MAX_VEICULOS);
  });
});
