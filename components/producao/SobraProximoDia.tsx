import { TrilhoTls } from '@/components/producao/TrilhoTls';

// Cartão do TLS que fica aberto para o próximo dia de trabalho.
// Mostra o trilho em montagem e, embaixo, uma régua que separa o que já foi soldado do que falta,
// para ficar claro que o número são soldas já feitas nesse TLS (e não soldas "sobrando").

// Mesma geometria do TrilhoTls: a barra nasce em 6,5, cada barra tem 20 e a ponta tem 2 de folga.
const INICIO = 6.5;
const PASSO = 20;

/** quando: 'amanhã' ou o nome do próximo dia útil ('segunda', 'terça'...). */
export function SobraProximoDia({ feitas, total, quando }: { feitas: number; total: number; quando: string }) {
  const faltam = total - feitas;
  const largura = INICIO + (total + 1) * PASSO + 2;
  const pctFeito = ((INICIO + (feitas + 1) * PASSO) / largura) * 100;
  const noDia = quando === 'amanhã' ? 'amanhã' : `na ${quando}`;

  return (
    <div className="doc-indicador card space-y-1 p-4">
      <p className="doc-rotulo kv-label">Continua {noDia}</p>
      {feitas === 0 ? (
        <>
          <p className="doc-valor text-2xl font-semibold tabular-nums">0</p>
          <p className="doc-detalhe text-xs text-ink-muted">nenhum TLS em aberto: {noDia} começa do zero</p>
        </>
      ) : (
        <>
          <p className="doc-valor text-2xl font-semibold tabular-nums">
            {feitas} <span className="text-sm font-normal text-ink-muted">de {total} soldas</span>
          </p>
          <div className="sobra-trilho">
            <TrilhoTls feitas={feitas} total={total} />
            <div className="sobra-regua" aria-hidden="true">
              <span className="sobra-regua-feito" style={{ width: `${pctFeito}%` }} />
              <span className="sobra-regua-falta" />
            </div>
            <div className="sobra-legenda">
              <span className="sobra-legenda-feito">{feitas} {feitas === 1 ? 'feita' : 'feitas'} hoje</span>
              <span>faltam {faltam}</span>
            </div>
          </div>
          <p className="doc-detalhe text-xs text-ink-muted">
            {noDia.charAt(0).toUpperCase() + noDia.slice(1)} o TLS fecha com mais {faltam} {faltam === 1 ? 'solda' : 'soldas'}
          </p>
        </>
      )}
    </div>
  );
}
