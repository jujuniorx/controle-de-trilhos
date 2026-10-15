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

import { fmtMetros, fmtPeso } from '@/lib/format';
import { pecasDoGrupo } from '@/lib/domain/regras';

export interface MedicaoRomaneio {
  quantidade: number;
  comprimento: unknown;
  metros: unknown;
  classificacaoSC?: string | null;
}

export interface GrupoRomaneio {
  perfil: string;
  tipoMaterial: string;
  tampao?: boolean | null;
  metrosTotal: unknown;
  pesoCalculado?: unknown;
  pesoInformado?: unknown;
  medicoes: MedicaoRomaneio[];
}

export interface MovimentacaoRomaneio {
  id: string;
  numeroDocumento: string | null;
  origem: string | null;
  destino: string | null;
  reservaPedido: string | null;
  tipoTransporte: string;
  transportadora: string | null;
  placaCavalo: string | null;
  placaCarreta: string | null;
  placaCarreta2: string | null;
  responsavelPatio: string | null;
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
  return grupos
    .map((g, i) => {
      const comClassificacao = remetido && g.tipoMaterial === 'SUCATA';
      const linhas = g.medicoes
        .map((m, k) => {
          const descricao =
            m.quantidade > 1
              ? `${m.quantidade} × ${fmtMetros(m.comprimento)} m`
              : `${fmtMetros(m.comprimento)} m`;
          return `
            <tr>
              <td>${k + 1}. ${descricao}</td>
              <td>${fmtMetros(m.metros)}</td>
              ${comClassificacao ? `<td>${texto(m.classificacaoSC)}</td>` : ''}
            </tr>`;
        })
        .join('');
      const tampao = remetido && g.tampao ? ' (Tampão)' : '';
      return `
        <div class="grupo">
          <div class="grupo-header">Grupo ${i + 1} — ${texto(g.perfil)} — ${texto(g.tipoMaterial)}${tampao}</div>
          <table class="medicoes-table">
            <thead>
              <tr>
                <th style="width: ${comClassificacao ? '50%' : '60%'}">Medição</th>
                <th style="width: ${comClassificacao ? '25%' : '40%'}">Metros</th>
                ${comClassificacao ? '<th style="width: 25%">Classificação</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${linhas}
              <tr class="subtotal">
                <td>SUBTOTAL - ${texto(g.perfil)}</td>
                <td>${fmtMetros(g.metrosTotal)}</td>
                ${comClassificacao ? '<td></td>' : ''}
              </tr>
            </tbody>
          </table>
        </div>`;
    })
    .join('');
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
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5cm; margin-bottom: 0.8cm; font-size: 11px; }
  .info-item { border: 1px solid #ddd; padding: 0.3cm; }
  .info-label { font-weight: bold; font-size: 9px; color: #666; text-transform: uppercase; }
  .info-value { font-size: 11px; margin-top: 0.1cm; word-break: break-word; }
  .section-title { font-weight: bold; font-size: 12px; margin-top: 0.6cm; margin-bottom: 0.3cm; border-bottom: 1px solid #000; padding-bottom: 0.2cm; text-transform: uppercase; }
  .grupo { break-inside: avoid; }
  .grupo-header { font-weight: bold; background: #f0f0f0; padding: 0.3cm; margin-top: 0.4cm; }
  .medicoes-table { width: 100%; border-collapse: collapse; margin-bottom: 0.8cm; font-size: 10px; }
  .medicoes-table th { background: #f5f5f5; border: 1px solid #999; padding: 0.2cm; text-align: left; font-weight: bold; font-size: 9px; }
  .medicoes-table td { border: 1px solid #999; padding: 0.2cm; text-align: right; }
  .medicoes-table td:first-child { text-align: left; }
  .medicoes-table tr:nth-child(even) { background: #f9f9f9; }
  .medicoes-table tr.subtotal { font-weight: bold; background: #e8e8e8; }
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
    titulo: mov.numeroDocumento ? `NF ${mov.numeroDocumento}` : `Recebimento ${mov.id}`,
    cabecalho: 'ROMANEIO DE RECEBIMENTO',
    subtitulo: mov.numeroDocumento ? `NF ${mov.numeroDocumento}` : '',
    infos: [
      ['Origem', mov.origem],
      ['Tipo de Transporte', mov.tipoTransporte],
      ['Data', fmtData(mov.dataMovimentacao)],
      ['Responsável (Pátio)', mov.responsavelPatio],
      ['Cavalo', mov.placaCavalo],
      ['Carreta(s)', carretas(mov)],
    ],
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
    titulo: mov.numeroDocumento ? `NF ${mov.numeroDocumento}` : `Remetido ${mov.id}`,
    cabecalho: 'ROMANEIO DE REMETIDO',
    subtitulo: mov.numeroDocumento ? `NF ${mov.numeroDocumento}` : '',
    infos: [
      ['Tipo de Remetido', tipo ? (TIPO_REMETIDO_LABEL[tipo] ?? tipo) : 'Em aberto'],
      ['Reserva/Pedido', mov.reservaPedido],
      ['Destino', mov.destino],
      ['Data', fmtData(mov.dataMovimentacao)],
      ['Responsável (Pátio)', mov.responsavelPatio],
      ['Transportadora', mov.transportadora],
      ['Cavalo', mov.placaCavalo],
      ['Carreta(s)', carretas(mov)],
    ],
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
