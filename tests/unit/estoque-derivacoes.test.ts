import { describe, expect, it } from 'vitest';
import { tlsFechadosPorHora } from '@/lib/producaoTls';
import { lancamentosDeMovimentacao, lancamentosDeProducao, type MovFonte } from '@/lib/estoque/derivacoes';

function mov(over: Partial<MovFonte> = {}): MovFonte {
  return {
    id: 'm1',
    tipo: 'RECEBIMENTO',
    status: 'CONFERIDO',
    data: '2026-11-26',
    rotulo: 'Recebimento NF 123',
    grupos: [
      { tipoMaterial: 'REEMPREGO', perfil: 'TR60', classificacao: 'G2', fabricante: null, formaNovo: null, metrosTotal: 312.4, medicoes: [] },
    ],
    ...over,
  };
}

describe('lancamentosDeMovimentacao', () => {
  it('recebimento conferido de reemprego entra no G da classificação', () => {
    const l = lancamentosDeMovimentacao(mov());
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ secao: 'REEMPREGO', perfil: 'TR60', tipo: 'BARRA', fabricante: null, classe: 'G2', metros: 312.4, origemTipo: 'RECEBIMENTO', origemId: 'm1' });
  });

  it('o mesmo registro como remetido sai do estoque (conversão de tipo)', () => {
    const l = lancamentosDeMovimentacao(mov({ tipo: 'REMETIDO' }));
    expect(l[0]).toMatchObject({ metros: -312.4, origemTipo: 'REMETIDO' });
  });

  it('não conferido não mexe no saldo (reaberto na edição)', () => {
    expect(lancamentosDeMovimentacao(mov({ status: 'PENDENTE_CONFERENCIA' }))).toEqual([]);
  });

  it('sucata entra pela classe de cada medição; jacaré vai para SC3 e diversos não tem metros', () => {
    const l = lancamentosDeMovimentacao(
      mov({
        grupos: [
          {
            tipoMaterial: 'SUCATA',
            perfil: 'TR57',
            classificacao: null,
            fabricante: null,
            formaNovo: null,
            metrosTotal: 13,
            medicoes: [
              { metros: 10, classificacaoSC: 'SC1' },
              { metros: 3, classificacaoSC: 'JACARE' },
              { metros: 0, classificacaoSC: 'DIVERSOS' },
            ],
          },
        ],
      }),
    );
    expect(l.filter((x) => x.metros !== 0).map((x) => [x.classe, x.metros])).toEqual([
      ['SC1', 10],
      ['SC3', 3],
    ]);
    expect(l.some((x) => x.alerta === 'Diversos sem metros')).toBe(true);
  });

  it('envio de novo sem Lisa/Tala não mexe nos metros e fica marcado', () => {
    const l = lancamentosDeMovimentacao(
      mov({
        tipo: 'REMETIDO',
        grupos: [{ tipoMaterial: 'NOVO', perfil: 'TR68', classificacao: null, fabricante: 'PANGANG', formaNovo: null, metrosTotal: 240, medicoes: [] }],
      }),
    );
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ metros: 0, alerta: 'Novo sem Lisa/Tala' });
  });

  it('vagão de novo entra em lisa ou tala do fabricante', () => {
    const l = lancamentosDeMovimentacao(
      mov({
        grupos: [
          { tipoMaterial: 'NOVO', perfil: 'TR68', classificacao: null, fabricante: 'PANGANG', formaNovo: 'LISA', metrosTotal: 864, medicoes: [] },
          { tipoMaterial: 'NOVO', perfil: 'TR68', classificacao: null, fabricante: 'PANGANG', formaNovo: 'TALA', metrosTotal: 144, medicoes: [] },
        ],
      }),
    );
    expect(l.map((x) => [x.tipo, x.fabricante, x.classe, x.metros])).toEqual([
      ['LISA', 'PANGANG', 'NORMAL', 864],
      ['TALA', 'PANGANG', 'NORMAL', 144],
    ]);
  });
});

describe('tlsFechadosPorHora', () => {
  it('cada 12 soldas de novo fecha um TLS na hora em que completou', () => {
    const f = tlsFechadosPorHora(0, [
      { hora: '07:00', soldas: 12, fabricante: 'Pangang 4', perfil: 'TR68' },
      { hora: '08:00', soldas: 12, fabricante: 'Pangang 4', perfil: 'TR68' },
    ]);
    expect(f).toEqual([
      { hora: '07:00', perfil: 'TR68', fabricante: 'Pangang 4', reemprego: false, quantidade: 1 },
      { hora: '08:00', perfil: 'TR68', fabricante: 'Pangang 4', reemprego: false, quantidade: 1 },
    ]);
  });
});

describe('lancamentosDeProducao', () => {
  const dia = {
    data: '2026-11-26',
    sobraEntrada: 0,
    ajusteTls: 0,
    horas: [{ hora: '07:00', soldas: 12, fabricante: 'Pangang 5', perfil: 'TR68' }],
  };

  it('TLS novo: +1 TLS, −11 lisas e −2 talas do mesmo fabricante', () => {
    const l = lancamentosDeProducao(dia);
    expect(l.map((x) => [x.tipo, x.fabricante, x.metros, x.unidades])).toEqual([
      ['TLS', 'PANGANG', 312, 1],
      ['LISA', 'PANGANG', -264, null],
      ['TALA', 'PANGANG', -48, null],
    ]);
  });

  it('ajuste de barras a mais tira o TLS do dia', () => {
    expect(lancamentosDeProducao({ ...dia, ajusteTls: 12 })).toEqual([]);
  });

  it('TLS de reemprego: +1 TLS de reemprego e −312 m do G1', () => {
    const l = lancamentosDeProducao({
      data: '2026-11-26',
      sobraEntrada: 0,
      ajusteTls: 0,
      horas: [{ hora: '07:00', soldas: 30, fabricante: 'Reemprego', perfil: 'TR68', resposta: 'sim:30' }],
    });
    expect(l.map((x) => [x.secao, x.tipo, x.classe, x.metros, x.unidades])).toEqual([
      ['REEMPREGO', 'TLS', 'TLS', 312, 1],
      ['REEMPREGO', 'BARRA', 'G1', -312, null],
    ]);
  });
});

describe('lancamentosDeMovimentacao: remetido de vagão (B.O. do trilheiro)', () => {
  const tlsNovo = { tipoMaterial: 'NOVO' as const, perfil: 'TR68', classificacao: null, fabricante: 'Pangang', formaNovo: null, metrosTotal: 8424, medicoes: [], tls: 27 };
  const tlsReemprego = { tipoMaterial: 'REEMPREGO' as const, perfil: 'TR60', classificacao: null, fabricante: null, formaNovo: null, metrosTotal: 4056, medicoes: [], tls: 13 };

  it('tira os TLS novos do perfil e da marca, e os de reemprego sem marca', () => {
    const l = lancamentosDeMovimentacao(mov({ tipo: 'REMETIDO', grupos: [tlsNovo, tlsReemprego] }));
    expect(l.map((x) => [x.secao, x.perfil, x.tipo, x.fabricante, x.classe, x.metros, x.unidades])).toEqual([
      ['NOVO', 'TR68', 'TLS', 'PANGANG', 'NORMAL', -8424, -27],
      ['REEMPREGO', 'TR60', 'TLS', null, 'TLS', -4056, -13],
    ]);
    expect(l.every((x) => x.origemTipo === 'REMETIDO' && !x.alerta)).toBe(true);
  });

  it('com "não mexe no estoque" fica registrado e não gera lançamento', () => {
    expect(lancamentosDeMovimentacao(mov({ tipo: 'REMETIDO', movimentaEstoque: false, grupos: [tlsNovo] }))).toEqual([]);
  });

  it('sem a informação (movimentações antigas) continua mexendo no estoque', () => {
    expect(lancamentosDeMovimentacao(mov({ tipo: 'REMETIDO' }))).toHaveLength(1);
  });
});

describe('lancamentosDeProducao: TLS que começou num dia e fechou no outro', () => {
  const horas = [{ hora: '07:00', soldas: 20, fabricante: 'Pangang 4', perfil: 'TR68' }];

  it('o primeiro TLS fechado conta no dia em que começou (como o relatório da Produção)', () => {
    const l = lancamentosDeProducao({ data: '2026-11-28', sobraEntrada: 8, ajusteTls: 0, horas, inicioTlsAberto: '2026-11-27' });
    const tls = l.filter((x) => x.tipo === 'TLS').map((x) => [x.data, x.unidades]);
    expect(tls).toEqual([['2026-11-27', 1], ['2026-11-28', 1]]);
  });

  it('começou até 24/11: já está no saldo da planilha e não conta de novo', () => {
    const l = lancamentosDeProducao({ data: '2026-11-25', sobraEntrada: 8, ajusteTls: 0, horas, inicioTlsAberto: '2026-11-24' });
    const tls = l.filter((x) => x.tipo === 'TLS').map((x) => [x.data, x.unidades]);
    expect(tls).toEqual([['2026-11-25', 1]]);
    expect(l.filter((x) => x.tipo === 'LISA').map((x) => x.metros)).toEqual([-264]);
  });

  it('a planilha vai até 24/11: TLS começado em 25/11 entra no estoque', () => {
    const l = lancamentosDeProducao({ data: '2026-11-26', sobraEntrada: 8, ajusteTls: 0, horas, inicioTlsAberto: '2026-11-25' });
    expect(l.filter((x) => x.tipo === 'TLS').map((x) => [x.data, x.unidades])).toEqual([['2026-11-25', 1], ['2026-11-26', 1]]);
  });

  it('sem TLS aberto de antes: tudo no próprio dia', () => {
    const l = lancamentosDeProducao({ data: '2026-11-28', sobraEntrada: 0, ajusteTls: 0, horas: [{ hora: '07:00', soldas: 24, fabricante: 'Pangang 4', perfil: 'TR68' }], inicioTlsAberto: null });
    expect(l.filter((x) => x.tipo === 'TLS').map((x) => [x.data, x.unidades])).toEqual([['2026-11-28', 2]]);
  });
});
