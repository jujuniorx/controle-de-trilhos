import { describe, it, expect } from 'vitest';
import { todasAsNfs, nfsEmTexto, rotuloNfs } from '@/lib/nf';

describe('várias NFs no mesmo carregamento', () => {
  it('junta a principal com as extras', () => {
    const mov = { numeroDocumento: '087781', numerosDocumentoExtras: ['087782', '087783-1'] };
    expect(todasAsNfs(mov)).toEqual(['087781', '087782', '087783-1']);
    expect(nfsEmTexto(mov)).toBe('087781, 087782, 087783-1');
    expect(rotuloNfs(mov)).toBe('NFs 087781, 087782, 087783-1');
  });
  it('uma NF só continua como antes', () => {
    expect(rotuloNfs({ numeroDocumento: '123' })).toBe('NF 123');
    expect(nfsEmTexto({ numeroDocumento: '123', numerosDocumentoExtras: [] })).toBe('123');
  });
  it('sem NF fica vazio', () => {
    expect(todasAsNfs({ numeroDocumento: null, numerosDocumentoExtras: [] })).toEqual([]);
    expect(rotuloNfs({ numeroDocumento: null })).toBe('');
  });
});
