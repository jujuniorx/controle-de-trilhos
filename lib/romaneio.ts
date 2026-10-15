// HTML imprimível do romaneio (Recebimento e Remetido).
//
// Funções puras — sem banco, sem React — para poderem ser testadas com dados em memória.
// Servido por route handlers (app/admin/.../romaneio/route.ts) como um documento HTML
// completo, sem o layout do painel, pronto para imprimir.
//
// Cuidados que valem para este arquivo:
//  - Valores vindos do banco (destino, transportadora, placas...) são digitados por
//    pessoas: SEMPRE passam por escaparHtml/texto antes de entrar no HTML.
//  - Decimal do Prisma NÃO precisa de conversão aqui: fmtMetros/fmtPeso/Number()
//    aceitam Decimal. (Converter objetos recursivamente destruía Date → {}.)
//  - O middleware aplica um CSP estrito (sem 'unsafe-inline' em script-src), então
//    atributos inline como onclick="..." são bloqueados. Os botões usam um <script>
//    com o nonce da requisição (cabeçalho x-nonce definido em middleware.ts).

import { rotuloNfs } from '@/lib/nf';
import { fmtMetros, fmtPeso } from '@/lib/format';
import { pecasDoGrupo } from '@/lib/domain/regras';
import { normalizarLocal } from '@/lib/domain/local';

export interface MedicaoRomaneio {
  quantidade: number;
  comprimento: unknown;
  metros: unknown;
  classificacaoSC?: string | null;
}

export interface GrupoRomaneio {
  perfil: string;
  tipoMaterial: string;
  /** G1, G2 ou G3 — só no Reemprego. */
  classificacao?: string | null;
  tampao?: boolean | null;
  metrosTotal: unknown;
  pesoCalculado?: unknown;
  pesoInformado?: unknown;
  medicoes: MedicaoRomaneio[];
}

export interface MovimentacaoRomaneio {
  id: string;
  numeroDocumento: string | null;
  numerosDocumentoExtras?: string[];
  origem: string | null;
  destino: string | null;
  reservaPedido: string | null;
  tipoTransporte: string;
  transportadora: string | null;
  placaCavalo: string | null;
  placaCarreta: string | null;
  placaCarreta2: string | null;
  responsavelPatio: string | null;
  observacao?: string | null;
  dataMovimentacao: Date | null;
  status: string;
  grupos: GrupoRomaneio[];
  remetidoDetalhe?: { tipoRemetido: string | null } | null;
}

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

export function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Texto escapado, ou "—" quando vazio. */
function texto(valor: unknown): string {
  const t = valor == null ? '' : String(valor).trim();
  return t ? escaparHtml(t) : '—';
}

function fmtData(d: Date | null | undefined): string {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

function renderGrupos(grupos: GrupoRomaneio[], remetido: boolean): string {
  // Uma tabela só, uma linha por grupo: as medições ficam lado a lado na mesma linha,
  // então o romaneio fica compacto e alinhado, não importa quantas medições cada grupo tenha.
  const linhas = grupos
    .map((g, i) => {
      const comClassificacao = remetido && g.tipoMaterial === 'SUCATA';
      const medidas = g.medicoes
        .map((m) => {
          const valor =
            m.quantidade > 1
              ? `${m.quantidade}×${fmtMetros(m.comprimento)}`
              : fmtMetros(m.comprimento);
          const sc = comClassificacao && m.classificacaoSC ? ` <small>${escaparHtml(m.classificacaoSC)}</small>` : '';
          return `<span class="chip">${valor}${sc}</span>`;
        })
        .join('');
      const tampao = remetido && g.tampao ? ' (Tampão)' : '';
      // Reemprego mostra a classificação ao lado do material: REEMPREGO G1 / G2 / G3.
      const material =
        g.tipoMaterial === 'REEMPREGO' && g.classificacao
          ? `${texto(g.tipoMaterial)} ${escaparHtml(g.classificacao)}`
          : texto(g.tipoMaterial);
      // Diversos (TOCO): sem medição — só o peso, informado depois da pesagem.
      const diversos = g.perfil === 'TOCO';
      return `
            <tr>
              <td class="c">${i + 1}</td>
              <td>${texto(g.perfil)}${tampao}</td>
              <td>${material}</td>
              <td class="medidas">${diversos ? '<span class="nota">Diversos — sem medição, só o peso (pesagem)</span>' : medidas}</td>
              <td class="n">${diversos ? '-' : pecasDoGrupo(g.medicoes)}</td>
              <td class="n">${diversos ? '-' : fmtMetros(g.metrosTotal)}</td>
            </tr>`;
    })
    .join('');
  const nota =
    remetido && grupos.some((g) => g.tipoMaterial === 'SUCATA')
      ? '<div class="nota">Classificação da sucata (SC1, SC2, SC3 ou Diversos) ao lado de cada medição. N×M = N barras de M metros.</div>'
      : '<div class="nota">N×M = N barras de M metros.</div>';
  return `
        <table class="grupos-table">
          <thead>
            <tr>
              <th style="width: 1.2cm">Grupo</th>
              <th style="width: 2.4cm">Perfil</th>
              <th style="width: 2.4cm">Material</th>
              <th>Medições (m)</th>
              <th style="width: 1.6cm">Barras</th>
              <th style="width: 2.2cm">Metros</th>
            </tr>
          </thead>
          <tbody>${linhas}
          </tbody>
        </table>
        ${nota}`;
}

function calcularTotais(grupos: GrupoRomaneio[], remetido: boolean) {
  const barras = grupos.reduce((acc, g) => acc + pecasDoGrupo(g.medicoes), 0);
  const metros = grupos.reduce((acc, g) => acc + Number(g.metrosTotal), 0);
  // Remetido: o peso informado (NF) vale mais que a estimativa; Recebimento usa só o calculado.
  const peso = grupos.reduce((acc, g) => acc + Number((remetido ? (g.pesoInformado ?? g.pesoCalculado) : g.pesoCalculado) ?? 0), 0);
  return { barras, metros, peso };
}

const ESTILO = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; color: #000; background: #fff; }
  .container { width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 1.5cm; background: #fff; }
  .acoes { margin: 1cm; display: flex; gap: 0.5cm; }
  .btn { padding: 0.5cm 1cm; background: #333; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; }
  .btn:hover { background: #555; }
  .header { text-align: center; margin-bottom: 1cm; border-bottom: 2px solid #000; padding-bottom: 0.5cm; }
  .header-title { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
  .header-sub { font-size: 10px; margin-top: 0.2cm; }
  .obs { margin: -0.3cm 0 0.6cm; padding: 0.2cm 0.3cm; border: 1px solid #999; font-size: 11px; white-space: pre-wrap; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5cm; margin-bottom: 0.8cm; font-size: 11px; }
  .info-item { border: 1px solid #ddd; padding: 0.3cm; }
  .info-label { font-weight: bold; font-size: 9px; color: #666; text-transform: uppercase; }
  .info-value { font-size: 11px; margin-top: 0.1cm; word-break: break-word; }
  .section-title { font-weight: bold; font-size: 12px; margin-top: 0.6cm; margin-bottom: 0.3cm; border-bottom: 1px solid #000; padding-bottom: 0.2cm; text-transform: uppercase; }
  .grupos-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .grupos-table thead { display: table-header-group; }
  .grupos-table th { background: #f0f0f0; border: 1px solid #999; padding: 0.2cm; text-align: left; font-size: 9px; text-transform: uppercase; }
  .grupos-table td { border: 1px solid #999; padding: 0.2cm; vertical-align: top; }
  .grupos-table tr { break-inside: avoid; }
  .grupos-table tbody tr:nth-child(even) { background: #f9f9f9; }
  .grupos-table td.c { text-align: center; }
  .grupos-table td.n { text-align: right; white-space: nowrap; font-weight: bold; }
  .grupos-table td.medidas { line-height: 1.9; }
  .chip { display: inline-block; border: 1px solid #bbb; border-radius: 3px; padding: 0 0.15cm; margin: 0 0.15cm 0 0; line-height: 1.5; white-space: nowrap; background: #fff; font-size: 10px; }
  .chip small { font-size: 8px; font-weight: bold; color: #444; }
  .nota { font-size: 9px; color: #666; margin-top: 0.2cm; }
  .totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4cm; margin-bottom: 1cm; break-inside: avoid; }
  .total-item { border: 2px solid #000; padding: 0.4cm; text-align: center; }
  .total-label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #666; }
  .total-value { font-size: 16px; font-weight: bold; margin-top: 0.2cm; }
  .total-value.pequeno { font-size: 12px; }
  /* Por último, para vencer as regras acima: nada de botões na impressão. */
  @media print {
    @page { size: A4; margin: 0; }
    .acoes { display: none; }
    .container { width: auto; min-height: 0; margin: 0; padding: 1cm; }
  }
`;

interface OpcoesDocumento {
  titulo: string;
  cabecalho: string;
  subtitulo: string;
  infos: Array<[string, unknown]>;
  observacao?: string | null;
  tituloMateriais: string;
  tituloTotais: string;
  grupos: string;
  totais: Array<[string, string, boolean]>;
  nonce: string | null;
}

function documento(o: OpcoesDocumento): string {
  const infos = o.infos
    .map(([rotulo, valor]) => `
      <div class="info-item">
        <div class="info-label">${escaparHtml(rotulo)}</div>
        <div class="info-value">${texto(valor)}</div>
      </div>`)
    .join('');
  const totais = o.totais
    .map(([rotulo, valor, pequeno]) => `
      <div class="total-item">
        <div class="total-label">${escaparHtml(rotulo)}</div>
        <div class="total-value${pequeno ? ' pequeno' : ''}">${escaparHtml(valor)}</div>
      </div>`)
    .join('');
  // Sem nonce o CSP bloquearia o script de qualquer forma; os botões só funcionam com ele.
  const script = o.nonce
    ? `<script nonce="${escaparHtml(o.nonce)}">
  document.getElementById('btn-imprimir').addEventListener('click', function () { window.print(); });
  document.getElementById('btn-voltar').addEventListener('click', function () {
    if (window.history.length > 1) { window.history.back(); } else { window.close(); }
  });
</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Romaneio - ${escaparHtml(o.titulo)}</title>
  <style>${ESTILO}</style>
</head>
<body>
  <div class="acoes">
    <button type="button" class="btn" id="btn-imprimir">🖨️ Imprimir</button>
    <button type="button" class="btn" id="btn-voltar">← Voltar</button>
  </div>

  <div class="container">
    <div class="header">
      <div class="header-title">${escaparHtml(o.cabecalho)}</div>
      <div class="header-sub">${escaparHtml(o.subtitulo)}</div>
    </div>

    <div class="info-grid">${infos}</div>
    ${o.observacao ? `<div class="obs"><b>Observação:</b> ${escaparHtml(o.observacao)}</div>` : ''}

    <div class="section-title">${escaparHtml(o.tituloMateriais)}</div>
    ${o.grupos}

    <div class="section-title">${escaparHtml(o.tituloTotais)}</div>
    <div class="totals">${totais}</div>
  </div>
  ${script}
</body>
</html>`;
}

function carretas(mov: MovimentacaoRomaneio): string | null {
  return [mov.placaCarreta, mov.placaCarreta2].filter(Boolean).join(' / ') || null;
}

export function htmlRomaneioRecebimento(mov: MovimentacaoRomaneio, nonce: string | null): string {
  const t = calcularTotais(mov.grupos, false);
  return documento({
    titulo: rotuloNfs(mov) || `Recebimento ${mov.id}`,
    cabecalho: 'ROMANEIO DE RECEBIMENTO',
    subtitulo: rotuloNfs(mov),
    infos: [
      ['Origem', normalizarLocal(mov.origem)],
      ['Tipo de Transporte', mov.tipoTransporte],
      ['Data', fmtData(mov.dataMovimentacao)],
      ['Responsável (Pátio)', mov.responsavelPatio],
      ['Cavalo', mov.placaCavalo],
      ['Carreta(s)', carretas(mov)],
    ],
    observacao: mov.observacao,
    tituloMateriais: 'Materiais Recebidos',
    tituloTotais: 'Totais do Recebimento',
    grupos: renderGrupos(mov.grupos, false),
    totais: [
      ['Barras', String(t.barras), false],
      ['Metros', fmtMetros(t.metros), false],
      ['Peso (t)', fmtPeso(t.peso), false],
      ['Status', mov.status.replace(/_/g, ' '), true],
    ],
    nonce,
  });
}

export function htmlRomaneioRemetido(mov: MovimentacaoRomaneio, nonce: string | null): string {
  const t = calcularTotais(mov.grupos, true);
  const tipo = mov.remetidoDetalhe?.tipoRemetido;
  return documento({
    titulo: rotuloNfs(mov) || `Remetido ${mov.id}`,
    cabecalho: 'ROMANEIO DE REMETIDO',
    subtitulo: rotuloNfs(mov),
    infos: [
      ['Tipo de Remetido', tipo ? (TIPO_REMETIDO_LABEL[tipo] ?? tipo) : 'Em aberto'],
      ['Reserva/Pedido', mov.reservaPedido],
      ['Destino', normalizarLocal(mov.destino)],
      ['Data', fmtData(mov.dataMovimentacao)],
      ['Responsável (Pátio)', mov.responsavelPatio],
      ['Transportadora', mov.transportadora],
      ['Cavalo', mov.placaCavalo],
      ['Carreta(s)', carretas(mov)],
    ],
    observacao: mov.observacao,
    tituloMateriais: 'Materiais Remetidos',
    tituloTotais: 'Totais do Remetido',
    grupos: renderGrupos(mov.grupos, true),
    totais: [
      ['Barras', String(t.barras), false],
      ['Metros', fmtMetros(t.metros), false],
      ['Peso (t)', fmtPeso(t.peso), false],
      ['Status', mov.status.replace(/_/g, ' '), true],
    ],
    nonce,
  });
}

/** Resposta HTML não cacheável (conteúdo autenticado). */
export function respostaHtml(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
}

export function paginaMensagem(mensagem: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Romaneio</title></head><body style="font-family: sans-serif; padding: 2rem"><p>${escaparHtml(mensagem)}</p></body></html>`;
}
