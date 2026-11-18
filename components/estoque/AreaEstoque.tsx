import { FormularioUsina } from '@/components/usina/FormularioUsina';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { BotaoApagarRegistro } from '@/components/usina/BotaoApagarRegistro';
import {
  listarMateriaisApagadosDaArea,
  listarMateriaisDaArea,
  listarMovimentos,
  UNIDADES_MATERIAL,
  type MovimentoEstoque,
} from '@/lib/services/estoqueAreas';
import {
  apagarMaterialEstoqueAction,
  criarMaterialEstoqueAction,
  registrarMovimentoEstoqueAction,
  restaurarMaterialEstoqueAction,
} from '@/app/admin/(protegido)/estoque/areas-actions';

const ROTULO_TIPO: Record<string, string> = { ENTRADA: 'Entrada', BAIXA: 'Baixa', AJUSTE: 'Ajuste' };

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function quantidadeFmt(v: number, unidade: string): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unidade}`;
}

function sinal(m: MovimentoEstoque): string {
  if (m.tipo === 'ENTRADA') return `+${m.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}`;
  if (m.tipo === 'BAIXA') return `-${m.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}`;
  return `= ${m.saldoApos.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}`;
}

/** Uma área do estoque (Almoxarifado, Sala de Metrologia e Materiais, Sala de Óleo): materiais, saldos e movimentos. */
export async function AreaEstoque({ areaId, nomeArea }: { areaId: string; nomeArea: string }) {
  const materiais = await listarMateriaisDaArea(areaId);
  const historicos = await Promise.all(materiais.map((m) => listarMovimentos(m.id, 8)));
  const apagados = await listarMateriaisApagadosDaArea(areaId);

  return (
    <section className="space-y-6" aria-labelledby={`area-${areaId}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`area-${areaId}`} className="section-title">{nomeArea}</h2>
          <p className="text-sm text-ink-muted">
            {materiais.length === 0
              ? 'Nenhum material cadastrado nesta área ainda.'
              : `${materiais.length} ${materiais.length === 1 ? 'material' : 'materiais'} nesta área. Registre entradas quando chegar, e baixas quando retirar.`}
          </p>
        </div>
      </div>

      <details className="card">
        <summary className="cursor-pointer font-semibold">Cadastrar material nesta área</summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-ink-muted">Informe o nome, a unidade e a quantidade que existe hoje. O saldo inicial fica registrado no histórico.</p>
          <FormularioUsina acao={criarMaterialEstoqueAction} rotuloBotao="Cadastrar">
            <input type="hidden" name="areaId" value={areaId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="field">
                <label htmlFor={`nome-${areaId}`}>Material</label>
                <input id={`nome-${areaId}`} name="nome" className="h-11" placeholder="Ex.: Lixa 80" required />
              </div>
              <div className="field">
                <label htmlFor={`un-${areaId}`}>Unidade</label>
                <select id={`un-${areaId}`} name="unidade" defaultValue="un" className="h-11">
                  {UNIDADES_MATERIAL.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`fab-${areaId}`}>Fabricante</label>
                <input id={`fab-${areaId}`} name="fabricante" className="h-11" />
              </div>
              <div className="field">
                <label htmlFor={`ini-${areaId}`}>Quantidade inicial</label>
                <input id={`ini-${areaId}`} name="quantidadeInicial" inputMode="decimal" placeholder="0" className="h-11" />
                <p className="text-xs text-ink-muted">Use vírgula para decimais. Se não souber, deixe em branco.</p>
              </div>
            </div>
          </FormularioUsina>
        </div>
      </details>

      {materiais.length === 0 ? (
        <EstadoVazio titulo="Nenhum material nesta área" texto="Use Cadastrar material nesta área para começar." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {materiais.map((m, i) => (
            <article key={m.id} className="card space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{m.nome}</p>
                  <p className="text-xs text-ink-muted">{m.fabricante ?? 'Fabricante não informado'}</p>
                </div>
                <div className="text-right">
                  <p className="kv-label">Saldo</p>
                  <p className="text-2xl font-semibold tabular-nums text-accent">{quantidadeFmt(m.quantidade, m.unidade)}</p>
                </div>
              </div>

              <div className="grid gap-2">
                {(['ENTRADA', 'BAIXA', 'AJUSTE'] as const).map((tipo) => (
                  <details key={tipo} className="group">
                    <summary className="btn btn-ghost h-11 w-full cursor-pointer justify-center">{`Registrar ${ROTULO_TIPO[tipo].toLowerCase()}`}</summary>
                    <div className="mt-3 space-y-3">
                      <FormularioUsina acao={registrarMovimentoEstoqueAction} rotuloBotao={`Registrar ${ROTULO_TIPO[tipo].toLowerCase()}`}>
                        <input type="hidden" name="materialId" value={m.id} />
                        <input type="hidden" name="tipo" value={tipo} />
                        <div className="grid gap-3">
                          <div className="field">
                            <label htmlFor={`q-${m.id}-${tipo}`}>
                              {tipo === 'AJUSTE' ? `Contagem atual (${m.unidade})` : `Quantidade (${m.unidade})`}
                            </label>
                            <input id={`q-${m.id}-${tipo}`} name="quantidade" inputMode="decimal" placeholder="0" className="h-11" required />
                          </div>
                          {tipo === 'ENTRADA' && (
                            <div className="field">
                              <label htmlFor={`d-${m.id}`}>Nota fiscal (opcional)</label>
                              <input id={`d-${m.id}`} name="documento" className="h-11" />
                            </div>
                          )}
                          <div className="field">
                            <label htmlFor={`mo-${m.id}-${tipo}`}>
                              {tipo === 'BAIXA' ? 'Motivo (obrigatório)' : tipo === 'AJUSTE' ? 'Motivo do ajuste (obrigatório)' : 'Observação'}
                            </label>
                            <input id={`mo-${m.id}-${tipo}`} name="motivo" className="h-11" placeholder={tipo === 'BAIXA' ? 'Ex.: retirado para corte' : tipo === 'AJUSTE' ? 'Ex.: diferença na contagem' : ''} />
                          </div>
                        </div>
                      </FormularioUsina>
                    </div>
                  </details>
                ))}
              </div>

              <details>
                <summary className="cursor-pointer text-sm font-semibold text-accent">Histórico</summary>
                {historicos[i].length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">Nenhum movimento ainda.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-line text-sm">
                    {historicos[i].map((h) => (
                      <li key={h.id} className="flex items-start justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {ROTULO_TIPO[h.tipo] ?? h.tipo}
                            {h.documento ? <span className="font-normal text-ink-muted"> · NF {h.documento}</span> : null}
                          </p>
                          <p className="truncate text-xs text-ink-muted">{h.motivo ?? 'Sem motivo'} · {h.responsavel}</p>
                          <p className="text-xs text-ink-muted">{dataHora(h.criadoEm)}</p>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <p className="font-semibold">{sinal(h)}</p>
                          <p className="text-xs text-ink-muted">saldo {h.saldoApos.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </details>

              <div className="border-t border-line pt-3 text-right">
                {m.quantidade === 0 ? (
                  <BotaoApagarRegistro acao={apagarMaterialEstoqueAction} campos={{ materialId: m.id }} rotulo="Apagar material" rotuloConfirmar="Toque de novo para mandar para a lixeira" />
                ) : (
                  <p className="text-xs text-ink-muted">Zere o saldo para poder apagar este material.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {apagados.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Lixeira desta área ({apagados.length})</summary>
          <ul className="mt-4 divide-y divide-line">
            {apagados.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{m.nome}</p>
                  <p className="text-xs text-ink-muted">{m.unidade} · {m.fabricante ?? 'Fabricante não informado'}</p>
                </div>
                <form action={restaurarMaterialEstoqueAction}>
                  <input type="hidden" name="materialId" value={m.id} />
                  <button type="submit" className="btn btn-ghost h-11">Restaurar</button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
