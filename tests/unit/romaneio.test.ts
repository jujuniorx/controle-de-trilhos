import { describe, it, expect } from 'vitest';
import {
  htmlRomaneioRecebimento,
  htmlRomaneioRemetido,
  escaparHtml,
  type MovimentacaoRomaneio,
} from '@/lib/romaneio';

// Imita o Decimal do Prisma: objeto (não number) que só vira número via valueOf/toString.
class Decimal {
  constructor(private readonly v: string) {}
  toString() {
    return this.v;
  }
  valueOf() {
    return this.v;
  }
}

function movBase(overrides: Partial<MovimentacaoRomaneio> = {}): MovimentacaoRomaneio {
  return {
    id: 'mov1',
    numeroDocumento: '123456',
    origem: 'Usina Norte',
    destino: 'Jales',
    reservaPedido: null,
    tipoTransporte: 'CAMINHAO',
    transportadora: 'Translog',
    placaCavalo: 'ABC1D23',
    placaCarreta: 'XYZ9E88',
    placaCarreta2: null,
    responsavelPatio: 'Rafael',
    dataMovimentacao: new Date('2026-10-14T00:00:00.000Z'),
    status: 'PENDENTE_CONFERENCIA',
    remetidoDetalhe: { tipoRemetido: null },
    grupos: [
      {
        perfil: 'TR57',
        tipoMaterial: 'NOVO',
        tampao: false,
        metrosTotal: new Decimal('24.30'),
        pesoCalculado: new Decimal('1.386'),
        pesoInformado: null,
        medicoes: [
          { quantidade: 2, comprimento: new Decimal('12.15'), metros: new Decimal('24.30'), classificacaoSC: null },
        ],
      },
    ],
    ...overrides,
  };
}

describe('romaneio — HTML imprimível', () => {
  it('gera o recebimento com Date e Decimal sem estourar (regressão do erro 500)', () => {
    const html = htmlRomaneioRecebimento(movBase(), 'abc123');
    expect(html).toContain('ROMANEIO DE RECEBIMENTO');
    expect(html).toContain('14/10/2026');
    expect(html).toContain('2×12,15');
    expect(html).toContain('24,30');
    expect(html).toContain('1,386');
  });

  it('data nula vira "—" em vez de estourar', () => {
    const html = htmlRomaneioRecebimento(movBase({ dataMovimentacao: null }), null);
    expect(html).toContain('ROMANEIO DE RECEBIMENTO');
  });

  it('remetido sem tipo mostra "Em aberto" e sem destino/NF não quebra', () => {
    const html = htmlRomaneioRemetido(movBase({ numeroDocumento: null, destino: null }), null);
    expect(html).toContain('Em aberto');
    expect(html).toContain('ROMANEIO DE REMETIDO');
  });

  it('remetido com tipo mostra o rótulo e usa o peso informado quando existe', () => {
    const mov = movBase({ remetidoDetalhe: { tipoRemetido: 'TRANS' } });
    mov.grupos[0].pesoInformado = new Decimal('9.5');
    const html = htmlRomaneioRemetido(mov, null);
    expect(html).toContain('Transferência');
    expect(html).toContain('9,5');
  });

  it('remetido SUCATA mostra a classificação ao lado da medição', () => {
    const mov = movBase();
    mov.grupos[0].tipoMaterial = 'SUCATA';
    mov.grupos[0].medicoes[0].classificacaoSC = 'SC1';
    const html = htmlRomaneioRemetido(mov, null);
    expect(html).toContain('Classificação da sucata');
    expect(html).toContain('<small>SC1</small>');
  });

  it('escapa o que as pessoas digitam (sem injeção de HTML)', () => {
    const html = htmlRomaneioRemetido(
      movBase({ destino: '<script>alert(1)</script>', transportadora: 'A & B "Ltda"' }),
      null,
    );
    // O destino sai padronizado em MAIÚSCULAS e, de qualquer forma, escapado.
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<SCRIPT>');
    expect(html).toContain('&lt;SCRIPT&gt;ALERT(1)&lt;/SCRIPT&gt;');
    expect(html).toContain('A &amp; B &quot;Ltda&quot;');
  });

  it('botões usam script com nonce, nunca onclick inline (o CSP bloqueia onclick)', () => {
    const html = htmlRomaneioRecebimento(movBase(), 'nonce-xyz');
    expect(html).toContain('<script nonce="nonce-xyz">');
    expect(html).not.toMatch(/onclick\s*=/i);
    expect(html).toContain('id="btn-imprimir"');
    expect(html).toContain('window.print()');
  });

  it('mostra origem e destino padronizados, mesmo em registros antigos com grafia diferente', () => {
    expect(htmlRomaneioRecebimento(movBase({ origem: ' Ponta  grossa ' }), null)).toContain('PONTA GROSSA');
    expect(htmlRomaneioRemetido(movBase({ destino: 'ponta Grossa' }), null)).toContain('PONTA GROSSA');
  });

  it('reemprego mostra a classificação G1/G2/G3 ao lado do material', () => {
    const mov = movBase();
    mov.grupos[0].tipoMaterial = 'REEMPREGO';
    mov.grupos[0].classificacao = 'G2';
    expect(htmlRomaneioRecebimento(mov, null)).toContain('REEMPREGO G2');
    expect(htmlRomaneioRemetido(mov, null)).toContain('REEMPREGO G2');
  });

  it('Diversos (TOCO) não tem medição: mostra "-" em barras e metros', () => {
    const mov = movBase();
    mov.grupos[0] = { ...mov.grupos[0], perfil: 'TOCO', tipoMaterial: 'SUCATA', medicoes: [], metrosTotal: new Decimal('0') };
    const html = htmlRomaneioRemetido(mov, null);
    expect(html).toContain('TOCO');
    expect(html).toContain('Diversos — sem medição');
    expect(html).toContain('<td class="n">-</td>');
  });

  it('não tem área de assinaturas (Pátio/Administrativo)', () => {
    for (const html of [htmlRomaneioRecebimento(movBase(), null), htmlRomaneioRemetido(movBase(), null)]) {
      expect(html).not.toContain('signature');
      expect(html).not.toContain('Responsável Pátio');
      expect(html).not.toContain('Administrativo');
    }
  });

  it('sem nonce não emite script', () => {
    expect(htmlRomaneioRecebimento(movBase(), null)).not.toContain('<script');
  });

  it('escaparHtml cobre os cinco caracteres perigosos', () => {
    expect(escaparHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
    expect(escaparHtml(null)).toBe('');
  });
});
