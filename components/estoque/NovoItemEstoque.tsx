'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { criarMaterialEstoqueAction, type ResultadoCadastro } from '@/app/admin/(protegido)/estoque/areas-actions';
import { IconeBarraLisa, IconeSecaoTrilho, IconeTala } from '@/components/icones/Icones';
import {
  AREA_METROLOGIA,
  AREA_OLEO,
  AREA_TRILHOS,
  PERFIS_ESTOQUE,
  ROTULO_CATEGORIA,
  lerNumero,
  nomeItemTrilho,
  type CategoriaTrilho,
} from '@/lib/domain/estoque';

export interface ItemExistente {
  id: string;
  nome: string;
  fabricante: string | null;
  saldo: string;
}

const GRUPO_MEDICAO = 'Instrumentos de medição';
const GRUPO_FERRAMENTAS = 'Ferramentas e máquinas';
const fmt = (n: number, casas: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

function Passo({ n, children }: { n: number; children: ReactNode }) {
  return (
    <legend className="mb-2.5 flex items-center gap-2.5 font-bold">
      <span className="est-passo">{n}</span>
      {children}
    </legend>
  );
}

/** Cadastro de item no estoque. Os campos mudam conforme a área. */
export function NovoItemEstoque({
  areaId,
  areaNome,
  fatores,
  existentes,
  grupos,
  fabricantes,
}: {
  areaId: string;
  areaNome: string;
  fatores: Record<string, number>;
  existentes: ItemExistente[];
  grupos: string[];
  fabricantes: string[];
}) {
  const router = useRouter();
  const acaoSegura = async (anterior: ResultadoCadastro | undefined, fd: FormData): Promise<ResultadoCadastro> => {
    try {
      return await criarMaterialEstoqueAction(anterior, fd);
    } catch {
      return { ok: false, erro: 'Não foi salvo: a tela está desatualizada. Recarregue a página (F5) e tente de novo.' };
    }
  };
  const [estado, acao, pendente] = useActionState(acaoSegura, undefined);
  useEffect(() => {
    if (estado?.ok) router.push(`/admin/estoque?area=${encodeURIComponent(areaId)}`);
  }, [estado, areaId, router]);

  const trilhos = areaId === AREA_TRILHOS;
  const metrologia = areaId === AREA_METROLOGIA;
  const oleo = areaId === AREA_OLEO;

  // Trilhos
  const [categoria, setCategoria] = useState<CategoriaTrilho>('PERFIL');
  const [perfil, setPerfil] = useState<string>('TR68');
  const [furos, setFuros] = useState('6');
  const [comprimento, setComprimento] = useState('12');
  const [modo, setModo] = useState<'m' | 't'>('m');
  // Comum
  const [fabricante, setFabricante] = useState('');
  const [qtd, setQtd] = useState('');
  const [nome, setNome] = useState('');
  const [tipoMetro, setTipoMetro] = useState(GRUPO_MEDICAO);
  const [duplicar, setDuplicar] = useState(false);

  const fator = fatores[perfil] ?? null;
  const q = lerNumero(qtd) ?? 0;
  const qOk = Number.isFinite(q) ? q : 0;
  const comp = lerNumero(comprimento) ?? 0;
  const nomeFinal = trilhos
    ? nomeItemTrilho({ categoria, perfil, furos: categoria === 'TALA' ? Number(furos) : null, comprimentoBarra: categoria === 'LISA' && Number.isFinite(comp) ? comp : null })
    : nome.trim();
  const fabNorm = fabricante.trim().toLocaleUpperCase('pt-BR');
  const igual = nomeFinal
    ? existentes.find((e) => e.nome.toLowerCase() === nomeFinal.toLowerCase() && (e.fabricante ?? '').toLocaleUpperCase('pt-BR') === fabNorm)
    : undefined;

  let conta: { linha: string; resultado: string } | null = null;
  if (trilhos && categoria === 'PERFIL' && fator) {
    conta = modo === 'm'
      ? { linha: `${fmt(qOk, 0)} m × ${fmt(fator, 3)} t/m`, resultado: `= ${fmt(qOk * fator, 1)} t` }
      : { linha: `${fmt(qOk, 1)} t ÷ ${fmt(fator, 3)} t/m`, resultado: `= ${fmt(qOk / fator, 0)} m` };
  } else if (trilhos && categoria === 'LISA' && fator && comp > 0) {
    conta = { linha: `${fmt(qOk, 0)} barras × ${fmt(comp, 1)} m × ${fmt(fator, 3)} t/m`, resultado: `= ${fmt(qOk * comp, 0)} m · ${fmt(qOk * comp * fator, 1)} t` };
  }

  const unidadeTrilho = categoria === 'PERFIL' ? (modo === 'm' ? 'metros' : 'toneladas') : categoria === 'TALA' ? 'pares' : 'barras';
  const voltar = `/admin/estoque?area=${encodeURIComponent(areaId)}`;

  return (
    <form action={acao} className="est-bloco mx-auto w-full max-w-2xl gap-6">
      <input type="hidden" name="areaId" value={areaId} />
      <input type="hidden" name="duplicar" value={duplicar ? 'sim' : ''} />
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-muted">{areaNome}</p>
          <h1 className="est-h1">{trilhos ? 'Novo item no estoque' : metrologia ? 'Novo instrumento' : oleo ? 'Novo produto' : 'Novo material'}</h1>
          <p className="est-sub">O saldo inicial entra no histórico como primeira entrada.</p>
        </div>
        <Link href={voltar} className="btn btn-ghost h-11">Cancelar</Link>
      </header>

      {trilhos ? (
        <>
          <fieldset className="m-0 border-0 p-0">
            <Passo n={1}>O que vai entrar?</Passo>
            <input type="hidden" name="categoria" value={categoria} />
            <div className="est-opcoes">
              {(['PERFIL', 'TALA', 'LISA'] as CategoriaTrilho[]).map((c) => (
                <button key={c} type="button" className="est-opcao" aria-pressed={categoria === c} onClick={() => setCategoria(c)}>
                  {c === 'PERFIL' ? <IconeSecaoTrilho size={26} /> : c === 'TALA' ? <IconeTala size={32} strokeWidth={1.6} /> : <IconeBarraLisa size={32} strokeWidth={1.6} />}
                  <span className="font-bold">{ROTULO_CATEGORIA[c]}</span>
                  <span className="text-xs text-ink-muted">{c === 'PERFIL' ? 'metros e toneladas' : c === 'TALA' ? 'pares' : 'barras'}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="m-0 border-0 p-0">
            <Passo n={2}>Perfil</Passo>
            <input type="hidden" name="perfil" value={perfil} />
            <div className="est-perfis">
              {PERFIS_ESTOQUE.map((p) => (
                <button key={p} type="button" className="est-perfil-btn" aria-pressed={perfil === p} onClick={() => setPerfil(p)}>{p}</button>
              ))}
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              Peso do {perfil}: <b className="est-num text-ink">{fator ? `${fmt(fator, 3)} t por metro` : 'sem fator cadastrado'}</b> (tabela de fatores do sistema).
            </p>
            {categoria === 'TALA' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-ink-muted">Furos:</span>
                <input type="hidden" name="furos" value={furos} />
                {['4', '6'].map((f) => (
                  <button key={f} type="button" className="est-chip" aria-pressed={furos === f} onClick={() => setFuros(f)}>{f} furos</button>
                ))}
              </div>
            )}
            {categoria === 'LISA' && (
              <div className="field mt-3 max-w-[220px]">
                <label htmlFor="comp-barra">Comprimento da barra (m)</label>
                <input id="comp-barra" name="comprimentoBarra" inputMode="decimal" className="h-12 est-num" value={comprimento} onChange={(e) => setComprimento(e.target.value)} autoComplete="off" />
              </div>
            )}
          </fieldset>
        </>
      ) : (
        <fieldset className="m-0 border-0 p-0">
          <Passo n={1}>{metrologia ? 'O instrumento' : oleo ? 'O produto' : 'O material'}</Passo>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="field sm:col-span-2">
              <label htmlFor="nome">Nome</label>
              <input
                id="nome"
                name="nome"
                className="h-12"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={metrologia ? 'Ex.: Paquímetro 300 mm' : oleo ? 'Ex.: Óleo hidráulico ISO 68' : 'Ex.: Disco de corte 14"'}
                required
                autoComplete="off"
              />
            </div>
            {metrologia && (
              <div className="sm:col-span-2">
                <input type="hidden" name="grupo" value={tipoMetro} />
                <div className="est-chips" role="group" aria-label="Tipo">
                  {[GRUPO_MEDICAO, GRUPO_FERRAMENTAS].map((g) => (
                    <button key={g} type="button" className="est-chip" aria-pressed={tipoMetro === g} onClick={() => setTipoMetro(g)}>{g}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="field">
              <label htmlFor="unidade">Unidade</label>
              <select id="unidade" name="unidade" className="h-12" defaultValue={oleo ? 'L' : 'un'}>
                {(oleo ? ['L', 'kg'] : ['un', 'par', 'kg', 'L', 'm']).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {!metrologia && !oleo && (
              <>
                <div className="field">
                  <label htmlFor="grupo">Prateleira</label>
                  <input id="grupo" name="grupo" list="lista-grupos" className="h-12" placeholder="Ex.: Corte e desbaste" autoComplete="off" />
                  <datalist id="lista-grupos">{grupos.map((g) => <option key={g} value={g} />)}</datalist>
                </div>
                <div className="field">
                  <label htmlFor="endereco">Posição na prateleira</label>
                  <input id="endereco" name="endereco" className="h-12 est-num" placeholder="Ex.: A-01" maxLength={12} autoComplete="off" />
                </div>
              </>
            )}
            {oleo && (
              <>
                <div className="field">
                  <label htmlFor="capacidade">Quanto cabe guardado</label>
                  <input id="capacidade" name="capacidade" inputMode="decimal" className="h-12 est-num" placeholder="Ex.: 200" autoComplete="off" />
                  <p className="text-xs text-ink-muted">O tamanho do tambor ou balde. Usado para o nível.</p>
                </div>
                <div className="field">
                  <label htmlFor="embalagem">Em quê</label>
                  <input id="embalagem" name="embalagem" list="lista-embalagens" className="h-12" placeholder="Ex.: 1 tambor" autoComplete="off" />
                  <datalist id="lista-embalagens">
                    {['1 tambor', '2 tambores', 'balde', 'bombona', 'galão'].map((e) => <option key={e} value={e} />)}
                  </datalist>
                </div>
              </>
            )}
            {metrologia && tipoMetro === GRUPO_MEDICAO && (
              <>
                <div className="field">
                  <label htmlFor="calibradoEm">Última calibração</label>
                  <input id="calibradoEm" name="calibradoEm" type="date" className="h-12" />
                </div>
                <div className="field">
                  <label htmlFor="calibracaoValidade">Calibração vale até</label>
                  <input id="calibracaoValidade" name="calibracaoValidade" type="date" className="h-12" />
                </div>
              </>
            )}
          </div>
        </fieldset>
      )}

      <fieldset className="m-0 border-0 p-0">
        <Passo n={trilhos ? 3 : 2}>Fabricante</Passo>
        <input name="fabricante" list="lista-fabricantes" className="h-12 w-full" value={fabricante} onChange={(e) => setFabricante(e.target.value)} placeholder="Opcional" autoComplete="off" aria-label="Fabricante" />
        <datalist id="lista-fabricantes">{fabricantes.map((f) => <option key={f} value={f} />)}</datalist>
        {fabricantes.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-ink-muted">Já usados:</span>
            {fabricantes.slice(0, 6).map((f) => (
              <button key={f} type="button" className="est-chip !min-h-[34px]" onClick={() => setFabricante(f)}>{f}</button>
            ))}
          </div>
        )}
      </fieldset>

      {igual && !duplicar && (
        <div role="status" className="flex flex-col gap-2.5 rounded-2xl p-4" style={{ background: 'var(--warn-bg)', border: '1px solid color-mix(in srgb, var(--warn) 45%, transparent)' }}>
          <p className="m-0 est-txt-warn"><b>Esse item já existe:</b> {igual.nome}{igual.fabricante ? ` · ${igual.fabricante}` : ''} com {igual.saldo}. Para não virar dois itens iguais, dê entrada nele.</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/estoque/material/${igual.id}`} className="btn btn-primary h-11">Abrir {igual.nome}</Link>
            <button type="button" className="btn btn-ghost h-11" onClick={() => setDuplicar(true)}>Cadastrar outro mesmo assim</button>
          </div>
        </div>
      )}

      <fieldset className="m-0 border-0 p-0">
        <Passo n={trilhos ? 4 : 3}>Quanto tem hoje</Passo>
        {trilhos && categoria === 'PERFIL' && (
          <div role="group" aria-label="Informar em" className="mb-3 grid grid-cols-2 gap-1 rounded-full border border-line p-1">
            <input type="hidden" name="modoQtd" value={modo} />
            {(['m', 't'] as const).map((o) => (
              <button
                key={o}
                type="button"
                className="h-10 rounded-full font-bold"
                style={modo === o ? { background: 'var(--primary)', color: 'var(--on-primary)' } : undefined}
                aria-pressed={modo === o}
                onClick={() => {
                  if (o !== modo && fator && Number.isFinite(q) && q > 0) setQtd(fmt(o === 't' ? q * fator : q / fator, o === 't' ? 1 : 0));
                  setModo(o);
                }}
              >
                {o === 'm' ? 'Em metros' : 'Em toneladas'}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="qtd">{trilhos ? `Quantidade (${unidadeTrilho})` : 'Quantidade em estoque'}</label>
            <input id="qtd" name="quantidadeInicial" inputMode="decimal" className="h-12 est-num text-lg" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="0" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="minimo">{trilhos ? `Mínimo (${unidadeTrilho})` : 'Estoque mínimo'}</label>
            <input id="minimo" name="minimo" inputMode="decimal" className="h-12 est-num text-lg" placeholder="Opcional" autoComplete="off" />
          </div>
        </div>
        {conta && (
          <div className="est-conta mt-3">
            <span className="text-xs uppercase tracking-[.08em] text-ink-muted">Conta automática</span>
            <span className="est-num text-sm text-ink-muted">{conta.linha}</span>
            <span className="est-num text-2xl font-semibold">{conta.resultado}</span>
          </div>
        )}
        <p className="mt-2 text-xs text-ink-muted">Abaixo do mínimo o item fica amarelo e aparece em &ldquo;Precisa de atenção&rdquo; no Resumo.</p>
      </fieldset>

      <div className="field">
        <label htmlFor="documento">Documento da entrada (opcional)</label>
        <input id="documento" name="documento" className="h-12" placeholder="NF ou contagem, ex.: NF 349788" maxLength={40} autoComplete="off" />
      </div>

      {estado && !estado.ok && (
        <p role="alert" className="text-sm text-bad">
          {estado.erro}{' '}
          {estado.id && <Link href={`/admin/estoque/material/${estado.id}`} className="font-semibold underline">Abrir o item</Link>}
        </p>
      )}

      <footer className="flex flex-col gap-2.5 border-t border-line pt-4">
        {nomeFinal && <p className="m-0 text-sm text-ink-muted">Vai ser cadastrado como <b className="text-ink">{nomeFinal}{fabNorm ? ` · ${fabNorm}` : ''}</b>.</p>}
        <div className="grid grid-cols-[1fr_2fr] gap-2.5">
          <Link href={voltar} className="btn btn-ghost h-12">Cancelar</Link>
          <button type="submit" className="btn btn-primary h-12" disabled={pendente || (!!igual && !duplicar)}>
            {pendente ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </div>
      </footer>
    </form>
  );
}
