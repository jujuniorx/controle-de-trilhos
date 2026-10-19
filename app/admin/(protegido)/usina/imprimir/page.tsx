import {
  estaleiroDoPeriodo,
  geracaoDoPeriodo,
  composicoesDoPeriodo,
  caminhoesDoPeriodo,
  trilheirosDoPeriodo,
  ROTULO_TLS,
  TIPOS_TLS,
  META_GERACAO_MENSAL_M,
} from '@/lib/services/usina';
import { fmtMetros, fmtPeso } from '@/lib/format';
import { ehIsoValido, type Periodo } from '@/lib/usina/periodo';
import { ImprimirBotao } from '@/components/usina/ImprimirBotao';

export const dynamic = 'force-dynamic';

const SETORES = ['todos', 'estaleiro', 'geracao', 'composicoes', 'caminhao', 'trilheiros'] as const;
type Setor = (typeof SETORES)[number];

const br = (iso: string) => iso.split('-').reverse().join('/');

/** Acumulado do dia e do mês, mostrado logo abaixo do título de cada setor. */
function Acumulado({ dia, mes }: { dia: string; mes: string }) {
  return (
    <div className="rounded border border-black/30 px-3 py-2 text-sm">
      <p><b>Acumulado do dia:</b> {dia}</p>
      <p><b>Acumulado do mês:</b> {mes}</p>
    </div>
  );
}

function Tabela({ cab, linhas }: { cab: string[]; linhas: (string | number)[][] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>{cab.map((c) => <th key={c} className="border-b border-black/40 py-1 text-left">{c}</th>)}</tr>
      </thead>
      <tbody>
        {linhas.map((l, i) => (
          <tr key={i}>{l.map((v, j) => <td key={j} className="border-b border-black/10 py-1">{v}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function ImprimirUsina({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; data?: string; setor?: string }>;
}) {
  const params = await searchParams;
  const periodo: Periodo = params.periodo === 'semana' || params.periodo === 'mes' ? params.periodo : 'dia';
  const data = ehIsoValido(params.data) ? params.data : new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const setor: Setor = (SETORES as readonly string[]).includes(params.setor ?? '') ? (params.setor as Setor) : 'todos';
  const mostra = (s: Exclude<Setor, 'todos'>) => setor === 'todos' || setor === s;

  const [est, ger, comp, cam, tril, estDia, estMes, gerDia, gerMes, compDia, compMes, camDia, camMes, trilDia, trilMes] = await Promise.all([
    estaleiroDoPeriodo(periodo, data),
    geracaoDoPeriodo(periodo, data),
    composicoesDoPeriodo(periodo, data),
    caminhoesDoPeriodo(periodo, data),
    trilheirosDoPeriodo(periodo, data),
    estaleiroDoPeriodo('dia', data),
    estaleiroDoPeriodo('mes', data),
    geracaoDoPeriodo('dia', data),
    geracaoDoPeriodo('mes', data),
    composicoesDoPeriodo('dia', data),
    composicoesDoPeriodo('mes', data),
    caminhoesDoPeriodo('dia', data),
    caminhoesDoPeriodo('mes', data),
    trilheirosDoPeriodo('dia', data),
    trilheirosDoPeriodo('mes', data),
  ]);

  // Acumulados (dia e mês) de cada setor.
  const estTxt = (x: typeof estDia) =>
    `Soldas ${x.totais.soldas} · Cortes ${x.totais.cortes} · Tampões ${x.carreta.tampoes} · Trilho novo ${fmtMetros(x.carreta.trilhoNovoM)} m · Sucata ${fmtPeso(x.carreta.sucataT)} t`;
  const soma = <T,>(lista: T[], f: (x: T) => number) => lista.reduce((a, x) => a + f(x), 0);
  const gerDiaTxt = `Corte ${fmtMetros(soma(gerDia.porLider, (l) => l.periodo.corteM))} m · Carregado ${fmtMetros(soma(gerDia.porLider, (l) => l.periodo.carregamentoM))} m · Deixado na via ${fmtMetros(soma(gerDia.porLider, (l) => l.periodo.deixadaViaM))} m · Barras ${soma(gerDia.porLider, (l) => l.periodo.quantidade)}`;
  const gerMesTotal = soma(gerMes.porLider, (l) => l.mes.totalM);
  const gerMesTxt = `Carregado + deixado ${fmtMetros(gerMesTotal)} m (meta ${fmtMetros(META_GERACAO_MENSAL_M)} m${gerMesTotal >= META_GERACAO_MENSAL_M ? ', alcançada' : ''})`;
  const compTxt = (lista: typeof compDia) => lista.map((c) => `${c.ativo}: ${c.barras} barras · ${c.jacares} jacarés`).join(' · ');
  const camTxt = (lista: typeof camDia) => `Produção ${soma(lista, (c) => c.periodo.producao)} · Perda ${soma(lista, (c) => c.periodo.perda)}`;
  const camMesTxt = (lista: typeof camMes) => `Produção ${soma(lista, (c) => c.mes.producao)} · Perda ${soma(lista, (c) => c.mes.perda)}`;

  const titulo = setor === 'todos' ? 'Relatório da usina — todos os setores' : 'Relatório da usina';
  const periodoTxt = est.inicio === est.fim ? br(est.inicio) : `${br(est.inicio)} a ${br(est.fim)}`;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #relatorio-usina, #relatorio-usina * { visibility: visible; }
          #relatorio-usina { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .sem-impressao { display: none !important; }
          h2 { break-after: avoid; }
          section { break-inside: avoid-page; }
        }
      `}</style>

      <div className="sem-impressao mb-4 flex flex-wrap gap-3">
        <ImprimirBotao />
        <a className="btn btn-ghost h-11" href={`/admin/usina?periodo=${periodo}&data=${data}`}>Voltar</a>
        <span className="self-center text-sm text-ink-muted">Setor: {setor === 'todos' ? 'todos' : setor} · {periodoTxt}</span>
      </div>

      <article id="relatorio-usina" className="space-y-6 text-black bg-white p-4">
        <header>
          <h1 className="text-xl font-bold">{titulo}</h1>
          <p className="text-sm">Período: {periodoTxt}</p>
        </header>

        {mostra('estaleiro') && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Estaleiro de solda</h2>
            <Acumulado dia={estTxt(estDia)} mes={estTxt(estMes)} />
            <p className="text-sm">Soldas: {est.totais.soldas} · Cortes: {est.totais.cortes} · Tampões carregados: {est.carreta.tampoes} · Trilho novo: {fmtMetros(est.carreta.trilhoNovoM)} m · Sucata saída: {fmtPeso(est.carreta.sucataT)} t</p>
            <p className="text-sm">Manutenção da semana: {br(est.manutencaoDia)}</p>
            <Tabela
              cab={['Estoque de TLS (em ' + br(data) + ')', 'Quantidade']}
              linhas={TIPOS_TLS.map((t) => [ROTULO_TLS[t], est.estoqueDoDia[t] ?? '—'])}
            />
            {est.escala && <p className="whitespace-pre-line text-sm"><b>Escala:</b> {est.escala}</p>}
          </section>
        )}

        {mostra('geracao') && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Geração de trilho</h2>
            <Acumulado dia={gerDiaTxt} mes={gerMesTxt} />
            <Tabela
              cab={['Líder', 'Corte (m)', 'Carregamento (m)', 'Barras', 'Deixada na via (m)', 'Mês: carregado + deixado (m)', 'Meta 5.000 m']}
              linhas={ger.porLider.map((l) => [
                l.rotulo,
                fmtMetros(l.periodo.corteM),
                fmtMetros(l.periodo.carregamentoM),
                l.periodo.quantidade,
                fmtMetros(l.periodo.deixadaViaM),
                fmtMetros(l.mes.totalM),
                l.mes.metaAlcancada ? 'Alcançada' : 'Não alcançada',
              ])}
            />
          </section>
        )}

        {mostra('composicoes') && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Composições ativas</h2>
            <Acumulado dia={compTxt(compDia)} mes={compTxt(compMes)} />
            <Tabela cab={['Composição', 'Barras', 'Jacarés']} linhas={comp.map((c) => [c.ativo, c.barras, c.jacares])} />
          </section>
        )}

        {mostra('caminhao') && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Caminhão de solda</h2>
            <Acumulado dia={camTxt(camDia)} mes={camMesTxt(camMes)} />
            <Tabela
              cab={['Caminhão', 'Produção (período)', 'Perda (período)', 'Produção (mês)', 'Perda (mês)', 'Produção (ano)', 'Perda (ano)']}
              linhas={cam.map((c) => [c.caminhao, c.periodo.producao, c.periodo.perda, c.mes.producao, c.mes.perda, c.ano.producao, c.ano.perda])}
            />
            <p className="text-xs">CW03 entra em breve.</p>
          </section>
        )}

        {mostra('trilheiros') && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Trilheiros</h2>
            <Acumulado dia={`Giros: ${trilDia.giros.length}`} mes={`Giros: ${trilMes.giros.length}`} />
            <p className="text-sm">Média de dias úteis na usina: {tril.mediaDiasUteisNaUsina ?? '—'} (em {tril.girosComTempo} giro(s) com datas completas)</p>
            <Tabela
              cab={['Trilheiro', 'B.O.', 'Chegada', 'Partida', 'Retorno', 'Perfil', 'Carregados', 'Descarregados', 'Local']}
              linhas={tril.giros.map((g) => [
                g.trilheiro,
                g.boEm ? br(g.boEm.toISOString().slice(0, 10)) : '—',
                g.chegadaUsinaEm ? br(g.chegadaUsinaEm.toISOString().slice(0, 10)) : '—',
                g.partidaEm ? br(g.partidaEm.toISOString().slice(0, 10)) : '—',
                g.retornoEm ? br(g.retornoEm.toISOString().slice(0, 10)) : '—',
                g.perfil ? ROTULO_TLS[g.perfil] : '—',
                g.carregados,
                g.descarregados,
                g.local ?? '—',
              ])}
            />
            {tril.manutencoes.length > 0 && (
              <ul className="text-sm">
                {tril.manutencoes.map((m) => (
                  <li key={m.id}>{br(m.data.toISOString().slice(0, 10))} · {m.trilheiro} · {m.tipo ?? 'Manutenção'}{m.detalhamento ? ` — ${m.detalhamento}` : ''}</li>
                ))}
              </ul>
            )}
          </section>
        )}
      </article>
    </>
  );
}
