import { notFound } from 'next/navigation';
import { buscarRemetidoDetalhe } from '@/lib/services/remetido';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { fmtMetros, fmtPeso } from '@/lib/format';
import { pecasDoGrupo } from '@/lib/domain/regras';

function fmtData(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

// Converter Decimal do Prisma para número recursivamente
function convertDecimalToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'object') {
    if (obj.constructor.name === 'Decimal') {
      return parseFloat(obj.toString());
    }
    if (Array.isArray(obj)) {
      return obj.map(convertDecimalToNumber);
    }
    const converted: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        converted[key] = convertDecimalToNumber(obj[key]);
      }
    }
    return converted;
  }
  return obj;
}

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

export default async function RomaneioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  let mov;
  try {
    const movRaw = await buscarRemetidoDetalhe(id);
    mov = convertDecimalToNumber(movRaw) as typeof movRaw;
  } catch (err) {
    console.error('Erro ao buscar remetido para romaneio:', err);
    notFound();
  }

  if (!mov) notFound();

  const totalBarras = mov.grupos.reduce((acc, g) => acc + pecasDoGrupo(g.medicoes), 0);
  const totalMetros = mov.grupos.reduce((acc, g) => acc + Number(g.metrosTotal), 0);
  const totalPeso = mov.grupos.reduce((acc, g) => acc + Number(g.pesoInformado ?? g.pesoCalculado ?? 0), 0);

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Romaneio - {mov.numeroDocumento ? `NF ${mov.numeroDocumento}` : `Remetido ${mov.id}`}</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: #fff;
          }

          .container {
            width: 21cm;
            height: 29.7cm;
            margin: 0 auto;
            padding: 1.5cm;
            background: white;
            page-break-after: always;
          }

          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .container {
              margin: 0;
              width: auto;
              height: auto;
              padding: 0.8cm;
            }
            .no-print {
              display: none;
            }
          }

          .header {
            text-align: center;
            margin-bottom: 1cm;
            border-bottom: 2px solid #000;
            padding-bottom: 0.5cm;
          }

          .header-title {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 2px;
          }

          .header-sub {
            font-size: 10px;
            margin-top: 0.2cm;
          }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5cm;
            margin-bottom: 0.8cm;
            font-size: 11px;
          }

          .info-item {
            border: 1px solid #ddd;
            padding: 0.3cm;
          }

          .info-label {
            font-weight: bold;
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
          }

          .info-value {
            font-size: 11px;
            margin-top: 0.1cm;
            word-break: break-word;
          }

          .section-title {
            font-weight: bold;
            font-size: 12px;
            margin-top: 0.6cm;
            margin-bottom: 0.3cm;
            border-bottom: 1px solid #000;
            padding-bottom: 0.2cm;
            text-transform: uppercase;
          }

          .materiais-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0.8cm;
            font-size: 10px;
          }

          .materiais-table th {
            background: #f5f5f5;
            border: 1px solid #000;
            padding: 0.3cm;
            text-align: left;
            font-weight: bold;
            text-transform: uppercase;
          }

          .materiais-table td {
            border: 1px solid #000;
            padding: 0.3cm;
          }

          .materiais-table tr:nth-child(even) {
            background: #f9f9f9;
          }

          .medicoes-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0.8cm;
            font-size: 10px;
          }

          .medicoes-table th {
            background: #f5f5f5;
            border: 1px solid #999;
            padding: 0.2cm;
            text-align: left;
            font-weight: bold;
            font-size: 9px;
          }

          .medicoes-table td {
            border: 1px solid #999;
            padding: 0.2cm;
            text-align: right;
          }

          .medicoes-table td:first-child {
            text-align: left;
          }

          .medicoes-table tr:nth-child(even) {
            background: #f9f9f9;
          }

          .totals {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 0.4cm;
            margin-bottom: 1cm;
          }

          .total-item {
            border: 2px solid #000;
            padding: 0.4cm;
            text-align: center;
          }

          .total-label {
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
            color: #666;
          }

          .total-value {
            font-size: 16px;
            font-weight: bold;
            margin-top: 0.2cm;
          }

          .signature-area {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2cm;
            margin-top: 1.5cm;
            padding-top: 1cm;
            border-top: 1px solid #000;
          }

          .signature-block {
            text-align: center;
            font-size: 10px;
          }

          .signature-line {
            border-bottom: 1px solid #000;
            height: 1cm;
            margin-bottom: 0.2cm;
          }

          .signature-label {
            font-size: 9px;
            font-weight: bold;
          }

          .no-print {
            margin: 1cm;
            display: flex;
            gap: 0.5cm;
          }

          .btn {
            padding: 0.5cm 1cm;
            background: #333;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
          }

          .btn:hover {
            background: #555;
          }

          .grupo-header {
            font-weight: bold;
            background: #f0f0f0;
            padding: 0.3cm;
            margin-top: 0.4cm;
          }
        `}</style>
      </head>
      <body>
        <div className="no-print">
          <button className="btn" onClick={() => window.print()}>
            🖨️ Imprimir
          </button>
          <button className="btn" onClick={() => window.history.back()}>
            ← Voltar
          </button>
        </div>

        <div className="container">
          {/* Header */}
          <div className="header">
            <div className="header-title">ROMANEIO DE REMETIDO</div>
            <div className="header-sub">
              {mov.numeroDocumento && `NF ${mov.numeroDocumento}`}
            </div>
          </div>

          {/* Informações principais */}
          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">Tipo de Remetido</div>
              <div className="info-value">
                {TIPO_REMETIDO_LABEL[mov.remetidoDetalhe?.tipoRemetido ?? ''] ?? 'Em aberto'}
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">Reserva/Pedido</div>
              <div className="info-value">{mov.reservaPedido ?? '—'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Destino</div>
              <div className="info-value">{mov.destino}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Data</div>
              <div className="info-value">{fmtData(mov.dataMovimentacao)}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Responsável (Pátio)</div>
              <div className="info-value">{mov.responsavelPatio ?? '—'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Transportadora</div>
              <div className="info-value">{mov.transportadora ?? '—'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Cavalo</div>
              <div className="info-value">{mov.placaCavalo ?? '—'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Carreta(s)</div>
              <div className="info-value">{[mov.placaCarreta, mov.placaCarreta2].filter(Boolean).join(' / ') || '—'}</div>
            </div>
          </div>

          {/* Materiais */}
          <div className="section-title">Materiais Remetidos</div>
          {mov.grupos.map((g, i) => (
            <div key={g.id}>
              <div className="grupo-header">
                Grupo {i + 1} — {g.perfil} — {g.tipoMaterial}
                {g.tampao ? ' (Tampão)' : ''}
              </div>
              <table className="medicoes-table">
                <thead>
                  <tr>
                    <th style={{ width: '60%' }}>Medição</th>
                    <th style={{ width: '15%' }}>Metros</th>
                    {g.tipoMaterial === 'SUCATA' && <th style={{ width: '25%' }}>Classificação</th>}
                  </tr>
                </thead>
                <tbody>
                  {g.medicoes.map((m, k) => (
                    <tr key={m.id}>
                      <td>
                        {k + 1}. {m.quantidade > 1 ? `${m.quantidade} × ${fmtMetros(m.comprimento)} m` : `${fmtMetros(m.comprimento)} m`}
                      </td>
                      <td>{fmtMetros(m.metros)}</td>
                      {g.tipoMaterial === 'SUCATA' && <td>{m.classificacaoSC ?? '—'}</td>}
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 'bold', background: '#e8e8e8' }}>
                    <td>SUBTOTAL - {g.perfil}</td>
                    <td>{fmtMetros(g.metrosTotal)}</td>
                    {g.tipoMaterial === 'SUCATA' && <td></td>}
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* Totais */}
          <div className="section-title">Totais do Remetido</div>
          <div className="totals">
            <div className="total-item">
              <div className="total-label">Barras</div>
              <div className="total-value">{totalBarras}</div>
            </div>
            <div className="total-item">
              <div className="total-label">Metros</div>
              <div className="total-value">{fmtMetros(totalMetros)}</div>
            </div>
            <div className="total-item">
              <div className="total-label">Peso (t)</div>
              <div className="total-value">{fmtPeso(totalPeso)}</div>
            </div>
            <div className="total-item">
              <div className="total-label">Status</div>
              <div className="total-value" style={{ fontSize: '12px' }}>{mov.status}</div>
            </div>
          </div>

          {/* Assinaturas */}
          <div className="signature-area">
            <div className="signature-block">
              <div className="signature-line"></div>
              <div className="signature-label">Responsável Pátio</div>
            </div>
            <div className="signature-block">
              <div className="signature-line"></div>
              <div className="signature-label">Administrativo</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
