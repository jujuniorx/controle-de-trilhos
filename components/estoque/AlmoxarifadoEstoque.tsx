import Link from 'next/link';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { IconeBusca } from '@/components/icones/Icones';
import { atividadeArea, listarMateriaisDaArea, movimentosRecentes, type MaterialEstoque } from '@/lib/services/estoqueAreas';
import { fmtNum, gomosAcesos, precisaRepor, rotuloUnidade, situacaoNivel } from '@/lib/domain/estoque';
import { Kpi, ListaMovimentos, TopoArea, qtdTexto, quandoCurto } from './comum';
import { LixeiraArea } from './LixeiraArea';
import { MovimentoRapido } from './MovimentoRapido';

const SEM_PRATELEIRA = 'Sem prateleira';

function letraDa(grupo: MaterialEstoque[], indice: number): string {
  const comEndereco = grupo.find((m) => m.endereco);
  const letra = comEndereco?.endereco?.split('-')[0]?.trim();
  return letra && letra.length <= 3 ? letra : String.fromCharCode(65 + (indice % 26));
}

/**
 * Almoxarifado (e qualquer área nova sem tela própria): materiais em caixas, arrumados por prateleira.
 * A etiqueta mostra o endereço (A-01) e os 10 gomos vão até o dobro do mínimo.
 */
export async function AlmoxarifadoEstoque({ areaId, nomeArea, busca = '', prateleira = '' }: { areaId: string; nomeArea: string; busca?: string; prateleira?: string }) {
  const [todos, atividade, movimentos] = await Promise.all([listarMateriaisDaArea(areaId), atividadeArea(areaId), movimentosRecentes(areaId, 6)]);
  const baixo = (m: MaterialEstoque) => precisaRepor(situacaoNivel(m.quantidade, m.minimo)) && (m.minimo ?? 0) > 0;
  const abaixo = todos.filter(baixo);

  const nomesGrupos = [...new Set(todos.map((m) => m.grupo ?? SEM_PRATELEIRA))];
  const termo = busca.trim().toLowerCase();
  const visiveis = todos.filter((m) => (!prateleira || (m.grupo ?? SEM_PRATELEIRA) === prateleira) && (!termo || `${m.nome} ${m.fabricante ?? ''} ${m.endereco ?? ''}`.toLowerCase().includes(termo)));
  const grupos = nomesGrupos
    .map((nome, i) => ({ nome, todos: todos.filter((m) => (m.grupo ?? SEM_PRATELEIRA) === nome), itens: visiveis.filter((m) => (m.grupo ?? SEM_PRATELEIRA) === nome), i }))
    .filter((g) => g.itens.length > 0);
  const href = (p: string) => `/admin/estoque?area=${encodeURIComponent(areaId)}${p ? `&prateleira=${encodeURIComponent(p)}` : ''}${busca ? `&q=${encodeURIComponent(busca)}` : ''}`;

  return (
    <div className="est-pagina">
      <TopoArea
        titulo={nomeArea}
        texto="Materiais arrumados por prateleira. Use + e − para lançar entrada ou baixa: fica tudo no histórico."
        areaId={areaId}
        rotuloNovo="Novo material"
      />

      <section aria-label="Totais" className="est-kpis">
        <Kpi rotulo="Materiais" valor={todos.length} nota={`Em ${nomesGrupos.length} ${nomesGrupos.length === 1 ? 'prateleira' : 'prateleiras'}`} />
        <Kpi rotulo="Abaixo do mínimo" valor={abaixo.length} nota={abaixo.length ? abaixo.map((m) => m.nome).join(' · ') : 'Tudo acima do mínimo'} tom={abaixo.length ? 'alerta' : undefined} />
        <Kpi rotulo="Entradas (7 dias)" valor={atividade.entradas} nota={atividade.ultimaEntrada ? `Última: ${atividade.ultimaEntrada.material}, ${quandoCurto(atividade.ultimaEntrada.quando)}` : 'Nenhuma ainda'} />
        <Kpi rotulo="Baixas (7 dias)" valor={atividade.baixas} nota={atividade.maisRetirado ? `Mais retirado: ${atividade.maisRetirado}` : 'Nenhuma na semana'} />
      </section>

      {todos.length === 0 ? (
        <section className="est-bloco">
          <EstadoVazio titulo="Nenhum material nesta área" texto='Toque em "Novo material" para começar. Informe a prateleira e a posição para achar rápido.' />
        </section>
      ) : (
        <div className="est-colunas">
          <div className="est-largo flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <nav aria-label="Filtrar por prateleira" className="est-chips">
                <Link href={href('')} className="est-chip" aria-current={!prateleira ? 'true' : undefined}>Todas</Link>
                {nomesGrupos.map((g) => (
                  <Link key={g} href={href(g)} className="est-chip" aria-current={prateleira === g ? 'true' : undefined}>{g}</Link>
                ))}
              </nav>
              <form method="get" role="search" className="relative ml-auto min-w-[200px] flex-[0_1_260px]">
                <input type="hidden" name="area" value={areaId} />
                {prateleira && <input type="hidden" name="prateleira" value={prateleira} />}
                <label htmlFor={`busca-${areaId}`} className="sr-only">Buscar material</label>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IconeBusca size={16} /></span>
                <input id={`busca-${areaId}`} name="q" type="search" defaultValue={busca} placeholder="Ex.: disco, luva, A-02" className="h-11 w-full pl-9" autoComplete="off" />
              </form>
            </div>

            {grupos.length === 0 && <p className="text-sm text-ink-muted">Nenhum material com esse filtro.</p>}
            {grupos.map((g) => (
              <section key={g.nome} className="est-prateleira" aria-labelledby={`prat-${g.i}`}>
                <div className="est-prateleira-cab">
                  <span className="est-letra">{letraDa(g.todos, g.i)}</span>
                  <h2 id={`prat-${g.i}`} className="est-h2">{g.nome}</h2>
                  <span className="text-sm text-ink-muted">{g.itens.length} {g.itens.length === 1 ? 'material' : 'materiais'}</span>
                </div>
                <div className="est-caixas">
                  {g.itens.map((m) => {
                    const b = baixo(m);
                    const acesos = gomosAcesos(m.quantidade, m.minimo);
                    const un = rotuloUnidade(m.unidade, null, m.quantidade);
                    return (
                      <article key={m.id} className={`est-caixa ${b ? 'est-caixa-baixo' : ''}`}>
                        <div className="est-etiqueta">
                          <span>{m.endereco ?? 'sem endereço'}</span>
                          <span>{b ? 'REPOR' : m.minimo ? 'OK' : ''}</span>
                        </div>
                        <div className="est-caixa-corpo">
                          <Link href={`/admin/estoque/material/${m.id}`} className="font-bold leading-snug text-ink hover:underline">{m.nome}</Link>
                          <div className="flex items-baseline gap-1.5">
                            <span className={`est-num text-3xl font-semibold ${b ? 'est-txt-warn' : ''}`}>{fmtNum(m.quantidade)}</span>
                            <span className="text-ink-muted">{un}</span>
                            <span className="ml-auto text-xs text-ink-muted">{m.minimo ? `mín. ${qtdTexto(m.minimo, m.unidade)}` : 'sem mínimo'}</span>
                          </div>
                          <div className="est-gomos" aria-hidden="true">
                            {Array.from({ length: 10 }, (_, k) => <span key={k} className={k < acesos ? 'on' : ''} />)}
                          </div>
                          <div className="mt-auto grid grid-cols-2 gap-2">
                            <MovimentoRapido materialId={m.id} nome={m.nome} unidade={rotuloUnidade(m.unidade)} tipo="BAIXA" sugestao={1} variante="botao" />
                            <MovimentoRapido materialId={m.id} nome={m.nome} unidade={rotuloUnidade(m.unidade)} tipo="ENTRADA" variante="botao" />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="est-tabua" aria-hidden="true" />
              </section>
            ))}
            <p className="text-xs text-ink-muted">Os 10 gomos vão até o dobro do mínimo: abaixo da metade, o material está abaixo do mínimo.</p>
          </div>

          <aside aria-labelledby={`mov-${areaId}`} className="est-bloco est-estreito">
            <h2 id={`mov-${areaId}`} className="est-h2">Movimentações</h2>
            <ListaMovimentos movimentos={movimentos} vazio="Nenhuma movimentação ainda." />
          </aside>
        </div>
      )}
      <LixeiraArea areaId={areaId} />
    </div>
  );
}
