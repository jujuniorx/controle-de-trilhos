import { IconeAlerta } from '@/components/icones/Icones';
import { ROTULO_FABRICANTE, type Lancamento, type Saldo } from '@/lib/estoque/trilhos';
import { barrasPorClasse, cartaoPerfil, outrosNovo, perfisDeSolda, type LinhaClasses } from '@/lib/estoque/visao';
import { UltimasMovimentacoes } from './UltimasMovimentacoes';
import { fmt, fmtM, fmtT } from './formato';

const PERFIS_SOLDADOS = ['TR60', 'TR68', 'UIC60'];

function CartaoSolda({ saldos, perfil }: { saldos: Saldo[]; perfil: string }) {
  const c = cartaoPerfil(saldos, perfil);
  const maior = Math.max(1, ...c.possiveis.map((p) => p.tls));
  return (
    <section className="etr-perfil" aria-label={`Trilho novo ${perfil}`}>
      <div className="etr-perfil-topo">
        <b>{perfil}</b>
        <span>
          {fmtM(c.metros)} m em estoque · {fmtT(c.toneladas)} t
        </span>
      </div>
      <div className="etr-grandes">
        <div className="etr-grande">
          <b className={c.tlsProntos < 0 ? 'etr-neg' : undefined}>{fmt(c.tlsProntos)}</b>
          <span>TLS prontos</span>
        </div>
        <div className="etr-grande etr-grande-forma">
          <b>+{fmt(c.totalPossiveis)}</b>
          <span>TLS que dá para formar</span>
        </div>
      </div>
      {c.trava && (
        <p className="etr-trava">
          <IconeAlerta size={16} />
          <span>O que trava: {c.trava}.</span>
        </p>
      )}
      <div className="etr-fabs">
        {c.possiveis.map((p) => {
          const nota = c.notas[p.fabricante];
          const prontos = saldos
            .filter((s) => s.secao === 'NOVO' && s.perfil === perfil && s.tipo === 'TLS' && s.fabricante === p.fabricante)
            .reduce((t, s) => t + (s.unidades ?? 0), 0);
          return (
            <div key={p.fabricante} className={`etr-fab ${p.tls === 0 ? 'etr-fab-zero' : ''}`}>
              <div className="etr-fab-nome">
                {ROTULO_FABRICANTE[p.fabricante]}
                <small>{prontos ? `${fmt(prontos)} TLS prontos` : `${fmt(p.lisasBarras)} lisas · ${fmt(p.talasBarras)} talas`}</small>
              </div>
              <div className="etr-barra" aria-hidden="true">
                {p.tls > 0 && <i style={{ width: `${Math.max(2, (p.tls / maior) * 100)}%` }} />}
              </div>
              <div className="etr-fab-num">
                {fmt(p.tls)}
                <small>TLS</small>
              </div>
              {nota && (
                <div className="etr-fab-nota">
                  <b>{nota.split(/(?<=[.:])\s/)[0]}</b> {nota.split(/(?<=[.:])\s/).slice(1).join(' ')}
                </div>
              )}
            </div>
          );
        })}
        {c.possiveis.length === 0 && <p className="etr-fab-nota">Sem barras lisas nem talas deste perfil.</p>}
      </div>
    </section>
  );
}

function Pilhas({ linhas, secao }: { linhas: LinhaClasses[]; secao: 'REEMPREGO' | 'SUCATA' }) {
  const base = Math.max(1, ...linhas.map((l) => (secao === 'SUCATA' ? l.toneladas : l.metros)));
  return (
    <>
      {linhas.map((l) => {
        const valor = secao === 'SUCATA' ? l.toneladas : l.metros;
        const total = l.partes.reduce((t, p) => t + Math.max(0, p.metros), 0) || 1;
        return (
          <div key={l.perfil} className="etr-lin">
            <b>{l.perfil}</b>
            <div className="etr-pilha" style={{ width: `${Math.max(0.6, (Math.max(0, valor) / base) * 100)}%` }} aria-hidden="true">
              {l.partes.map((p) => (
                <i key={p.classe} className={`etr-c-${p.classe}`} style={{ width: `${(Math.max(0, p.metros) / total) * 100}%` }} />
              ))}
            </div>
            <div className={`etr-lin-num ${valor < 0 ? 'etr-neg' : ''}`}>
              {secao === 'SUCATA' ? `${fmtT(l.toneladas)} t` : `${fmtM(l.metros)} m`}
              <small>{secao === 'SUCATA' ? `${fmtM(l.metros)} m` : `${fmtT(l.toneladas)} t`}</small>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function ResumoTrilhos({ saldos, lancamentos }: { saldos: Saldo[]; lancamentos: Lancamento[] }) {
  const perfis = perfisDeSolda(saldos);
  const outros = outrosNovo(saldos, perfis);
  const reemprego = barrasPorClasse(saldos, 'REEMPREGO');
  const sucata = barrasPorClasse(saldos, 'SUCATA');
  const somaM = (l: LinhaClasses[]) => l.reduce((t, x) => t + x.metros, 0);
  const somaT = (l: LinhaClasses[]) => l.reduce((t, x) => t + x.toneladas, 0);
  const sucataPorClasse = (c: string) => sucata.reduce((t, l) => t + (l.partes.find((p) => p.classe === c)?.metros ?? 0), 0);
  const dicas = reemprego
    .filter((l) => PERFIS_SOLDADOS.includes(l.perfil))
    .map((l) => ({ perfil: l.perfil, tls: Math.floor(Math.max(0, l.partes.find((p) => p.classe === 'G1')?.metros ?? 0) / 312) }))
    .filter((d) => d.tls > 0);
  return (
    <>
      <div className="etr-secao">
        <h2 className="etr-h2">Trilho novo para solda</h2>
        <div className="etr-solda">
          {perfis.map((p) => (
            <CartaoSolda key={p} saldos={saldos} perfil={p} />
          ))}
        </div>
        {outros.length > 0 && (
          <div className="etr-outros">
            <span>Também no estoque de novo:</span>
            {outros.map((o) => (
              <span key={o.rotulo}>
                <b>{o.rotulo}</b> {fmtM(o.metros)} m
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="etr-duas">
        <section className="etr-caixa" aria-label="Reemprego">
          <div className="etr-caixa-cab">
            <h2 className="etr-h2">Reemprego</h2>
            <div className="etr-tot">
              {fmtM(somaM(reemprego))} <small>m · {fmtT(somaT(reemprego))} t</small>
            </div>
          </div>
          <div className="etr-legenda">
            {['G1', 'G2', 'G3'].map((c) => (
              <span key={c}>
                <i className={`etr-c-${c}`} />
                {c}
              </span>
            ))}
          </div>
          <Pilhas linhas={reemprego} secao="REEMPREGO" />
          {dicas.length > 0 && (
            <p className="etr-dica">
              O G1 dá para formar{' '}
              {dicas.map((d, i) => (
                <span key={d.perfil}>
                  {i > 0 && (i === dicas.length - 1 ? ' e ' : ', ')}
                  <b>
                    {d.tls} TLS de reemprego {d.perfil}
                  </b>
                </span>
              ))}{' '}
              (312 m cada).
            </p>
          )}
        </section>
        <section className="etr-caixa" aria-label="Sucata">
          <div className="etr-caixa-cab">
            <h2 className="etr-h2">Sucata</h2>
            <div className="etr-tot">
              {fmtT(somaT(sucata))} <small>t · {fmtM(somaM(sucata))} m</small>
            </div>
          </div>
          <div className="etr-legenda">
            <span>
              <i className="etr-c-SC1" />
              SC-1 longas (7 a 12 m)
            </span>
            <span>
              <i className="etr-c-SC2" />
              SC-2 curtas (3 a 7 m)
            </span>
            <span>
              <i className="etr-c-SC3" />
              SC-3 tocos
            </span>
          </div>
          <Pilhas linhas={sucata} secao="SUCATA" />
          <p className="etr-dica">
            Toneladas já com 5% de desgaste. Longas {fmtM(sucataPorClasse('SC1'))} m · curtas {fmtM(sucataPorClasse('SC2'))} m · tocos {fmtM(sucataPorClasse('SC3'))} m.
          </p>
        </section>
      </div>

      <div className="etr-secao">
        <h2 className="etr-h2">Últimas movimentações</h2>
        <UltimasMovimentacoes lancamentos={lancamentos} limite={3} />
      </div>
    </>
  );
}
