import { PaginaPdf, A4, montarPdf, quebrarLinhas } from '@/lib/pdf/simples';
import { formatarCpf, formatarTelefone } from '@/lib/domain/portaria';
import { normalizarLocal } from '@/lib/domain/local';

export interface FichaPortaria {
  /** De que lado a ficha é: o que sai do pátio (Remetido) ou o que chega (Recebimento). */
  modulo: 'REMETIDO' | 'RECEBIMENTO';
  /** Situação em texto e se é uma situação "boa" (verde) ou de espera (laranja). */
  situacao: { rotulo: string; ok: boolean };
  destino: string | null;
  origem: string | null;
  reservaPedido: string | null;
  numeroDocumento: string | null;
  tipoRemetido: string | null;
  materialPrevisto: string | null;
  transportadora: string | null;
  motoristaNome: string | null;
  motoristaCpf: string | null;
  motoristaTelefone: string | null;
  placaCarreta: string | null;
  placaCavalo: string | null;
  capacidadeCarga: number | null;
  carretaLiberadaEm: Date | null;
  carretaLiberadaPor: string | null;
}

const TIPO: Record<string, string> = { VENDA: 'Venda', TRANS: 'Transferência', INDUS: 'Industrialização' };
const AZUL: [number, number, number] = [0.07, 0.15, 0.3];
const CINZA: [number, number, number] = [0.42, 0.45, 0.5];

function dataHora(d: Date): string {
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Ficha de 1 página com o que a Portaria preencheu, para mandar junto com a foto da carreta no
 * WhatsApp. Só traz dados da portaria — nunca medições.
 */
export function gerarFichaPortariaPdf(f: FichaPortaria, emitidoEm: Date = new Date()): Buffer {
  const p = new PaginaPdf();
  const m = 40;
  const largura = A4.largura - m * 2;

  p.retangulo(0, A4.altura - 78, A4.largura, 78, AZUL);
  p.texto(`CONTROLE DE TRILHOS  \u2022  ${f.modulo === 'REMETIDO' ? 'REMETIDO' : 'RECEBIMENTO'}`, m, A4.altura - 36, 11, 'negrito', [0.75, 0.82, 0.95]);
  p.texto('Ficha da Portaria', m, A4.altura - 62, 24, 'negrito', [1, 1, 1]);

  let y = A4.altura - 78 - 36;
  p.texto(f.situacao.rotulo.toUpperCase(), m, y, 13, 'negrito', f.situacao.ok ? [0.05, 0.5, 0.25] : [0.7, 0.45, 0.05]);
  if (f.carretaLiberadaEm) {
    const quem = f.carretaLiberadaPor ? ` por ${f.carretaLiberadaPor}` : '';
    p.texto(`Liberada em ${dataHora(f.carretaLiberadaEm)}${quem}`, m, y - 16, 10, 'normal', CINZA);
    y -= 16;
  }
  y -= 14;
  p.linha(m, y, m + largura, y);
  y -= 8;

  const coluna = largura / 2 - 8;
  const campos: Array<[string, string | null, boolean?]> = [
    ['Placa da carreta', f.placaCarreta, true],
    ['Placa do cavalo', f.placaCavalo, true],
    ['Empresa (transportadora)', f.transportadora],
    ['Motorista', f.motoristaNome],
    ['CPF do motorista', f.motoristaCpf ? formatarCpf(f.motoristaCpf) : null],
    ['Telefone do motorista', f.motoristaTelefone ? formatarTelefone(f.motoristaTelefone) : null],
    ['Capacidade de carga', f.capacidadeCarga != null ? `${f.capacidadeCarga.toLocaleString('pt-BR')} t` : null],
    ['Material', f.materialPrevisto],
    ['Origem', f.origem ? normalizarLocal(f.origem) : null],
    ...(f.modulo === 'REMETIDO'
      ? ([
          ['Destino', f.destino ? normalizarLocal(f.destino) : null],
          ['Reserva / pedido', f.reservaPedido],
          ['Nota fiscal', f.numeroDocumento],
          ['Tipo de remetido', f.tipoRemetido ? (TIPO[f.tipoRemetido] ?? f.tipoRemetido) : null],
        ] as Array<[string, string | null]>)
      : []),
  ];

  for (let i = 0; i < campos.length; i += 2) {
    const par = campos.slice(i, i + 2);
    const linhasPar = par.map(([, valor, destaque]) =>
      quebrarLinhas(valor || '—', destaque ? 20 : 13, coluna, 'negrito'),
    );
    const altura = 12 + Math.max(...linhasPar.map((l, k) => l.length * (par[k][2] ? 24 : 17))) + 12;
    par.forEach(([rotulo, valor, destaque], k) => {
      const x = m + k * (coluna + 16);
      p.texto(rotulo.toUpperCase(), x, y - 14, 8, 'normal', CINZA);
      linhasPar[k].forEach((linha, n) =>
        p.texto(linha, x, y - 34 - n * (destaque ? 24 : 17) + (destaque ? 0 : 3), destaque ? 20 : 13, 'negrito', valor ? [0.1, 0.12, 0.16] : [0.6, 0.62, 0.66]),
      );
    });
    y -= altura + 14;
    p.linha(m, y, m + largura, y, [0.9, 0.91, 0.93]);
    y -= 6;
  }

  p.texto(`Emitido em ${dataHora(emitidoEm)}`, m, 34, 9, 'normal', CINZA);
  return montarPdf(p, 'Ficha da Portaria');
}

export function nomeArquivoFicha(f: Pick<FichaPortaria, 'placaCarreta' | 'placaCavalo'>): string {
  const placa = (f.placaCarreta ?? f.placaCavalo ?? '').replace(/[^A-Z0-9]/gi, '');
  return placa ? `ficha-portaria-${placa}.pdf` : 'ficha-portaria.pdf';
}
