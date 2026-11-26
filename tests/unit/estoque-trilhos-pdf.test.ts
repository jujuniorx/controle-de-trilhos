import { describe, it, expect } from 'vitest';
import { SALDO_INICIAL_2026 } from '@/lib/estoque/saldoInicial2026';
import { somarSaldos, type Lancamento } from '@/lib/estoque/trilhos';
import { gerarEstoqueTrilhosPdf } from '@/lib/pdf/estoqueTrilhos';

const lancamentos: Lancamento[] = SALDO_INICIAL_2026.map((l) => ({ ...l, data: '2026-11-25', origemTipo: 'SALDO_INICIAL', origemId: null, descricao: '' }));

describe('PDF do estoque de trilhos', () => {
  it('gera o PDF com novo, reemprego, sucata e SAP', () => {
    const pdf = gerarEstoqueTrilhosPdf({ saldos: somarSaldos(lancamentos), sap: { TLS_TR68: 2015.52 }, atualizadoEm: '2026-11-26T13:12:00.000Z' });
    const texto = pdf.toString('latin1');
    expect(texto.startsWith('%PDF')).toBe(true);
    expect(texto).toContain('TR68');
    expect(texto).toContain('64.325');
    expect(texto).toContain('Reemprego');
    expect(texto).toContain('SAP');
  });
});
