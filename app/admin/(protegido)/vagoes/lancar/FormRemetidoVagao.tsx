'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconeAlerta, IconeLixeira, IconeMais } from '@/components/icones/Icones';
import { MARCAS, MARCA_LABEL } from '@/lib/validation/recebimento';
import { METROS_TLS, fatorPerfil } from '@/lib/estoque/trilhos';
import {
  PERFIS_TLS,
  TIPOS_REMETIDO_VAGAO,
  TRILHEIROS_VAGAO,
  lerListaVagoes,
  lerNumeroBr,
  separarNfs,
  type VagaoDigitado,
} from '@/lib/validation/vagaoRemetido';
import { lancarRemetidoVagaoAction } from '../actions';

type Marca = (typeof MARCAS)[number];

interface Linha {
  id: number;
  perfil: (typeof PERFIS_TLS)[number];
  material: 'NOVO' | 'REEMPREGO';
  marca: Marca | '';
  fabricanteOutro: string;
  quantidade: string;
}

interface VagaoLinha extends VagaoDigitado {
  id: number;
}

const TIPO_LABEL: Record<(typeof TIPOS_REMETIDO_VAGAO)[number], string> = { TRANS: 'Transferência', VENDA: 'Venda', INDUS: 'Industrialização' };

const fmt = (n: number, casas = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const toneladasDe = (perfil: string, tls: number) => tls * METROS_TLS * fatorPerfil(perfil);
const inteiro = (t: string) => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : 0);

/** Formulário do B.O. do trilheiro: cabeçalho, linhas de TLS, vagões e se mexe no estoque. */
export function FormRemetidoVagao() {
  const router = useRouter();
  const [data, setData] = useState('');
  const [trilheiro, setTrilheiro] = useState<(typeof TRILHEIROS_VAGAO)[number] | ''>('');
  const [destino, setDestino] = useState('');
  const [tipo, setTipo] = useState<(typeof TIPOS_REMETIDO_VAGAO)[number]>('TRANS');
  const [nfs, setNfs] = useState('');
  const [valorNf, setValorNf] = useState('');
  const [observacao, setObservacao] = useState('');
  const [movimenta, setMovimenta] = useState<boolean | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([{ id: 1, perfil: 'TR68', material: 'NOVO', marca: '', fabricanteOutro: '', quantidade: '' }]);
  const [vagoes, setVagoes] = useState<VagaoLinha[]>([]);
  const [colando, setColando] = useState(false);
  const [textoColado, setTextoColado] = useState('');
  const [avisoColar, setAvisoColar] = useState('');
  const [proximoId, setProximoId] = useState(100);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const novoId = () => {
    setProximoId((n) => n + 1);
    return proximoId;
  };
  const mudarLinha = (id: number, patch: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const mudarVagao = (id: number, patch: Partial<VagaoLinha>) => setVagoes((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const totalTls = linhas.reduce((t, l) => t + inteiro(l.quantidade), 0);
  const totalToneladas = linhas.reduce((t, l) => t + toneladasDe(l.perfil, inteiro(l.quantidade)), 0);
  const somaPeso = (campo: 'pesoLiquido' | 'pesoBruto') => vagoes.reduce((t, v) => t + (lerNumeroBr(v[campo]) || 0), 0);

  function colarVagoes() {
    const { vagoes: lidos, naoLidas } = lerListaVagoes(textoColado);
    if (lidos.length === 0) {
      setAvisoColar('Não reconheci nenhum vagão. Use uma linha por vagão: série, número, peso líquido e peso bruto.');
      return;
    }
    let id = proximoId;
    setVagoes((vs) => [...vs, ...lidos.map((v) => ({ ...v, id: id++ }))]);
    setProximoId(id);
    setTextoColado('');
    setColando(false);
    setAvisoColar(naoLidas.length > 0 ? `${lidos.length} vagões adicionados. ${naoLidas.length} linha(s) não reconhecida(s): ${naoLidas.join(' | ')}` : '');
  }

  function validarNaTela(): string | null {
    if (!data) return 'Informe a data do B.O.';
    if (!trilheiro) return 'Escolha o trilheiro.';
    if (destino.trim().length < 2) return 'Informe o destino.';
    for (const [i, l] of linhas.entries()) {
      if (inteiro(l.quantidade) < 1) return `Linha ${i + 1}: informe quantos TLS.`;
      if (l.material === 'NOVO' && !l.marca) return `Linha ${i + 1}: escolha o fabricante.`;
      if (l.material === 'NOVO' && l.marca === 'OUTROS' && !l.fabricanteOutro.trim()) return `Linha ${i + 1}: informe o nome do fabricante.`;
    }
    for (const [i, v] of vagoes.entries()) {
      if (!v.serie.trim() || !v.numero.trim()) return `Vagão ${i + 1}: informe série e número.`;
      if (Number.isNaN(lerNumeroBr(v.pesoLiquido)) || Number.isNaN(lerNumeroBr(v.pesoBruto))) return `Vagão ${i + 1}: peso inválido. Use números, ex.: 64,90.`;
    }
    if (Number.isNaN(lerNumeroBr(valorNf))) return 'Valor da NF inválido. Ex.: 1.063.017,60.';
    if (movimenta === null) return 'Diga se este remetido tira os TLS do estoque.';
    return null;
  }

  async function enviar() {
    const problema = validarNaTela();
    setErro(problema ?? '');
    if (problema || movimenta === null || !trilheiro) return;
    setEnviando(true);
    try {
      const r = await lancarRemetidoVagaoAction({
        data,
        trilheiro,
        nfs: separarNfs(nfs),
        destino,
        tipoRemetido: tipo,
        valorNf: lerNumeroBr(valorNf),
        observacao: observacao.trim() || undefined,
        movimentaEstoque: movimenta,
        linhas: linhas.map((l) => ({
          perfil: l.perfil,
          material: l.material,
          ...(l.material === 'NOVO' && l.marca ? { marca: l.marca } : {}),
          ...(l.material === 'NOVO' && l.marca === 'OUTROS' ? { fabricanteOutro: l.fabricanteOutro.trim() } : {}),
          quantidade: inteiro(l.quantidade),
        })),
        vagoes: vagoes.map((v) => ({ serie: v.serie, numero: v.numero, pesoLiquido: lerNumeroBr(v.pesoLiquido), pesoBruto: lerNumeroBr(v.pesoBruto) })),
      });
      if (!r.ok || !r.id) {
        setErro(r.erro ?? 'Não foi possível lançar o remetido.');
        return;
      }
      router.push(`/admin/vagoes/${r.id}`);
    } catch {
      setErro('Sem conexão. Tente de novo quando o sinal voltar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="card-title">Dados do B.O.</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="field">
            <label htmlFor="rv-data">Data do B.O.</label>
            <input id="rv-data" type="date" className="h-11" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rv-trilheiro">Trilheiro</label>
            <select id="rv-trilheiro" className="h-11" value={trilheiro} onChange={(e) => setTrilheiro(e.target.value as (typeof TRILHEIROS_VAGAO)[number])}>
              <option value="" disabled>
                Escolha
              </option>
              {TRILHEIROS_VAGAO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rv-destino">Destino</label>
            <input id="rv-destino" className="h-11" placeholder="Ex.: ZXP" value={destino} onChange={(e) => setDestino(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rv-tipo">Tipo</label>
            <select id="rv-tipo" className="h-11" value={tipo} onChange={(e) => setTipo(e.target.value as (typeof TIPOS_REMETIDO_VAGAO)[number])}>
              {TIPOS_REMETIDO_VAGAO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rv-nfs">Notas fiscais</label>
            <input id="rv-nfs" className="h-11 font-mono" inputMode="numeric" placeholder="2100310798/2100310799" value={nfs} onChange={(e) => setNfs(e.target.value)} />
            <span className="hint">Mais de uma: separe com barra.</span>
          </div>
          <div className="field">
            <label htmlFor="rv-valor">Valor da NF (R$)</label>
            <input id="rv-valor" className="h-11 font-mono" inputMode="decimal" placeholder="1.063.017,60" value={valorNf} onChange={(e) => setValorNf(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="card-title">TLS carregados</h2>
          <span className="text-sm text-ink-muted">
            {fmt(totalTls)} TLS · {fmt(totalTls * METROS_TLS)} m · {fmt(totalToneladas, 3)} t
          </span>
        </div>
        {linhas.map((l, i) => {
          const q = inteiro(l.quantidade);
          return (
            <div key={l.id} className="space-y-2 rounded-lg border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Linha {i + 1}</span>
                {linhas.length > 1 && (
                  <button type="button" className="inline-flex items-center gap-1 text-sm text-bad" onClick={() => setLinhas((ls) => ls.filter((x) => x.id !== l.id))}>
                    <IconeLixeira size={15} /> Tirar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <select aria-label={`Perfil da linha ${i + 1}`} className="h-11" value={l.perfil} onChange={(e) => mudarLinha(l.id, { perfil: e.target.value as Linha['perfil'] })}>
                  {PERFIS_TLS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <div className="est-chips" role="group" aria-label={`Material da linha ${i + 1}`}>
                  {(['NOVO', 'REEMPREGO'] as const).map((m) => (
                    <button key={m} type="button" className="est-chip" aria-pressed={l.material === m} onClick={() => mudarLinha(l.id, { material: m })}>
                      {m === 'NOVO' ? 'Novo' : 'Reemprego'}
                    </button>
                  ))}
                </div>
                {l.material === 'NOVO' ? (
                  <select aria-label={`Fabricante da linha ${i + 1}`} className="h-11" value={l.marca} onChange={(e) => mudarLinha(l.id, { marca: e.target.value as Marca })}>
                    <option value="" disabled>
                      Fabricante
                    </option>
                    {MARCAS.map((m) => (
                      <option key={m} value={m}>
                        {m === 'OUTROS' ? 'Outros' : MARCA_LABEL[m]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="flex h-11 items-center text-sm text-ink-muted">Sem fabricante (N/A)</p>
                )}
                <input
                  aria-label={`Quantidade de TLS da linha ${i + 1}`}
                  className="h-11 text-right font-mono"
                  inputMode="numeric"
                  placeholder="TLS"
                  value={l.quantidade}
                  onChange={(e) => mudarLinha(l.id, { quantidade: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                />
              </div>
              {l.material === 'NOVO' && l.marca === 'OUTROS' && (
                <input className="h-11 w-full" placeholder="Nome do fabricante" value={l.fabricanteOutro} onChange={(e) => mudarLinha(l.id, { fabricanteOutro: e.target.value })} />
              )}
              {q > 0 && (
                <p className="text-sm text-ink-muted">
                  {fmt(q)} TLS de {METROS_TLS} m · {fmt(q * METROS_TLS)} m · {fmt(toneladasDe(l.perfil, q), 3)} t
                </p>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setLinhas((ls) => [...ls, { id: novoId(), perfil: 'TR60', material: 'REEMPREGO', marca: '', fabricanteOutro: '', quantidade: '' }])}
        >
          <IconeMais size={15} /> Adicionar perfil
        </button>
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="card-title">Vagões</h2>
          <span className="text-sm text-ink-muted">
            {vagoes.length} {vagoes.length === 1 ? 'vagão' : 'vagões'} · líquido {fmt(somaPeso('pesoLiquido'), 2)} t · bruto {fmt(somaPeso('pesoBruto'), 2)} t
          </span>
        </div>
        <p className="text-sm text-ink-muted">Opcional. Copie os vagões do B.O. para ficarem registrados junto com o remetido.</p>

        {vagoes.length > 0 && (
          <div className="tbl-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th className="py-2">#</th>
                  <th className="py-2">Série</th>
                  <th className="py-2">Número</th>
                  <th className="py-2 text-right">P. líq. (t)</th>
                  <th className="py-2 text-right">P. bruto (t)</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {vagoes.map((v, i) => (
                  <tr key={v.id} className="border-t border-line">
                    <td className="py-1 text-ink-muted">{i + 1}</td>
                    <td className="py-1 pr-2">
                      <input aria-label={`Série do vagão ${i + 1}`} className="h-10 w-20 font-mono" value={v.serie} onChange={(e) => mudarVagao(v.id, { serie: e.target.value.toUpperCase() })} />
                    </td>
                    <td className="py-1 pr-2">
                      <input aria-label={`Número do vagão ${i + 1}`} className="h-10 w-32 font-mono" value={v.numero} onChange={(e) => mudarVagao(v.id, { numero: e.target.value })} />
                    </td>
                    <td className="py-1 pr-2 text-right">
                      <input aria-label={`Peso líquido do vagão ${i + 1}`} className="h-10 w-24 text-right font-mono" inputMode="decimal" value={v.pesoLiquido} onChange={(e) => mudarVagao(v.id, { pesoLiquido: e.target.value })} />
                    </td>
                    <td className="py-1 pr-2 text-right">
                      <input aria-label={`Peso bruto do vagão ${i + 1}`} className="h-10 w-24 text-right font-mono" inputMode="decimal" value={v.pesoBruto} onChange={(e) => mudarVagao(v.id, { pesoBruto: e.target.value })} />
                    </td>
                    <td className="py-1 text-right">
                      <button type="button" className="text-bad" aria-label={`Tirar o vagão ${i + 1}`} onClick={() => setVagoes((vs) => vs.filter((x) => x.id !== v.id))}>
                        <IconeLixeira size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVagoes((vs) => [...vs, { id: novoId(), serie: vs[vs.length - 1]?.serie ?? '', numero: '', pesoLiquido: '', pesoBruto: '' }])}>
            <IconeMais size={15} /> Adicionar vagão
          </button>
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={colando} onClick={() => setColando((c) => !c)}>
            Colar lista de vagões
          </button>
        </div>
        {colando && (
          <div className="space-y-2">
            <textarea
              aria-label="Lista de vagões"
              className="min-h-32 w-full rounded-md border border-line p-3 font-mono text-sm"
              placeholder={'Uma linha por vagão:\nPDR 332510-5 42,20 60,00\nPDT 844028-0 64,90 86,90'}
              value={textoColado}
              onChange={(e) => setTextoColado(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={colarVagoes}>
              Adicionar estes vagões
            </button>
          </div>
        )}
        {avisoColar && <p className="text-sm text-warn">{avisoColar}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Estoque</h2>
        <p className="text-sm text-ink-muted">Este remetido tira os TLS do estoque de trilhos?</p>
        <div className="est-chips" role="group" aria-label="Movimenta o estoque">
          <button type="button" className="est-chip" aria-pressed={movimenta === true} onClick={() => setMovimenta(true)}>
            Sim, tira do estoque
          </button>
          <button type="button" className="est-chip" aria-pressed={movimenta === false} onClick={() => setMovimenta(false)}>
            Não, o estoque já está certo
          </button>
        </div>
        {movimenta === false && <p className="text-sm text-ink-muted">Fica registrado nos relatórios e no Excel, mas o saldo de TLS não muda.</p>}
        <div className="field">
          <label htmlFor="rv-obs">Observação</label>
          <input id="rv-obs" className="h-11" maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
      </section>

      {erro && (
        <p className="erro-campo" role="alert">
          <IconeAlerta size={18} aria-hidden="true" />
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => router.push('/admin/vagoes')} disabled={enviando}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" onClick={enviar} disabled={enviando}>
          {enviando ? 'Lançando...' : 'Lançar remetido'}
        </button>
      </div>
    </div>
  );
}
