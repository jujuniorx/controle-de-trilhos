import Link from 'next/link';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { listarMateriaisDaArea, movimentosRecentes, type MaterialEstoque } from '@/lib/services/estoqueAreas';
import { diasRestantes, fmtNum, precisaRepor, rotuloUnidade, situacaoNivel } from '@/lib/domain/estoque';
import { Kpi, ListaMovimentos, TopoArea, qtdTexto } from './comum';
import { LixeiraArea } from './LixeiraArea';
import { MovimentoRapido } from './MovimentoRapido';

/** Cor do líquido pelo tipo de produto, para achar na sala. */
const CORES: [RegExp, string][] = [
  [/hidr[aá]ulic/i, '#d9a441'],
  [/motor|15w|diesel/i, '#8a5a2b'],
  [/corte|sol[uú]vel/i, '#e6c27a'],
  [/graxa/i, '#c0a26a'],
  [/desengrax|solvente|limp/i, '#9fb4c7'],
  [/engrenag|transmiss/i, '#b9773a'],
];
const RESERVA = ['#d9a441', '#b9773a', '#c0a26a', '#9fb4c7', '#e6c27a', '#8a5a2b'];
function corDoLiquido(nome: string): string {
  const achou = CORES.find(([re]) => re.test(nome));
  if (achou) return achou[1];
  const h = [...nome].reduce((t, c) => t + c.charCodeAt(0), 0);
  return RESERVA[h % RESERVA.length];
}

/** Referência do tambor: a capacidade informada; sem ela, o maior entre o saldo e o dobro do mínimo. */
function referencia(m: MaterialEstoque): number {
  return m.capacidade && m.capacidade > 0 ? m.capacidade : Math.max(m.quantidade, (m.minimo ?? 0) * 2, 1);
}

/** Sala de Óleo: cada produto num tambor com o nível real, o mínimo e quantos dias ainda dá. */
export async function OleoEstoque({ areaId, nomeArea }: { areaId: string; nomeArea: string }) {
  const [todos, movimentos] = await Promise.all([listarMateriaisDaArea(areaId), movimentosRecentes(areaId, 6)]);
  const baixo = (m: MaterialEstoque) => precisaRepor(situacaoNivel(m.quantidade, m.minimo)) && (m.minimo ?? 0) > 0;
  const abaixo = todos.filter(baixo);
  const litros = todos.filter((m) => m.unidade === 'L');
  const outros = todos.filter((m) => m.unidade !== 'L');
  const totalL = litros.reduce((t, m) => t + m.quantidade, 0);
  const consumoL = litros.reduce((t, m) => t + m.consumo30, 0);
  const maisUsado = [...litros].sort((a, b) => b.consumo30 - a.consumo30)[0];
  const comDias = todos.map((m) => ({ m, dias: diasRestantes(m.quantidade, m.consumo30) })).filter((x) => x.dias != null).sort((a, b) => a.dias! - b.dias!);
  const primeiro = comDias[0];

  return (
    <div className="est-pagina">
      <TopoArea
        titulo={nomeArea}
        texto="Cada tambor mostra o nível do que está guardado. O sistema calcula por quantos dias ainda dá, pelo consumo dos últimos 30 dias."
        areaId={areaId}
        rotuloNovo="Novo produto"
      />

      <section aria-label="Totais" className="est-kpis">
        <Kpi rotulo="Óleos guardados" valor={`${fmtNum(totalL)} L`} nota={outros.length ? `Mais ${outros.map((m) => qtdTexto(m.quantidade, m.unidade)).join(' e ')} de ${outros.map((m) => m.nome.toLowerCase()).join(', ')}` : `${litros.length} produtos em litros`} />
        <Kpi rotulo="Abaixo do mínimo" valor={abaixo.length} nota={abaixo.length ? abaixo.map((m) => m.nome).join(' · ') : 'Tudo acima do mínimo'} tom={abaixo.length ? 'alerta' : undefined} />
        <Kpi rotulo="Acaba primeiro" valor={primeiro ? `${primeiro.dias} dias` : '—'} nota={primeiro ? primeiro.m.nome : 'Sem baixas nos últimos 30 dias para prever'} tom={primeiro && primeiro.dias! < 30 ? 'alerta' : undefined} />
        <Kpi rotulo="Consumo (30 dias)" valor={`${fmtNum(consumoL)} L`} nota={maisUsado && maisUsado.consumo30 > 0 ? `Mais usado: ${maisUsado.nome}` : 'Nenhuma baixa no período'} />
      </section>

      {todos.length === 0 ? (
        <section className="est-bloco">
          <EstadoVazio titulo="Nenhum produto cadastrado" texto='Toque em "Novo produto" e informe quanto cabe guardado (o tamanho do tambor ou balde).' />
        </section>
      ) : (
        <div className="est-colunas">
          <section aria-labelledby="titulo-tambores" className="est-largo flex flex-col gap-3.5">
            <h2 id="titulo-tambores" className="est-h2">Tambores e baldes</h2>
            <div className="est-tambores">
              {todos.map((m) => {
                const b = baixo(m);
                const ref = referencia(m);
                const pct = Math.max(0, Math.min(100, Math.round((m.quantidade / ref) * 100)));
                const minPct = m.minimo ? Math.min(100, Math.round((m.minimo / ref) * 100)) : null;
                const dias = diasRestantes(m.quantidade, m.consumo30);
                const cor = corDoLiquido(m.nome);
                const un = rotuloUnidade(m.unidade);
                const passo = m.unidade === 'L' ? (ref >= 200 ? 20 : 5) : 1;
                return (
                  <article key={m.id} className={`est-tambor-card ${b ? 'est-tambor-card-baixo' : ''}`}>
                    <div className="est-tambor" role="img" aria-label={`${m.nome}: ${qtdTexto(m.quantidade, m.unidade)} de ${qtdTexto(ref, m.unidade)}`}>
                      <div className="est-liquido" style={{ height: `${pct}%`, background: `linear-gradient(180deg, ${cor}, ${cor}cc 60%, ${cor}88)` }} />
                      <div className="est-aro" style={{ top: '33%' }} />
                      <div className="est-aro" style={{ top: '66%' }} />
                      {minPct != null && <div className="est-tambor-min" style={{ bottom: `${minPct}%` }} />}
                      <div className="est-tambor-pct">{pct}%</div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <Link href={`/admin/estoque/material/${m.id}`} className="font-bold leading-snug text-ink hover:underline">{m.nome}</Link>
                      <div className="flex flex-wrap items-baseline gap-1.5">
                        <span className={`est-num text-3xl font-semibold ${b ? 'est-txt-warn' : ''}`}>{fmtNum(m.quantidade)} {un}</span>
                        <span className="text-xs text-ink-muted">
                          {m.capacidade ? `de ${qtdTexto(m.capacidade, m.unidade)}${m.embalagem ? ` (${m.embalagem})` : ''}` : 'capacidade não informada'}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted">
                        {m.minimo ? `Mínimo ${qtdTexto(m.minimo, m.unidade)}` : 'Sem mínimo'} · saiu {qtdTexto(m.consumo30, m.unidade)} em 30 dias
                      </p>
                      <p className={`text-sm font-bold ${dias == null ? 'text-ink-muted' : dias < 30 ? 'est-txt-warn' : 'est-txt-ok'}`}>
                        {m.quantidade <= 0 ? 'Acabou' : dias == null ? 'Sem consumo recente para prever' : `Dá para mais ${dias} dias`}
                      </p>
                      <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
                        <MovimentoRapido materialId={m.id} nome={m.nome} unidade={un} tipo="BAIXA" sugestao={passo} variante="botao" />
                        <MovimentoRapido materialId={m.id} nome={m.nome} unidade={un} tipo="ENTRADA" variante="botao" />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="text-xs text-ink-muted">Linha tracejada = mínimo. A cor do líquido ajuda a achar o produto na sala.</p>
          </section>
          <aside aria-labelledby="titulo-mov-oleo" className="est-bloco est-estreito">
            <h2 id="titulo-mov-oleo" className="est-h2">Movimentações</h2>
            <ListaMovimentos movimentos={movimentos} vazio="Nenhuma movimentação ainda." />
          </aside>
        </div>
      )}
      <LixeiraArea areaId={areaId} />
    </div>
  );
}
