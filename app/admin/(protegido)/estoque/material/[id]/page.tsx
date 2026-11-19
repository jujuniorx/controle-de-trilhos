import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormularioUsina } from '@/components/usina/FormularioUsina';
import { BotaoApagarRegistro } from '@/components/usina/BotaoApagarRegistro';
import { Kpi, SinalMovimento, dataBr, qtdTexto, quandoCurto, rotuloMovimento, variacaoTexto } from '@/components/estoque/comum';
import { buscarMaterial, fatoresPerfil, listarMovimentos } from '@/lib/services/estoqueAreas';
import {
  AREA_METROLOGIA,
  AREA_OLEO,
  AREA_TRILHOS,
  diaSP,
  diasRestantes,
  fmtNum,
  percentualDoMinimo,
  precisaRepor,
  rotuloUnidade,
  situacaoCalibracao,
  situacaoNivel,
  toneladasTrilho,
} from '@/lib/domain/estoque';
import {
  apagarMaterialEstoqueAction,
  atualizarMaterialEstoqueAction,
  registrarCalibracaoAction,
  registrarMovimentoEstoqueAction,
  restaurarMaterialEstoqueAction,
} from '../../areas-actions';

export const dynamic = 'force-dynamic';

const dec = (n: number | null) => (n == null ? '' : String(n).replace('.', ','));

/** Página de um item do estoque: saldo, movimentar, calibração, histórico e dados. */
export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const achado = await buscarMaterial(id);
  if (!achado) notFound();
  const m = achado as NonNullable<typeof achado>;
  const [historico, fatores] = await Promise.all([listarMovimentos(id, 60), fatoresPerfil()]);
  const un = rotuloUnidade(m.unidade, m.categoria);
  const nivel = situacaoNivel(m.quantidade, m.minimo);
  const baixo = precisaRepor(nivel) && (m.minimo ?? 0) > 0;
  const pct = percentualDoMinimo(m.quantidade, m.minimo);
  const voltar = `/admin/estoque?area=${encodeURIComponent(m.areaId)}`;
  const hoje = diaSP(new Date());
  const cal = situacaoCalibracao(m.calibracaoValidade, hoje);
  const t = m.areaId === AREA_TRILHOS ? toneladasTrilho({ ...m, fator: m.perfil ? fatores[m.perfil] ?? null : null }) : null;
  const dias = diasRestantes(m.quantidade, m.consumo30);

  let terceiro: { rotulo: string; valor: string; nota?: string; tom?: 'alerta' | 'grave' };
  if (m.areaId === AREA_TRILHOS) terceiro = { rotulo: 'Peso', valor: t != null ? `${t.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t` : '—', nota: m.perfil ? `${m.perfil} · ${fmtNum(fatores[m.perfil] ?? 0)} t/m` : undefined };
  else if (m.areaId === AREA_METROLOGIA) terceiro = {
    rotulo: 'Calibração',
    valor: m.calibracaoValidade ? dataBr(m.calibracaoValidade) : '—',
    nota: cal === 'vencida' ? 'Vencida: enviar para calibrar' : cal === 'vence' ? 'Vence em menos de 30 dias' : cal === 'emDia' ? 'Em dia' : 'Sem validade informada',
    tom: cal === 'vencida' ? 'grave' : cal === 'vence' ? 'alerta' : undefined,
  };
  else if (m.areaId === AREA_OLEO) terceiro = {
    rotulo: 'Dura mais',
    valor: dias != null ? `${dias} dias` : '—',
    nota: m.capacidade ? `Cabe ${qtdTexto(m.capacidade, m.unidade)}${m.embalagem ? ` (${m.embalagem})` : ''}` : 'Capacidade não informada',
    tom: dias != null && dias < 30 ? 'alerta' : undefined,
  };
  else terceiro = { rotulo: 'Onde fica', valor: m.endereco ?? '—', nota: m.grupo ?? 'Sem prateleira' };

  return (
    <div className="mx-auto mt-2 w-full max-w-7xl est-pagina">
      <section className="est-topo">
        <div className="min-w-0">
          <Link href={voltar} className="text-sm font-semibold text-ink-muted hover:underline">← {m.areaNome}</Link>
          <h1 className="est-h1 mt-2 break-words">{m.nome}</h1>
          <p className="est-sub">{[m.fabricante ?? 'Sem fabricante', m.grupo, m.endereco].filter(Boolean).join(' · ')}</p>
        </div>
      </section>

      {m.excluido && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={{ background: 'var(--err-bg)' }}>
          <p className="m-0 est-txt-err font-semibold">Este item está na lixeira da área.</p>
          <form action={restaurarMaterialEstoqueAction}>
            <input type="hidden" name="materialId" value={m.id} />
            <button type="submit" className="btn btn-primary h-11">Restaurar</button>
          </form>
        </div>
      )}

      <section aria-label="Situação" className="est-kpis">
        <Kpi rotulo="Saldo" valor={qtdTexto(m.quantidade, m.unidade, m.categoria)} nota={m.ultimo ? `Última: ${rotuloMovimento(m.ultimo.tipo).toLowerCase()} em ${quandoCurto(m.ultimo.criadoEm)}` : 'Sem movimentos'} tom={baixo ? 'alerta' : undefined} />
        <Kpi rotulo="Mínimo" valor={m.minimo ? qtdTexto(m.minimo, m.unidade, m.categoria) : '—'} nota={pct == null ? 'Defina em "Dados do item"' : baixo ? `Abaixo do mínimo · ${pct}%` : `${pct}% do mínimo`} />
        <Kpi rotulo={terceiro.rotulo} valor={terceiro.valor} nota={terceiro.nota} tom={terceiro.tom} />
        <Kpi rotulo="Baixas (30 dias)" valor={qtdTexto(m.consumo30, m.unidade, m.categoria)} nota={dias != null && m.areaId !== AREA_OLEO ? `No ritmo atual, dura ${dias} dias` : 'Saídas registradas no período'} />
      </section>

      {!m.excluido && (
        <section aria-labelledby="titulo-mov" className="est-bloco">
          <h2 id="titulo-mov" className="est-h2">Movimentar</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {(['ENTRADA', 'BAIXA', 'AJUSTE'] as const).map((tipo) => (
              <div key={tipo} className="rounded-2xl border border-line p-4">
                <p className="mb-3 font-bold">{tipo === 'ENTRADA' ? 'Entrada' : tipo === 'BAIXA' ? 'Baixa' : 'Ajuste (contagem)'}</p>
                <FormularioUsina acao={registrarMovimentoEstoqueAction} rotuloBotao={tipo === 'ENTRADA' ? 'Lançar entrada' : tipo === 'BAIXA' ? 'Lançar baixa' : 'Ajustar saldo'}>
                  <input type="hidden" name="materialId" value={m.id} />
                  <input type="hidden" name="tipo" value={tipo} />
                  <div className="field">
                    <label htmlFor={`q-${tipo}`}>{tipo === 'AJUSTE' ? `Quanto tem contado (${un})` : `Quantidade (${un})`}</label>
                    <input id={`q-${tipo}`} name="quantidade" inputMode="decimal" className="h-11 est-num" required autoComplete="off" />
                  </div>
                  {tipo === 'ENTRADA' && (
                    <div className="field">
                      <label htmlFor="nf-entrada">Nota fiscal (opcional)</label>
                      <input id="nf-entrada" name="documento" className="h-11" maxLength={40} autoComplete="off" />
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor={`mot-${tipo}`}>{tipo === 'ENTRADA' ? 'Observação (opcional)' : 'Motivo'}</label>
                    <input id={`mot-${tipo}`} name="motivo" className="h-11" required={tipo !== 'ENTRADA'} placeholder={tipo === 'BAIXA' ? 'Ex.: retirado para a Usina' : tipo === 'AJUSTE' ? 'Ex.: diferença na contagem' : ''} autoComplete="off" />
                  </div>
                </FormularioUsina>
              </div>
            ))}
          </div>
        </section>
      )}

      {m.areaId === AREA_METROLOGIA && !m.excluido && (
        <section id="calibracao" aria-labelledby="titulo-cal" className="est-bloco">
          <h2 id="titulo-cal" className="est-h2">Registrar calibração</h2>
          <p className="m-0 text-sm text-ink-muted">
            {m.calibradoEm ? `Última calibração em ${dataBr(m.calibradoEm)}, válida até ${dataBr(m.calibracaoValidade)}.` : 'Nenhuma calibração registrada.'} A nova calibração fica no histórico.
          </p>
          <FormularioUsina acao={registrarCalibracaoAction} rotuloBotao="Registrar calibração">
            <input type="hidden" name="materialId" value={m.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="field">
                <label htmlFor="cal-em">Calibrado em</label>
                <input id="cal-em" name="calibradoEm" type="date" className="h-11" defaultValue={hoje} required />
              </div>
              <div className="field">
                <label htmlFor="cal-ate">Vale até</label>
                <input id="cal-ate" name="calibracaoValidade" type="date" className="h-11" required />
              </div>
              <div className="field">
                <label htmlFor="cal-doc">Certificado (opcional)</label>
                <input id="cal-doc" name="documento" className="h-11" maxLength={40} autoComplete="off" />
              </div>
            </div>
          </FormularioUsina>
        </section>
      )}

      <section aria-labelledby="titulo-hist" className="est-bloco">
        <h2 id="titulo-hist" className="est-h2">Histórico</h2>
        {historico.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum movimento ainda.</p>
        ) : (
          <ol className="est-lista-mov">
            {historico.map((h) => (
              <li key={h.id}>
                <SinalMovimento tipo={h.tipo} />
                <div className="min-w-0">
                  <p className="font-semibold">{rotuloMovimento(h.tipo)}{h.documento ? <span className="font-normal text-ink-muted"> · {h.tipo === 'CALIBRACAO' ? 'certificado' : 'NF'} {h.documento}</span> : null}</p>
                  <p className="text-xs text-ink-muted">{[h.motivo, h.responsavel, quandoCurto(h.criadoEm)].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="text-right">
                  <p className={`est-num text-sm font-semibold ${h.tipo === 'ENTRADA' ? 'est-txt-ok' : ''}`}>{variacaoTexto({ ...h, unidade: m.unidade, categoria: m.categoria })}</p>
                  {h.tipo !== 'CALIBRACAO' && <p className="est-num text-xs text-ink-muted">saldo {qtdTexto(h.saldoApos, m.unidade, m.categoria)}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <details className="est-bloco">
        <summary className="cursor-pointer font-bold">Dados do item</summary>
        <div className="mt-2">
          <FormularioUsina acao={atualizarMaterialEstoqueAction} rotuloBotao="Salvar dados">
            <input type="hidden" name="materialId" value={m.id} />
            {m.areaId === AREA_TRILHOS ? (
              <>
                <input type="hidden" name="categoria" value={m.categoria ?? ''} />
                <input type="hidden" name="perfil" value={m.perfil ?? ''} />
                {m.furos != null && <input type="hidden" name="furos" value={m.furos} />}
                {m.comprimentoBarra != null && <input type="hidden" name="comprimentoBarra" value={dec(m.comprimentoBarra)} />}
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="field sm:col-span-2">
                  <label htmlFor="ed-nome">Nome</label>
                  <input id="ed-nome" name="nome" className="h-11" defaultValue={m.nome} required />
                </div>
                <div className="field">
                  <label htmlFor="ed-un">Unidade</label>
                  <select id="ed-un" name="unidade" className="h-11" defaultValue={m.unidade}>
                    {['un', 'par', 'kg', 'L', 'm'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="ed-grupo">{m.areaId === AREA_METROLOGIA ? 'Tipo' : 'Prateleira'}</label>
                  {m.areaId === AREA_METROLOGIA ? (
                    <select id="ed-grupo" name="grupo" className="h-11" defaultValue={m.grupo ?? 'Instrumentos de medição'}>
                      <option>Instrumentos de medição</option>
                      <option>Ferramentas e máquinas</option>
                    </select>
                  ) : (
                    <input id="ed-grupo" name="grupo" className="h-11" defaultValue={m.grupo ?? ''} />
                  )}
                </div>
                {m.areaId === AREA_OLEO ? (
                  <>
                    <div className="field">
                      <label htmlFor="ed-cap">Quanto cabe guardado ({m.unidade})</label>
                      <input id="ed-cap" name="capacidade" inputMode="decimal" className="h-11 est-num" defaultValue={dec(m.capacidade)} />
                    </div>
                    <div className="field">
                      <label htmlFor="ed-emb">Em quê</label>
                      <input id="ed-emb" name="embalagem" className="h-11" defaultValue={m.embalagem ?? ''} />
                    </div>
                  </>
                ) : m.areaId !== AREA_METROLOGIA ? (
                  <div className="field">
                    <label htmlFor="ed-end">Posição na prateleira</label>
                    <input id="ed-end" name="endereco" className="h-11 est-num" defaultValue={m.endereco ?? ''} maxLength={12} />
                  </div>
                ) : null}
              </div>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="ed-fab">Fabricante</label>
                <input id="ed-fab" name="fabricante" className="h-11" defaultValue={m.fabricante ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="ed-min">Estoque mínimo ({un})</label>
                <input id="ed-min" name="minimo" inputMode="decimal" className="h-11 est-num" defaultValue={dec(m.minimo)} />
              </div>
            </div>
          </FormularioUsina>
          {!m.excluido && (
            <div className="mt-4 border-t border-line pt-3 text-right">
              {m.quantidade === 0 ? (
                <BotaoApagarRegistro acao={apagarMaterialEstoqueAction} campos={{ materialId: m.id, areaId: m.areaId }} rotulo="Mandar para a lixeira" rotuloConfirmar="Toque de novo para mandar para a lixeira" />
              ) : (
                <p className="text-xs text-ink-muted">Para apagar, zere o saldo com um ajuste.</p>
              )}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
