import { FormularioUsina } from '@/components/usina/FormularioUsina';
import { salvarSapAction } from '@/app/admin/(protegido)/estoque/trilhos-actions';
import {
  ROTULO_CLASSE_NOVO,
  ROTULO_FABRICANTE,
  chavePosicao,
  movimentoDoPeriodo,
  type ClasseNovo,
  type Lancamento,
  type Saldo,
  type Secao,
} from '@/lib/estoque/trilhos';
import { barrasPorClasse, conferenciaSap, resumoSucata, tabelaNovo, type ColunasNovo } from '@/lib/estoque/visao';
import type { ItemSap } from '@/lib/services/estoqueTrilhos';
import { UltimasMovimentacoes } from './UltimasMovimentacoes';
import { dataBr, fmt, fmtM, fmtT } from './formato';

export type AbaDetalhado = 'novo' | 'sucata' | 'sap' | 'movimentos';
export type ModoTabela = 'saldo' | 'movimento';

interface Props {
  saldos: Saldo[];
  lancamentos: Lancamento[];
  sap: Partial<Record<ItemSap, number>>;
  aba: AbaDetalhado;
  modo: ModoTabela;
  de: string;
  ate: string;
  /** Monta o endereço da tela trocando só os parâmetros passados. */
  href: (troca: Record<string, string>) => string;
}

/** Célula de metros: zero apagado, negativo em vermelho. */
function Num({ v, casas, forte }: { v: number; casas?: number; forte?: boolean }) {
  if (v === 0) return <td className="etr-z">0</td>;
  const texto = casas == null ? fmtM(v) : fmt(v, casas);
  return (
    <td className={v < 0 ? 'etr-neg' : forte ? 'etr-t' : undefined} title={v < 0 ? 'Confira o saldo' : undefined}>
      {texto}
    </td>
  );
}

function CelulasNovo({ c }: { c: ColunasNovo }) {
  return (
    <>
      <Num v={c.tlsUn} casas={0} />
      <Num v={c.tlsM} />
      <Num v={c.lisa} />
      <Num v={c.tala} />
      <Num v={c.curta12} />
      <Num v={c.menor12} />
      <Num v={c.curtos} />
      <Num v={c.geral} />
      <Num v={c.toneladas} casas={1} forte />
    </>
  );
}

function ChaveModo({ modo, href }: { modo: ModoTabela; href: Props['href'] }) {
  return (
    <nav className="etr-modo" aria-label="Saldo ou movimento do período">
      <a href={href({ modo: 'saldo' })} aria-current={modo === 'saldo' ? 'page' : undefined}>
        Saldo
      </a>
      <a href={href({ modo: 'movimento' })} aria-current={modo === 'movimento' ? 'page' : undefined}>
        Movimento do período
      </a>
    </nav>
  );
}

const NOME_TIPO: Record<string, string> = { TLS: 'TLS', LISA: 'Barras lisas', TALA: 'Talas (com furos)', CURTA12: 'Curtas 12 m', MENOR12: 'Menores de 12 m', BARRA: 'Barras' };

function rotuloLinha(s: Saldo): string {
  if (s.secao === 'NOVO') {
    const classe = s.classe === 'NORMAL' ? '' : ` · ${ROTULO_CLASSE_NOVO[s.classe as ClasseNovo] ?? s.classe}`;
    return `${s.perfil} ${s.fabricante ? ROTULO_FABRICANTE[s.fabricante] : ''}${classe} · ${NOME_TIPO[s.tipo]}`;
  }
  if (s.secao === 'REEMPREGO') return s.tipo === 'TLS' ? `${s.perfil} · TLS de reemprego` : `${s.perfil} · ${s.classe}`;
  return `${s.perfil} · ${s.classe.replace('SC', 'SC-')}`;
}

/** Saldo anterior, entradas, saídas e saldo de cada linha da seção, no período (como as colunas de conta da planilha). */
function TabelaMovimento({ saldos, lancamentos, secoes, de, ate }: { saldos: Saldo[]; lancamentos: Lancamento[]; secoes: Secao[]; de: string; ate: string }) {
  const linhas = saldos.filter((s) => secoes.includes(s.secao));
  return (
    <div className="etr-tab">
      <table>
        <thead>
          <tr>
            <th>Linha</th>
            <th>
              Saldo anterior<small>antes de {dataBr(de)}</small>
            </th>
            <th>Entradas</th>
            <th>Saídas</th>
            <th>
              Saldo<small>em {dataBr(ate)}</small>
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((s) => {
            const m = movimentoDoPeriodo(lancamentos, chavePosicao(s), de, ate);
            const un = s.tipo === 'TLS';
            const f = (v: number) => (un ? fmt(v) : fmtM(v));
            return (
              <tr key={chavePosicao(s)}>
                <td className="etr-esq">{rotuloLinha(s)}</td>
                <td>{f(m.anterior)}</td>
                <td className={m.entradas ? 'etr-mais' : 'etr-z'}>{m.entradas ? `+${f(m.entradas)}` : '0'}</td>
                <td className={m.saidas ? 'etr-menos' : 'etr-z'}>{m.saidas ? `−${f(m.saidas)}` : '0'}</td>
                <td className={m.saldo < 0 ? 'etr-neg' : undefined}>
                  <b>{f(m.saldo)}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AbaNovoReemprego({ saldos, lancamentos, modo, de, ate, href }: Props) {
  const grupos = tabelaNovo(saldos);
  const reemprego = barrasPorClasse(saldos, 'REEMPREGO').sort((a, b) => a.perfil.localeCompare(b.perfil, 'pt-BR', { numeric: true }));
  const totR = (c: string) => reemprego.reduce((t, l) => t + (l.partes.find((p) => p.classe === c)?.metros ?? 0), 0);
  return (
    <>
      <section className="etr-card">
        <div className="etr-card-cab">
          <div>
            <div className="etr-card-tit">Trilhos longos soldados (TLS) e barras curtas · novo</div>
            <div className="etr-card-ex">Como as linhas 3 a 19 da aba &quot;Estoque Novo e Reemprego&quot;. Metros.</div>
          </div>
          <ChaveModo modo={modo} href={href} />
        </div>
        {modo === 'movimento' ? (
          <TabelaMovimento saldos={saldos} lancamentos={lancamentos} secoes={['NOVO']} de={de} ate={ate} />
        ) : (
          <>
            <div className="etr-tab">
              <table>
                <thead>
                  <tr>
                    <th>Fabricante</th>
                    <th className="etr-esq">Classificação</th>
                    <th>
                      Quantidade<small>nº TLS</small>
                    </th>
                    <th>
                      Total de TLS<small>metros</small>
                    </th>
                    <th>Barras lisas</th>
                    <th>Barras com furos</th>
                    <th>Curtas = 12 m</th>
                    <th>Menores de 12 m</th>
                    <th>
                      Total trilhos curtos<small>metros</small>
                    </th>
                    <th>
                      Total geral<small>metros</small>
                    </th>
                    <th>Toneladas</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.flatMap((g) => [
                    <tr key={g.perfil} className="etr-subtotal">
                      <td>{g.perfil}</td>
                      <td className="etr-esq">Total</td>
                      <CelulasNovo c={g.total} />
                    </tr>,
                    ...g.linhas.map((l) => (
                      <tr key={`${g.perfil}-${l.fabricante}-${l.classe}`}>
                        <td>{l.fabricante ? ROTULO_FABRICANTE[l.fabricante] : 'Diversos'}</td>
                        <td className="etr-esq">{ROTULO_CLASSE_NOVO[l.classe as ClasseNovo] ?? l.classe}</td>
                        <CelulasNovo c={l} />
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
            <div className="etr-leg">
              <span>Total de trilhos curtos = lisas + com furos + curtas 12 m + menores de 12 m (coluna L da planilha)</span>
              <span>1 TLS = 312 m · toneladas pelo fator do perfil</span>
            </div>
          </>
        )}
      </section>

      <section className="etr-card">
        <div className="etr-card-cab">
          <div>
            <div className="etr-card-tit">Reemprego</div>
            <div className="etr-card-ex">Como as linhas 29 a 43. Metros. O TLS de reemprego usa só o G1 (312 m).</div>
          </div>
          <ChaveModo modo={modo} href={href} />
        </div>
        {modo === 'movimento' ? (
          <TabelaMovimento saldos={saldos} lancamentos={lancamentos} secoes={['REEMPREGO']} de={de} ate={ate} />
        ) : (
          <div className="etr-tab">
            <table>
              <thead>
                <tr>
                  <th>Perfil</th>
                  <th>G1</th>
                  <th>G2</th>
                  <th>G3</th>
                  <th>Total</th>
                  <th>Toneladas</th>
                  <th>TLS</th>
                </tr>
              </thead>
              <tbody>
                {reemprego.map((l) => (
                  <tr key={l.perfil}>
                    <td>
                      <b>{l.perfil}</b>
                    </td>
                    {['G1', 'G2', 'G3'].map((c) => (
                      <Num key={c} v={l.partes.find((p) => p.classe === c)?.metros ?? 0} />
                    ))}
                    <Num v={l.metros} />
                    <Num v={l.toneladas} casas={1} />
                    <Num v={l.tls} casas={0} />
                  </tr>
                ))}
                <tr className="etr-subtotal">
                  <td>Total</td>
                  <Num v={totR('G1')} />
                  <Num v={totR('G2')} />
                  <Num v={totR('G3')} />
                  <Num v={reemprego.reduce((t, l) => t + l.metros, 0)} />
                  <Num v={reemprego.reduce((t, l) => t + l.toneladas, 0)} casas={1} forte />
                  <Num v={reemprego.reduce((t, l) => t + l.tls, 0)} casas={0} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function AbaSucata({ saldos, lancamentos, modo, de, ate, href }: Props) {
  const linhas = barrasPorClasse(saldos, 'SUCATA').sort((a, b) => a.perfil.localeCompare(b.perfil, 'pt-BR', { numeric: true }));
  const resumo = resumoSucata(saldos);
  const nome = { SC1: 'Longas 7 a 12 m', SC2: 'Curtas 3 a 7 m', SC3: 'Tocos 0 a 3 m', TOTAL: 'Total' } as const;
  return (
    <section className="etr-card">
      <div className="etr-card-cab">
        <div>
          <div className="etr-card-tit">Sucata</div>
          <div className="etr-card-ex">Como a aba &quot;Estoque sucata&quot;. Toneladas já com 5% de desgaste.</div>
        </div>
        <ChaveModo modo={modo} href={href} />
      </div>
      <div className="etr-resumos">
        {resumo.map((r) => (
          <div key={r.classe}>
            <span>{nome[r.classe]}</span>
            <b>{fmtM(r.metros)} m</b>
            <em>{fmtT(r.toneladas)} t</em>
          </div>
        ))}
      </div>
      {modo === 'movimento' ? (
        <TabelaMovimento saldos={saldos} lancamentos={lancamentos} secoes={['SUCATA']} de={de} ate={ate} />
      ) : (
        <div className="etr-tab">
          <table>
            <thead>
              <tr>
                <th>Perfil</th>
                <th>
                  SC-1<small>longas</small>
                </th>
                <th>
                  SC-2<small>curtas</small>
                </th>
                <th>
                  SC-3<small>tocos</small>
                </th>
                <th>Total</th>
                <th>Toneladas</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.perfil}>
                  <td>
                    <b>{l.perfil}</b>
                  </td>
                  {['SC1', 'SC2', 'SC3'].map((c) => (
                    <Num key={c} v={l.partes.find((p) => p.classe === c)?.metros ?? 0} />
                  ))}
                  <Num v={l.metros} />
                  <Num v={l.toneladas} casas={1} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AbaSap({ saldos, sap }: Props) {
  const linhas = conferenciaSap(saldos, sap);
  return (
    <section className="etr-card">
      <div className="etr-card-cab">
        <div>
          <div className="etr-card-tit">Conferir com o SAP</div>
          <div className="etr-card-ex">Como as linhas 22 a 26. Digite o total do SAP em toneladas (MP + MN + FIPS).</div>
        </div>
      </div>
      <div className="p-4">
        <FormularioUsina acao={salvarSapAction} rotuloBotao="Salvar valores do SAP">
          <div className="etr-tab">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>
                    SAP<small>toneladas</small>
                  </th>
                  <th>Equivale a</th>
                  <th>Sistema</th>
                  <th>Diferença</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.item}>
                    <td>
                      <b>{l.rotulo}</b>
                      {l.tipo === 'BARRAS' && <small>lisas, talas e curtas</small>}
                    </td>
                    <td>
                      <input
                        name={l.item}
                        inputMode="decimal"
                        defaultValue={l.sap == null ? '' : fmt(l.sap, 3)}
                        className="h-10 w-32 text-right"
                        aria-label={`SAP ${l.rotulo} em toneladas`}
                      />
                    </td>
                    <td className={l.equivalente == null ? 'etr-z' : undefined}>
                      {l.equivalente == null ? '—' : l.tipo === 'TLS' ? `${fmt(l.equivalente)} TLS` : `${fmtM(l.equivalente)} m`}
                    </td>
                    <td>
                      {l.tipo === 'TLS' ? `${fmt(l.sistemaUnidades ?? 0)} TLS` : `${fmtT(l.sistemaToneladas)} t`}
                      <small>{l.tipo === 'TLS' ? `${fmtT(l.sistemaToneladas)} t` : `${fmtM(l.sistemaMetros)} m`}</small>
                    </td>
                    <td>
                      {l.situacao === 'sem-sap' && <span className="etr-z">sem SAP</span>}
                      {l.situacao === 'bate' && <span className="etr-badge etr-badge-ok">bate</span>}
                      {l.situacao === 'diferenca' && (
                        <>
                          <span className="etr-badge etr-badge-dif">
                            {(l.diferenca ?? 0) > 0 ? '+' : '−'}
                            {fmtT(Math.abs(l.diferenca ?? 0))} t
                          </span>
                          <small>{(l.diferenca ?? 0) > 0 ? 'sistema tem mais' : 'SAP tem mais'}</small>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormularioUsina>
      </div>
    </section>
  );
}

export function DetalhadoTrilhos(props: Props) {
  const { aba, de, ate, href } = props;
  const abas: [AbaDetalhado, string][] = [
    ['novo', 'Novo e reemprego'],
    ['sucata', 'Sucata'],
    ['sap', 'Conferir com o SAP'],
    ['movimentos', 'Movimentos'],
  ];
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav className="etr-abas" aria-label="Partes do estoque detalhado">
          {abas.map(([id, rotulo]) => (
            <a key={id} href={href({ aba: id })} aria-current={aba === id ? 'page' : undefined}>
              {rotulo}
            </a>
          ))}
        </nav>
        <form className="etr-periodo" action="/admin/estoque">
          <input type="hidden" name="area" value="area-trilhos" />
          <input type="hidden" name="vista" value="detalhado" />
          <input type="hidden" name="aba" value={aba} />
          <div className="field">
            <label htmlFor="etr-de">De</label>
            <input id="etr-de" type="date" name="de" defaultValue={de} className="h-10" />
          </div>
          <div className="field">
            <label htmlFor="etr-ate">Até</label>
            <input id="etr-ate" type="date" name="ate" defaultValue={ate} className="h-10" />
          </div>
          <button type="submit" className="btn btn-ghost h-10">
            Ver período
          </button>
        </form>
      </div>
      {aba === 'novo' && <AbaNovoReemprego {...props} />}
      {aba === 'sucata' && <AbaSucata {...props} />}
      {aba === 'sap' && <AbaSap {...props} />}
      {aba === 'movimentos' && (
        <section className="etr-secao">
          <h2 className="etr-h2">
            Movimentos de {dataBr(de)} a {dataBr(ate)}
          </h2>
          <UltimasMovimentacoes lancamentos={props.lancamentos} de={de} ate={ate} />
        </section>
      )}
    </>
  );
}
