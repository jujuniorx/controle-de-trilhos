import Link from 'next/link';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { IconeBarraLisa, IconeBusca, IconeSecaoTrilho, IconeTala } from '@/components/icones/Icones';
import { fatoresPerfil, listarMateriaisDaArea, movimentosRecentes, type MaterialEstoque } from '@/lib/services/estoqueAreas';
import {
  AREA_TRILHOS,
  ROTULO_CATEGORIA,
  escalaMetros,
  fmtNum,
  metrosTrilho,
  percentualDoMinimo,
  precisaRepor,
  rotuloUnidade,
  situacaoNivel,
  toneladasTrilho,
  type CategoriaTrilho,
} from '@/lib/domain/estoque';
import { Kpi, ListaMovimentos, TopoArea, qtdTexto, quandoCurto, rotuloMovimento, variacaoTexto } from './comum';
import { MovimentoRapido } from './MovimentoRapido';
import { LixeiraArea } from './LixeiraArea';

const t1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Tamanho do desenho da seção: o TR68 aparece maior que o TR37. */
function tamanhoSecao(perfil: string | null): number {
  const n = Number((perfil ?? '').replace(/\D/g, '')) || 50;
  return Math.round(22 + (n - 22) * 0.3);
}

function IconeItem({ categoria }: { categoria: string | null }) {
  if (categoria === 'TALA') return <IconeTala size={22} strokeWidth={1.7} />;
  if (categoria === 'LISA') return <IconeBarraLisa size={22} strokeWidth={1.7} />;
  return <IconeSecaoTrilho size={18} />;
}

const FILTROS: { id: string; rotulo: string }[] = [
  { id: '', rotulo: 'Todos' },
  { id: 'PERFIL', rotulo: 'Perfis' },
  { id: 'TALA', rotulo: 'Talas' },
  { id: 'LISA', rotulo: 'Barras lisas' },
];

export async function TrilhosEstoque({ busca = '', cat = '' }: { busca?: string; cat?: string }) {
  const [todos, fatores, movimentos] = await Promise.all([
    listarMateriaisDaArea(AREA_TRILHOS),
    fatoresPerfil(),
    movimentosRecentes(AREA_TRILHOS, 6),
  ]);
  const fator = (m: MaterialEstoque) => (m.perfil ? fatores[m.perfil] ?? null : null);
  const toneladas = (m: MaterialEstoque) => toneladasTrilho({ ...m, fator: fator(m) });
  const baixo = (m: MaterialEstoque) => precisaRepor(situacaoNivel(m.quantidade, m.minimo)) && (m.minimo ?? 0) > 0;

  const totalT = todos.reduce((t, m) => t + (toneladas(m) ?? 0), 0);
  const totalM = todos.reduce((t, m) => t + (metrosTrilho(m) ?? 0), 0);
  const abaixo = todos.filter(baixo);
  const conta = (c: CategoriaTrilho) => todos.filter((m) => m.categoria === c).length;
  const perfis = todos.filter((m) => m.categoria === 'PERFIL').sort((a, b) => b.quantidade - a.quantidade);
  const escala = escalaMetros(perfis.flatMap((m) => [m.quantidade, m.minimo ?? 0]));

  const termo = busca.trim().toLowerCase();
  const linhas = todos.filter((m) => (!cat || m.categoria === cat) && (!termo || `${m.nome} ${m.fabricante ?? ''}`.toLowerCase().includes(termo)));
  const href = (c: string) => `/admin/estoque?area=${AREA_TRILHOS}${c ? `&cat=${c}` : ''}${busca ? `&q=${encodeURIComponent(busca)}` : ''}`;

  return (
    <div className="est-pagina">
      <TopoArea
        titulo="Estoque de trilhos"
        texto="Perfis, talas e barras lisas. Toda entrada, baixa e ajuste fica no histórico, com quem fez e o documento."
        areaId={AREA_TRILHOS}
        rotuloNovo="Novo item"
      />

      <section aria-label="Totais" className="est-kpis">
        <Kpi rotulo="Peso em estoque" valor={`${t1(totalT)} t`} nota="Perfis e barras lisas, pelo fator de cada perfil" />
        <Kpi rotulo="Comprimento" valor={`${fmtNum(Math.round(totalM))} m`} nota="Somando perfis e barras lisas" />
        <Kpi rotulo="Itens cadastrados" valor={todos.length} nota={`${conta('PERFIL')} perfis · ${conta('TALA')} talas · ${conta('LISA')} barras lisas`} />
        <Kpi
          rotulo="Abaixo do mínimo"
          valor={abaixo.length}
          nota={abaixo.length ? abaixo.map((m) => m.nome).join(' · ') : 'Tudo acima do mínimo'}
          tom={abaixo.length ? 'alerta' : undefined}
        />
      </section>

      {todos.length === 0 ? (
        <section className="est-bloco">
          <EstadoVazio titulo="Nenhum item de trilho cadastrado" texto='Toque em "Novo item" para cadastrar perfis, talas e barras lisas.' />
        </section>
      ) : (
        <>
          {perfis.length > 0 && (
            <section aria-labelledby="titulo-patio" className="est-bloco est-patio">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 id="titulo-patio" className="est-h2">Pátio de perfis</h2>
                  <p className="mt-1 text-sm text-ink-muted">Cada trilho deitado é o comprimento em estoque daquele perfil. O traço tracejado marca o mínimo.</p>
                </div>
                <div className="est-legenda">
                  <span><i className="est-amostra" style={{ background: 'linear-gradient(180deg,#f4f4f5 0 34%,#71717a 36% 62%,#d4d4d8 64%)' }} />Acima do mínimo</span>
                  <span><i className="est-amostra" style={{ background: 'linear-gradient(180deg,#fde68a 0 34%,#b45309 36% 62%,#fbbf24 64%)' }} />Abaixo do mínimo</span>
                </div>
              </div>
              <div className="flex flex-col gap-3.5">
                {perfis.map((m) => {
                  const b = baixo(m);
                  const t = toneladas(m);
                  return (
                    <Link key={m.id} href={`/admin/estoque/material/${m.id}`} className="est-patio-linha text-ink no-underline">
                      <span className={`est-patio-secao ${b ? 'est-patio-secao-baixo' : ''}`}>
                        <IconeSecaoTrilho size={tamanhoSecao(m.perfil)} />
                      </span>
                      <span className="min-w-0">
                        <span className="est-patio-perfil block">{m.perfil}</span>
                        <span className="block truncate text-sm text-ink-muted">{m.fabricante ?? 'Sem fabricante'}</span>
                      </span>
                      <span className="est-pista" aria-hidden="true">
                        <span className={`est-trilho ${b ? 'est-trilho-baixo' : ''}`} style={{ width: `${Math.min(100, (m.quantidade / escala) * 100)}%` }} />
                        {m.minimo ? <span className={`est-minimo ${b ? 'est-minimo-baixo' : ''}`} style={{ left: `${Math.min(100, (m.minimo / escala) * 100)}%` }} /> : null}
                      </span>
                      <span className="est-num text-right">
                        <span className={`block text-base font-semibold ${b ? 'est-txt-warn' : ''}`}>{fmtNum(m.quantidade)} m</span>
                        <span className="block text-xs text-ink-muted">
                          {t != null ? `${t1(t)} t` : 'sem fator'}{m.minimo ? ` · mín. ${fmtNum(m.minimo)} m` : ''}
                        </span>
                      </span>
                    </Link>
                  );
                })}
                <div className="est-patio-linha" aria-hidden="true">
                  <span /><span />
                  <span className="est-eixo">
                    <span>0</span><span>{fmtNum(escala / 3, 0)} m</span><span>{fmtNum((escala * 2) / 3, 0)} m</span><span>{fmtNum(escala)} m</span>
                  </span>
                  <span />
                </div>
              </div>
            </section>
          )}

          <div className="est-colunas">
            <section aria-labelledby="titulo-itens" className="est-bloco est-largo">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 id="titulo-itens" className="est-h2 mr-2">Itens</h2>
                <nav aria-label="Filtrar por categoria" className="est-chips">
                  {FILTROS.map((f) => (
                    <Link key={f.id} href={href(f.id)} className="est-chip" aria-current={cat === f.id ? 'true' : undefined}>
                      {f.rotulo} <span className="est-chip-qtd">{f.id ? conta(f.id as CategoriaTrilho) : todos.length}</span>
                    </Link>
                  ))}
                </nav>
                <form method="get" role="search" className="relative ml-auto min-w-[200px] flex-[0_1_260px]">
                  <input type="hidden" name="area" value={AREA_TRILHOS} />
                  {cat && <input type="hidden" name="cat" value={cat} />}
                  <label htmlFor="busca-trilhos" className="sr-only">Buscar item</label>
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IconeBusca size={16} /></span>
                  <input id="busca-trilhos" name="q" type="search" defaultValue={busca} placeholder="Perfil ou fabricante" className="h-11 w-full pl-9" autoComplete="off" />
                </form>
              </div>

              {linhas.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhum item com esse filtro.</p>
              ) : (
                <div className="est-tabela-caixa">
                  <table className="est-tabela">
                    <thead>
                      <tr>
                        <th scope="col">Item</th>
                        <th scope="col" className="est-dir">Saldo</th>
                        <th scope="col" className="est-dir">Peso</th>
                        <th scope="col">Nível</th>
                        <th scope="col">Última movimentação</th>
                        <th scope="col" className="est-dir">Movimentar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((m) => {
                        const pct = percentualDoMinimo(m.quantidade, m.minimo);
                        const b = baixo(m);
                        const t = toneladas(m);
                        return (
                          <tr key={m.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <span className="est-icone-item"><IconeItem categoria={m.categoria} /></span>
                                <div className="min-w-0">
                                  <Link href={`/admin/estoque/material/${m.id}`} className="font-bold text-ink hover:underline">{m.nome}</Link>
                                  <p className="text-xs text-ink-muted">{ROTULO_CATEGORIA[(m.categoria ?? 'PERFIL') as CategoriaTrilho]} · {m.fabricante ?? 'Sem fabricante'}</p>
                                </div>
                              </div>
                            </td>
                            <td className={`est-dir est-num font-semibold ${b ? 'est-txt-warn' : ''}`}>{qtdTexto(m.quantidade, m.unidade, m.categoria)}</td>
                            <td className="est-dir est-num text-ink-muted">{t != null ? `${t1(t)} t` : '—'}</td>
                            <td>
                              {pct == null ? (
                                <span className="text-xs text-ink-muted">Sem mínimo</span>
                              ) : (
                                <span className={`est-nivel ${b ? 'est-nivel-baixo' : ''}`}>
                                  <span className={`text-xs font-semibold ${b ? 'est-txt-warn' : 'est-txt-ok'}`}>{b ? `Abaixo do mínimo · ${pct}%` : `${pct}% do mínimo`}</span>
                                  <span className="est-nivel-barra"><span style={{ width: `${Math.min(100, pct / 2)}%` }} /></span>
                                </span>
                              )}
                            </td>
                            <td>
                              {m.ultimo ? (
                                <>
                                  <p className="text-sm">{rotuloMovimento(m.ultimo.tipo)} {variacaoTexto({ ...m.ultimo, unidade: m.unidade, categoria: m.categoria })}</p>
                                  <p className="text-xs text-ink-muted">{quandoCurto(m.ultimo.criadoEm)}{m.ultimo.documento ? ` · NF ${m.ultimo.documento}` : ''}</p>
                                </>
                              ) : (
                                <span className="text-xs text-ink-muted">Nenhuma</span>
                              )}
                            </td>
                            <td className="est-dir">
                              <span className="inline-flex gap-1.5">
                                <MovimentoRapido materialId={m.id} nome={m.nome} unidade={rotuloUnidade(m.unidade, m.categoria)} tipo="ENTRADA" />
                                <MovimentoRapido materialId={m.id} nome={m.nome} unidade={rotuloUnidade(m.unidade, m.categoria)} tipo="BAIXA" />
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <aside aria-labelledby="titulo-mov-trilhos" className="est-bloco est-estreito">
              <h2 id="titulo-mov-trilhos" className="est-h2">Movimentações</h2>
              <ListaMovimentos movimentos={movimentos} vazio="Nenhuma movimentação ainda." />
            </aside>
          </div>
        </>
      )}
      <LixeiraArea areaId={AREA_TRILHOS} />
    </div>
  );
}
