'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconeAlerta, IconeBarraLisa, IconeMais, IconeMenos, IconeTala } from '@/components/icones/Icones';
import { MARCAS, MARCA_LABEL, PERFIS } from '@/lib/validation/recebimento';
import { METROS_BARRA_VAGAO } from '@/lib/validation/vagao';
import { criarChegadaVagaoAction } from '../actions';

type Marca = (typeof MARCAS)[number];
type Forma = 'LISA' | 'TALA';

interface Linha {
  id: number;
  perfil: string;
  marca: Marca | '';
  fabricanteOutro: string;
  formaNovo: Forma | '';
  barras: number;
}

const novaLinha = (id: number, base?: Linha): Linha => ({
  id,
  perfil: base?.perfil ?? 'TR68',
  marca: base?.marca ?? '',
  fabricanteOutro: base?.fabricanteOutro ?? '',
  formaNovo: '',
  barras: 0,
});

function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Checklist do vagão: uma linha por perfil + marca + lisa/tala. Só online (sem fila offline). */
export function VagaoForm() {
  const router = useRouter();
  const [data, setData] = useState('');
  const [vagao, setVagao] = useState('');
  const [nf, setNf] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [observacao, setObservacao] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha(1)]);
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setData((d) => d || hojeLocal());
  }, []);

  const mudar = (id: number, patch: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const totalBarras = linhas.reduce((a, l) => a + (l.barras > 0 ? l.barras : 0), 0);

  const errosLinha = (l: Linha): string | null => {
    if (!l.marca) return 'Escolha a marca.';
    if (l.marca === 'OUTROS' && !l.fabricanteOutro.trim()) return 'Informe o nome do fabricante.';
    if (!l.formaNovo) return 'Escolha se é barra lisa ou tala.';
    if (!(l.barras >= 1)) return 'Informe o número de barras.';
    return null;
  };
  const erroCab = !vagao.trim() ? 'Informe a identificação do vagão.' : responsavel.trim().length < 3 ? 'Informe quem está preenchendo.' : null;

  async function enviar() {
    setTentou(true);
    setErro('');
    if (erroCab || linhas.some((l) => errosLinha(l))) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErro('Sem conexão. Tente de novo quando o sinal voltar.');
      return;
    }
    setEnviando(true);
    try {
      const r = await criarChegadaVagaoAction({
        data,
        vagao,
        numeroDocumento: nf.trim() || undefined,
        responsavelPatio: responsavel,
        observacao: observacao.trim() || undefined,
        linhas: linhas.map((l) => ({
          perfil: l.perfil,
          marca: l.marca,
          ...(l.marca === 'OUTROS' ? { fabricanteOutro: l.fabricanteOutro.trim() } : {}),
          formaNovo: l.formaNovo,
          barras: l.barras,
        })),
      });
      if (!r.ok) {
        setErro(r.erro ?? 'Não foi possível registrar o vagão.');
        return;
      }
      router.push('/patio?vagao=ok');
    } catch {
      setErro('Sem conexão. Tente de novo quando o sinal voltar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label htmlFor="v-data">Data de chegada</label>
          <input id="v-data" type="date" className="h-11" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="v-vagao">Vagão</label>
          <input id="v-vagao" className="h-11" placeholder="Ex.: GDT 123456-7" value={vagao} onChange={(e) => setVagao(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="v-nf">Nota fiscal (opcional)</label>
          <input id="v-nf" className="h-11" inputMode="numeric" value={nf} onChange={(e) => setNf(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="v-resp">Quem está preenchendo</label>
          <input id="v-resp" className="h-11" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
        </div>
      </div>
      {tentou && erroCab && (
        <p className="erro-campo" role="alert">
          <IconeAlerta size={18} aria-hidden="true" />
          {erroCab}
        </p>
      )}

      {linhas.map((l, i) => {
        const erroL = tentou ? errosLinha(l) : null;
        return (
          <section key={l.id} className="card space-y-3 p-4" aria-label={`Linha ${i + 1}`}>
            <div className="flex items-center justify-between">
              <span className="font-condensed text-base font-bold uppercase tracking-wide">Linha {i + 1}</span>
              {linhas.length > 1 && (
                <button type="button" className="text-sm text-bad" onClick={() => setLinhas((ls) => ls.filter((x) => x.id !== l.id))}>
                  Remover
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select aria-label={`Perfil da linha ${i + 1}`} className="h-11" value={l.perfil} onChange={(e) => mudar(l.id, { perfil: e.target.value })}>
                {PERFIS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <select aria-label={`Marca da linha ${i + 1}`} className="h-11" value={l.marca} onChange={(e) => mudar(l.id, { marca: e.target.value as Marca })}>
                <option value="" disabled>
                  Marca
                </option>
                {MARCAS.map((m) => (
                  <option key={m} value={m}>
                    {m === 'OUTROS' ? 'Outros' : MARCA_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
            {l.marca === 'OUTROS' && (
              <input className="h-11 w-full" placeholder="Nome do fabricante" value={l.fabricanteOutro} onChange={(e) => mudar(l.id, { fabricanteOutro: e.target.value })} />
            )}
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Barra lisa ou tala da linha ${i + 1}`}>
              {(
                [
                  ['LISA', 'Barra lisa', IconeBarraLisa],
                  ['TALA', 'Tala (com furos)', IconeTala],
                ] as const
              ).map(([valor, rotulo, Icone]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={l.formaNovo === valor}
                  className={`flex h-12 items-center justify-center gap-2 rounded-lg border text-base font-semibold ${l.formaNovo === valor ? 'border-primary bg-primary text-white' : 'border-line bg-surface'}`}
                  onClick={() => mudar(l.id, { formaNovo: valor })}
                >
                  <Icone size={20} />
                  {rotulo}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Menos uma barra" className="btn btn-ghost h-12 w-12" onClick={() => mudar(l.id, { barras: Math.max(0, l.barras - 1) })}>
                <IconeMenos size={20} />
              </button>
              <input
                aria-label={`Número de barras da linha ${i + 1}`}
                className="h-12 flex-1 text-center text-lg font-bold"
                inputMode="numeric"
                value={l.barras || ''}
                placeholder="0"
                onChange={(e) => mudar(l.id, { barras: Math.min(999, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)) })}
              />
              <button type="button" aria-label="Mais uma barra" className="btn btn-ghost h-12 w-12" onClick={() => mudar(l.id, { barras: Math.min(999, l.barras + 1) })}>
                <IconeMais size={20} />
              </button>
            </div>
            <p className="text-center text-sm text-ink-muted">
              {fmt(l.barras)} {l.barras === 1 ? 'barra' : 'barras'} de 24 m · {fmt(l.barras * METROS_BARRA_VAGAO)} m
            </p>
            {erroL && (
              <p className="erro-campo" role="alert">
                <IconeAlerta size={18} aria-hidden="true" />
                {erroL}
              </p>
            )}
          </section>
        );
      })}

      <button type="button" className="btn btn-ghost h-11 w-full" onClick={() => setLinhas((ls) => [...ls, novaLinha(Math.max(...ls.map((x) => x.id)) + 1, ls[ls.length - 1])])}>
        <IconeMais size={18} /> Adicionar linha
      </button>

      <div className="field">
        <label htmlFor="v-obs">Observação (opcional)</label>
        <input id="v-obs" className="h-11" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </div>

      <p className="text-center text-base font-semibold" aria-live="polite">
        {fmt(totalBarras)} barras · {fmt(totalBarras * METROS_BARRA_VAGAO)} m
      </p>
      {erro && (
        <p className="erro-campo" role="alert">
          <IconeAlerta size={18} aria-hidden="true" />
          {erro}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-lg h-12 w-full" disabled={enviando} onClick={enviar}>
        {enviando ? 'Enviando…' : 'Enviar para conferência'}
      </button>
    </div>
  );
}
