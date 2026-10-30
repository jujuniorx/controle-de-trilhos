import { ContadorNumero } from '@/components/admin/ContadorNumero';
import { fmtToneladas } from '@/lib/format';
import { BarraEstoque } from '@/components/estoque/BarraEstoque';
import { FormularioUsina } from '@/components/usina/FormularioUsina';
import { BotaoApagarRegistro } from '@/components/usina/BotaoApagarRegistro';
import { listarEstoque, ROTULO_TIPO_ESTOQUE, TIPOS_ESTOQUE, type ItemEstoque, type TipoEstoque } from '@/lib/services/estoque';
import { salvarItemEstoqueAction, excluirItemEstoqueAction } from './actions';

export const dynamic = 'force-dynamic';

const COR_TIPO: Record<TipoEstoque, string> = { PERFIL: '#3b82f6', TALA: '#f97316', LISA: '#10b981' };

const fmtM = (v: number) => fmtToneladas(v);

function Campos({ item, tipoFixo }: { item?: ItemEstoque; tipoFixo?: TipoEstoque }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      {!tipoFixo && (
        <div className="field">
          <label htmlFor={`tipo-${item?.id ?? 'novo'}`}>Tipo</label>
          <select id={`tipo-${item?.id ?? 'novo'}`} name="tipo" defaultValue={item?.tipo ?? 'PERFIL'} className="h-11">
            {TIPOS_ESTOQUE.map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO_ESTOQUE[t]}</option>
            ))}
          </select>
        </div>
      )}
      {tipoFixo && <input type="hidden" name="tipo" value={tipoFixo} />}
      <div className="field">
        <label htmlFor={`nome-${item?.id ?? 'novo'}`}>Nome</label>
        <input id={`nome-${item?.id ?? 'novo'}`} name="nome" defaultValue={item?.nome ?? ''} className="h-11" placeholder={tipoFixo === 'TALA' ? 'Ex.: Tala 6 furos' : tipoFixo === 'LISA' ? 'Ex.: Barra lisa 9 m' : 'Ex.: TR68'} required />
      </div>
      <div className="field">
        <label htmlFor={`fab-${item?.id ?? 'novo'}`}>Fabricante</label>
        <input id={`fab-${item?.id ?? 'novo'}`} name="fabricante" defaultValue={item?.fabricante ?? ''} className="h-11" />
      </div>
      <div className="field">
        <label htmlFor={`t-${item?.id ?? 'novo'}`}>Quantidade (t)</label>
        <input id={`t-${item?.id ?? 'novo'}`} name="quantidadeT" inputMode="decimal" defaultValue={item ? String(item.quantidadeT).replace('.', ',') : ''} placeholder="0" className="h-11" />
      </div>
      <div className="field">
        <label htmlFor={`m-${item?.id ?? 'novo'}`}>Quantidade (m)</label>
        <input id={`m-${item?.id ?? 'novo'}`} name="quantidadeM" inputMode="decimal" defaultValue={item ? String(item.quantidadeM).replace('.', ',') : ''} placeholder="0" className="h-11" />
      </div>
    </div>
  );
}

export default async function EstoquePage() {
  const itens = await listarEstoque();
  const totalT = itens.reduce((t, i) => t + i.quantidadeT, 0);
  const totalM = itens.reduce((t, i) => t + i.quantidadeM, 0);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8">
      <header className="page-header">
        <div>
          <h1 className="page-title">Estoque</h1>
          <p className="text-sm text-ink-muted">Perfis, talas e barras lisas. Só o Administrativo altera as quantidades.</p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="kv-label">Itens cadastrados</p>
          <p className="text-2xl font-semibold tabular-nums">{itens.length}</p>
        </div>
        <div className="card">
          <p className="kv-label">Total em toneladas</p>
          <p className="text-2xl font-semibold tabular-nums text-accent">
            <ContadorNumero valor={totalT} /> t
          </p>
        </div>
        <div className="card">
          <p className="kv-label">Total em metros</p>
          <p className="text-2xl font-semibold tabular-nums">{fmtM(totalM)} m</p>
        </div>
      </section>

      <details className="card">
        <summary className="cursor-pointer font-semibold">Adicionar item ao estoque</summary>
        <div className="mt-4">
          <FormularioUsina acao={salvarItemEstoqueAction} rotuloBotao="Adicionar">
            <Campos />
          </FormularioUsina>
        </div>
      </details>

      {TIPOS_ESTOQUE.map((tipo) => {
        const grupo = itens.filter((i) => i.tipo === tipo);
        const maxT = Math.max(0, ...grupo.map((i) => i.quantidadeT));
        return (
          <section key={tipo} className="space-y-4" aria-labelledby={`estoque-${tipo}`}>
            <h2 id={`estoque-${tipo}`} className="section-title">{ROTULO_TIPO_ESTOQUE[tipo]}</h2>
            {grupo.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhum item cadastrado ainda.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {grupo.map((item) => {
                  const pct = maxT > 0 ? (item.quantidadeT / maxT) * 100 : 0;
                  return (
                    <article key={item.id} className="card space-y-3" style={{ borderTop: `3px solid ${COR_TIPO[tipo]}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-ink">{item.nome}</p>
                          <p className="text-xs text-ink-muted">{item.fabricante ?? 'Fabricante não informado'}</p>
                        </div>
                      </div>
                      <BarraEstoque percentual={pct} cor={COR_TIPO[tipo]} />
                      <dl className="grid grid-cols-2 gap-2 text-sm tabular-nums">
                        <div>
                          <dt className="kv-label">Toneladas</dt>
                          <dd className="font-semibold">{fmtM(item.quantidadeT)} t</dd>
                        </div>
                        <div>
                          <dt className="kv-label">Metros</dt>
                          <dd className="font-semibold">{fmtM(item.quantidadeM)} m</dd>
                        </div>
                      </dl>
                      <details>
                        <summary className="cursor-pointer text-sm font-semibold text-accent">Editar</summary>
                        <div className="mt-3 space-y-3">
                          <FormularioUsina acao={salvarItemEstoqueAction} rotuloBotao="Salvar">
                            <Campos item={item} tipoFixo={tipo} />
                          </FormularioUsina>
                          <div className="flex justify-end">
                            <BotaoApagarRegistro acao={excluirItemEstoqueAction} campos={{ id: item.id }} />
                          </div>
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
