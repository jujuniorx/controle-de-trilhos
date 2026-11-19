import Link from 'next/link';
import { resumoGeralEstoque, type MaterialEstoque, type ResumoAreaEstoque } from '@/lib/services/estoqueAreas';
import {
  AREA_ALMOXARIFADO,
  AREA_METROLOGIA,
  AREA_OLEO,
  AREA_TRILHOS,
  escalaMetros,
  fmtNum,
  gomosAcesos,
  precisaRepor,
  situacaoNivel,
} from '@/lib/domain/estoque';
import { Kpi, ListaMovimentos } from './comum';

const t1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function rotuloDia(dia: string, hoje: boolean): string {
  if (hoje) return 'Hoje';
  const d = new Date(`${dia}T12:00:00Z`);
  return `${SEMANA[d.getUTCDay()]} ${dia.slice(8, 10)}`;
}
const baixo = (m: MaterialEstoque) => precisaRepor(situacaoNivel(m.quantidade, m.minimo)) && (m.minimo ?? 0) > 0;

function Pilula({ area }: { area: ResumoAreaEstoque }) {
  if (area.calibracao.vencidas) return <span className="est-pilula est-pilula-err">{area.calibracao.vencidas} vencida{area.calibracao.vencidas > 1 ? 's' : ''}</span>;
  if (area.abaixo) return <span className="est-pilula">{area.abaixo} abaixo</span>;
  return null;
}

/** Desenho de cada sala na planta, conforme o que ela guarda. */
function MiniVisual({ area }: { area: ResumoAreaEstoque }) {
  const lista = area.materiais;
  if (lista.length === 0) return <p className="text-sm text-ink-muted">Nada cadastrado ainda.</p>;
  if (area.id === AREA_TRILHOS) {
    const perfis = lista.filter((m) => m.categoria === 'PERFIL').sort((a, b) => b.quantidade - a.quantidade).slice(0, 5);
    if (perfis.length === 0) return <p className="text-sm text-ink-muted">{lista.length} itens (talas e barras lisas).</p>;
    const escala = escalaMetros(perfis.flatMap((m) => [m.quantidade, m.minimo ?? 0]));
    return (
      <div className="flex flex-1 flex-col justify-center gap-3">
        {perfis.map((m) => (
          <div key={m.id} className="grid grid-cols-[52px_minmax(0,1fr)_76px] items-center gap-2.5">
            <span className="est-patio-perfil !text-lg">{m.perfil}</span>
            <span className="est-pista !h-[22px]">
              <span className={`est-trilho !top-[5px] !h-[10px] ${baixo(m) ? 'est-trilho-baixo' : ''}`} style={{ width: `${Math.min(100, (m.quantidade / escala) * 100)}%` }} />
            </span>
            <span className={`est-num text-right text-xs ${baixo(m) ? 'est-txt-warn' : 'text-ink-muted'}`}>{fmtNum(m.quantidade)} m</span>
          </div>
        ))}
      </div>
    );
  }
  if (area.id === AREA_OLEO) {
    return (
      <div className="est-mini-tambores mt-auto" aria-hidden="true">
        {lista.slice(0, 8).map((m) => {
          const ref = m.capacidade && m.capacidade > 0 ? m.capacidade : Math.max(m.quantidade, (m.minimo ?? 0) * 2, 1);
          return (
            <span key={m.id} className={baixo(m) ? 'baixo' : ''}>
              <i style={{ height: `${Math.min(100, (m.quantidade / ref) * 100)}%`, background: baixo(m) ? 'var(--warn)' : 'color-mix(in srgb, var(--ink) 40%, transparent)' }} />
            </span>
          );
        })}
      </div>
    );
  }
  if (area.id === AREA_METROLOGIA) {
    return (
      <div className="mt-auto flex flex-col gap-1.5 text-sm font-bold">
        {area.calibracao.vencidas > 0 && <span className="est-txt-err">{area.calibracao.vencidas} calibração vencida</span>}
        {area.calibracao.vencendo > 0 && <span className="est-txt-warn">{area.calibracao.vencendo} vence em 30 dias</span>}
        {area.abaixo > 0 && <span className="est-txt-warn">{area.abaixo} abaixo do mínimo</span>}
        {!area.calibracao.vencidas && !area.calibracao.vencendo && !area.abaixo && <span className="est-txt-ok">Tudo em dia</span>}
      </div>
    );
  }
  return (
    <div className="est-mini-caixas" aria-hidden="true">
      {lista.slice(0, 20).map((m) => (
        <span key={m.id} className={baixo(m) ? 'baixo' : ''}>
          <i style={{ height: `${gomosAcesos(m.quantidade, m.minimo) * 10}%` }} />
        </span>
      ))}
    </div>
  );
}

/** Resumo do estoque: a planta do depósito com as quatro áreas, o que precisa de atenção e a semana. */
export async function ResumoEstoque() {
  const r = await resumoGeralEstoque();
  const maior = Math.max(1, ...r.semana.flatMap((d) => [d.entradas, d.baixas]));
  const ultimoDia = r.semana[r.semana.length - 1]?.dia;

  return (
    <div className="est-pagina">
      <section className="est-topo">
        <div>
          <h1 className="est-h1">Resumo do estoque</h1>
          <p className="est-sub">As áreas numa olhada. Toque numa sala da planta para abrir.</p>
        </div>
      </section>

      <section aria-label="Totais" className="est-kpis">
        <Kpi rotulo="Itens no estoque" valor={r.totais.itens} nota={`Em ${r.areas.length} áreas`} />
        <Kpi rotulo="Abaixo do mínimo" valor={r.totais.abaixo} nota={r.totais.abaixo ? 'Lista de reposição abaixo' : 'Tudo acima do mínimo'} tom={r.totais.abaixo ? 'alerta' : undefined} />
        <Kpi
          rotulo="Calibração"
          valor={r.totais.vencidas + r.totais.vencendo}
          nota={r.totais.vencidas + r.totais.vencendo ? `${r.totais.vencidas} vencida${r.totais.vencidas === 1 ? '' : 's'} · ${r.totais.vencendo} vence${r.totais.vencendo === 1 ? '' : 'm'} em 30 dias` : 'Tudo em dia'}
          tom={r.totais.vencidas ? 'grave' : r.totais.vencendo ? 'alerta' : undefined}
        />
        <Kpi rotulo="Movimentos (7 dias)" valor={r.totais.entradas7d + r.totais.baixas7d} nota={`${r.totais.entradas7d} entradas · ${r.totais.baixas7d} baixas`} />
      </section>

      <section aria-labelledby="titulo-planta" className="est-bloco">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-planta" className="est-h2">Planta do depósito</h2>
          <span className="text-sm text-ink-muted">Contorno tracejado = área a céu aberto</span>
        </div>
        <div className="est-planta">
          {r.areas.map((a) => {
            const classe = a.id === AREA_TRILHOS ? 'est-sala-patio' : a.id === AREA_ALMOXARIFADO ? 'est-sala-larga' : '';
            const nota =
              a.id === AREA_TRILHOS
                ? `${a.materiais.length} itens · ${t1(r.trilhos.toneladas)} t · ${fmtNum(Math.round(r.trilhos.metros))} m`
                : `${a.materiais.length} ${a.materiais.length === 1 ? 'item' : 'itens'} · ${a.baixas7d} baixa${a.baixas7d === 1 ? '' : 's'} na semana`;
            return (
              <Link key={a.id} href={`/admin/estoque?area=${encodeURIComponent(a.id)}`} className={`est-sala ${classe}`}>
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="est-sala-nome">{a.id === AREA_TRILHOS ? 'Pátio de trilhos' : a.nome}</div>
                    <div className="mt-1 text-sm text-ink-muted">{nota}</div>
                  </div>
                  <Pilula area={a} />
                </div>
                <MiniVisual area={a} />
                {a.id === AREA_TRILHOS && <span className="text-sm font-semibold">Abrir Trilhos →</span>}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="est-colunas">
        <section aria-labelledby="titulo-atencao" className="est-bloco" style={{ flex: '1 1 360px' }}>
          <h2 id="titulo-atencao" className="est-h2">Precisa de atenção</h2>
          {r.alertas.length === 0 ? (
            <p className="text-sm text-ink-muted">Nada abaixo do mínimo e nenhuma calibração vencendo.</p>
          ) : (
            <ul className="est-lista-mov">
              {r.alertas.map((a) => (
                <li key={`${a.materialId}-${a.motivo}`}>
                  <span className="mx-auto h-2.5 w-2.5 rounded-full" style={{ background: a.grave ? 'var(--err)' : 'var(--warn)' }} aria-hidden="true" />
                  <div className="min-w-0">
                    <Link href={`/admin/estoque/material/${a.materialId}`} className="font-bold text-ink hover:underline">{a.item}</Link>
                    <p className="text-xs text-ink-muted">{a.area} · {a.motivo}</p>
                  </div>
                  <span className={`est-num text-sm font-semibold ${a.grave ? 'est-txt-err' : 'est-txt-warn'}`}>{a.valor}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titulo-semana" className="est-bloco" style={{ flex: '1 1 360px' }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="titulo-semana" className="est-h2">Movimento da semana</h2>
            <div className="est-legenda">
              <span><i className="est-amostra !w-2.5 !h-2.5" style={{ background: 'var(--ok)' }} />Entradas</span>
              <span><i className="est-amostra !w-2.5 !h-2.5" style={{ background: 'var(--ink-muted)' }} />Baixas</span>
            </div>
          </div>
          <div className="est-grafico" role="img" aria-label={`Entradas e baixas por dia nos últimos 7 dias: ${r.totais.entradas7d} entradas e ${r.totais.baixas7d} baixas.`}>
            {r.semana.map((d) => (
              <div key={d.dia} className="est-grafico-dia">
                <div><small>{d.entradas}</small><span className="est-barra-e" style={{ height: `${(d.entradas / maior) * 120}px` }} /></div>
                <div><small>{d.baixas}</small><span className="est-barra-b" style={{ height: `${(d.baixas / maior) * 120}px` }} /></div>
              </div>
            ))}
          </div>
          <div className="est-dias" aria-hidden="true">
            {r.semana.map((d) => (
              <span key={d.dia} className={d.dia === ultimoDia ? 'font-bold text-ink' : ''}>{rotuloDia(d.dia, d.dia === ultimoDia)}</span>
            ))}
          </div>
        </section>

        <section aria-labelledby="titulo-ultimas" className="est-bloco" style={{ flex: '1 1 360px' }}>
          <h2 id="titulo-ultimas" className="est-h2">Últimas movimentações</h2>
          <ListaMovimentos movimentos={r.ultimas} mostrarArea vazio="Nenhuma movimentação ainda." />
        </section>
      </div>
    </div>
  );
}
