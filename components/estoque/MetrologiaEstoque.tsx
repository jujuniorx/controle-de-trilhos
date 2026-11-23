import Link from 'next/link';
import type { ComponentType } from 'react';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import {
  IconeEsmerilhadeira,
  IconeFerramenta,
  IconeNivel,
  IconePaquimetro,
  IconeRegua,
  IconeRetifica,
  IconeTermometro,
  IconeTrena,
} from '@/components/icones/Icones';
import { listarMateriaisDaArea, movimentosRecentes, type MaterialEstoque } from '@/lib/services/estoqueAreas';
import { diaSP, precisaRepor, situacaoCalibracao, situacaoNivel, type SituacaoCalibracao } from '@/lib/domain/estoque';
import { Kpi, ListaMovimentos, TopoArea, dataBr, mesAnoBr, qtdTexto } from './comum';
import { LixeiraArea } from './LixeiraArea';

export const GRUPO_MEDICAO = 'Instrumentos de medição';
export const GRUPO_FERRAMENTAS = 'Ferramentas e máquinas';

/** O que cada grupo do painel quer dizer, para quem registra e para quem consulta. */
const DESCRICAO_GRUPO: Record<string, string> = {
  [GRUPO_MEDICAO]: 'Réguas, paquímetros, trenas, níveis e termômetros. Têm calibração: a validade fica à vista.',
  [GRUPO_FERRAMENTAS]: 'Esmerilhadeira, retífica e outras ferramentas e máquinas. Não têm calibração.',
};

/** Desenho do instrumento pelo nome. Nome que não casa com nenhum fica com a chave. */
const ICONES: [RegExp, ComponentType<{ size?: number; strokeWidth?: number }>][] = [
  [/r[eé]gua/i, IconeRegua],
  [/paqu[ií]metro/i, IconePaquimetro],
  [/term[oô]metro|pir[oô]metro/i, IconeTermometro],
  [/n[ií]vel/i, IconeNivel],
  [/trena/i, IconeTrena],
  [/esmeril|lixadeira|gws/i, IconeEsmerilhadeira],
  [/ret[ií]fica/i, IconeRetifica],
];
function IconeInstrumento({ nome }: { nome: string }) {
  const Icone = ICONES.find(([re]) => re.test(nome))?.[1] ?? IconeFerramenta;
  return <Icone size={60} strokeWidth={1.3} />;
}

const SELO: Record<SituacaoCalibracao, string> = { nenhuma: '', emDia: 'est-selo-ok', vence: 'est-selo-warn', vencida: 'est-selo-err' };

function textoCalibracao(m: MaterialEstoque, s: SituacaoCalibracao): string {
  if (s === 'vencida') return `Vencida desde ${mesAnoBr(m.calibracaoValidade)}`;
  if (s === 'vence') return `Vence ${dataBr(m.calibracaoValidade)}`;
  if (s === 'emDia') return `Calibrado até ${mesAnoBr(m.calibracaoValidade)}`;
  return m.grupo === GRUPO_FERRAMENTAS ? 'Ferramenta' : 'Sem calibração';
}

/** Metrologia e Materiais: instrumentos e ferramentas num painel perfurado, com a calibração à vista. */
export async function MetrologiaEstoque({ areaId, nomeArea, filtro = '' }: { areaId: string; nomeArea: string; filtro?: string }) {
  const [todos, movimentos] = await Promise.all([listarMateriaisDaArea(areaId), movimentosRecentes(areaId, 5)]);
  const hoje = diaSP(new Date());
  const cal = new Map(todos.map((m) => [m.id, situacaoCalibracao(m.calibracaoValidade, hoje)]));
  const baixo = (m: MaterialEstoque) => precisaRepor(situacaoNivel(m.quantidade, m.minimo)) && (m.minimo ?? 0) > 0;
  const atencao = (m: MaterialEstoque) => baixo(m) || cal.get(m.id) === 'vencida' || cal.get(m.id) === 'vence';

  const vencidas = todos.filter((m) => cal.get(m.id) === 'vencida');
  const vencendo = todos.filter((m) => cal.get(m.id) === 'vence');
  const abaixo = todos.filter(baixo);
  const medicao = todos.filter((m) => m.grupo !== GRUPO_FERRAMENTAS).length;

  const lista = todos.filter((m) => (filtro === 'atencao' ? atencao(m) : filtro === 'medicao' ? m.grupo !== GRUPO_FERRAMENTAS : true));
  const nomesGrupos = [...new Set(lista.map((m) => m.grupo ?? GRUPO_MEDICAO))].sort((a, b) => (a === GRUPO_FERRAMENTAS ? 1 : b === GRUPO_FERRAMENTAS ? -1 : a.localeCompare(b)));
  const agenda = todos.filter((m) => m.calibracaoValidade).sort((a, b) => (a.calibracaoValidade! < b.calibracaoValidade! ? -1 : 1));
  const href = (f: string) => `/admin/estoque?area=${encodeURIComponent(areaId)}${f ? `&filtro=${f}` : ''}`;

  return (
    <div className="est-pagina">
      <TopoArea
        titulo={nomeArea}
        texto="Aqui ficam os instrumentos de medição, que precisam de calibração em dia, e as ferramentas e máquinas da sala. O registro desta sala é feito pelo Félix."
        areaId={areaId}
        rotuloNovo="Novo instrumento"
      />

      <section aria-label="Totais" className="est-kpis">
        <Kpi rotulo="Itens" valor={todos.length} nota={`${medicao} de medição · ${todos.length - medicao} ferramentas`} />
        <Kpi rotulo="Calibração vencida" valor={vencidas.length} nota={vencidas.length ? vencidas.map((m) => m.nome).join(' · ') : 'Nenhuma vencida'} tom={vencidas.length ? 'grave' : undefined} />
        <Kpi rotulo="Vence em 30 dias" valor={vencendo.length} nota={vencendo.length ? vencendo.map((m) => `${m.nome} · ${dataBr(m.calibracaoValidade)}`).join(' · ') : 'Nada para os próximos 30 dias'} tom={vencendo.length ? 'alerta' : undefined} />
        <Kpi rotulo="Abaixo do mínimo" valor={abaixo.length} nota={abaixo.length ? abaixo.map((m) => `${m.nome}: ${qtdTexto(m.quantidade, m.unidade)} de ${qtdTexto(m.minimo ?? 0, m.unidade)}`).join(' · ') : 'Tudo acima do mínimo'} tom={abaixo.length ? 'alerta' : undefined} />
      </section>

      {todos.length === 0 ? (
        <section className="est-bloco">
          <EstadoVazio titulo="Nenhum instrumento cadastrado" texto='Toque em "Novo instrumento" e informe a validade da calibração.' />
        </section>
      ) : (
        <div className="est-colunas">
          <section aria-labelledby="titulo-painel" className="est-painel est-largo">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <h2 id="titulo-painel" className="est-h2">Painel de ferramentas</h2>
              <nav aria-label="Filtrar" className="est-chips">
                <Link href={href('')} className="est-chip" aria-current={!filtro ? 'true' : undefined}>Todos <span className="est-chip-qtd">{todos.length}</span></Link>
                <Link href={href('medicao')} className="est-chip" aria-current={filtro === 'medicao' ? 'true' : undefined}>Medição <span className="est-chip-qtd">{medicao}</span></Link>
                <Link href={href('atencao')} className="est-chip" aria-current={filtro === 'atencao' ? 'true' : undefined}>Precisa de atenção <span className="est-chip-qtd">{todos.filter(atencao).length}</span></Link>
              </nav>
            </div>
            {lista.length === 0 && <p className="text-sm text-ink-muted">Nada aqui com esse filtro.</p>}
            {nomesGrupos.map((g) => (
              <div key={g} className="flex flex-col gap-2.5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[.1em] text-ink-muted">{g}</h3>
                  {DESCRICAO_GRUPO[g] && <p className="text-xs text-ink-muted">{DESCRICAO_GRUPO[g]}</p>}
                </div>
                <div className="est-ferramentas">
                  {lista.filter((m) => (m.grupo ?? GRUPO_MEDICAO) === g).map((m) => {
                    const s = cal.get(m.id) ?? 'nenhuma';
                    const b = baixo(m);
                    return (
                      <Link key={m.id} href={`/admin/estoque/material/${m.id}`} className={`est-ferramenta ${s === 'vencida' ? 'est-ferramenta-vencida' : s === 'vence' ? 'est-ferramenta-vence' : ''}`}>
                        <IconeInstrumento nome={m.nome} />
                        <span className="font-bold leading-tight">{m.nome}</span>
                        <span className={`est-num text-sm ${b ? 'est-txt-warn' : 'text-ink-muted'}`}>
                          {qtdTexto(m.quantidade, m.unidade)}{b && m.minimo ? ` · mín. ${qtdTexto(m.minimo, m.unidade)}` : ''}
                        </span>
                        <span className={`est-selo ${SELO[s]}`}>{textoCalibracao(m, s)}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          <div className="est-estreito flex flex-col gap-4">
            <aside aria-labelledby="titulo-agenda" className="est-bloco">
              <h2 id="titulo-agenda" className="est-h2">Agenda de calibração</h2>
              {agenda.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhum instrumento com validade de calibração. Informe a validade ao cadastrar ou na página do instrumento.</p>
              ) : (
                <ol className="est-agenda">
                  {agenda.map((m) => {
                    const s = cal.get(m.id) ?? 'nenhuma';
                    const cor = s === 'vencida' ? 'var(--err)' : s === 'vence' ? 'var(--warn)' : 'var(--ok)';
                    return (
                      <li key={m.id} style={{ ['--cor' as string]: cor }}>
                        <p className="est-num text-sm font-semibold" style={{ color: cor }}>
                          {dataBr(m.calibracaoValidade)}{s === 'vencida' ? ' · vencida' : s === 'vence' ? ' · vence logo' : ''}
                        </p>
                        <Link href={`/admin/estoque/material/${m.id}#calibracao`} className="font-bold text-ink hover:underline">{m.nome}</Link>
                        <p className="text-xs text-ink-muted">{m.calibradoEm ? `Última calibração em ${dataBr(m.calibradoEm)}` : 'Sem data da última calibração'}</p>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="text-xs text-ink-muted">Para registrar uma calibração, abra o instrumento.</p>
            </aside>
            <aside aria-labelledby="titulo-mov-metro" className="est-bloco">
              <h2 id="titulo-mov-metro" className="est-h2">Movimentações</h2>
              <ListaMovimentos movimentos={movimentos} vazio="Nenhuma movimentação ainda." />
            </aside>
          </div>
        </div>
      )}
      <LixeiraArea areaId={areaId} />
    </div>
  );
}
