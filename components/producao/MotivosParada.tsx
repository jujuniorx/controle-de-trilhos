'use client';

import { useEffect, useRef, useState } from 'react';
import { IconeCheck, IconeFechar, IconeSeta } from '@/components/icones/Icones';
import { MOTIVOS_PARADA } from './motivos';

const SEP = '; ';

/** Separa o texto salvo ("A; B; outra coisa") em motivos da lista e texto livre. */
function separar(texto: string) {
  const partes = texto.split(';').map((s) => s.trim()).filter(Boolean);
  const lista: readonly string[] = MOTIVOS_PARADA;
  return {
    selecionados: partes.filter((p) => lista.includes(p)),
    outro: partes.filter((p) => !lista.includes(p)).join(SEP),
  };
}

/** Descricao da parada: um campo compacto com os motivos escolhidos; ao tocar, abre a folha com a lista (marca quantos forem) e o campo Outro. */
export function MotivosParada({ data, hora, n, descricaoPadrao, padrao = [] }: { data: string; hora: string; n: number; descricaoPadrao: string; padrao?: string[] }) {
  const inicial = separar(descricaoPadrao);
  // Motivos que ja vem marcados (ex.: Reuniao - DDS na primeira parada das 07:00) quando ainda nao ha nada salvo.
  const [selecionados, setSelecionados] = useState<string[]>(descricaoPadrao ? inicial.selecionados : padrao);
  const [outro, setOutro] = useState(inicial.outro);
  const folha = useRef<HTMLDialogElement>(null);
  const idBase = `motivos-${hora.replace(':', '')}-${n}`;
  const chave = `producao-parada-${data}-${hora}-${n}-motivos`;

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chave);
      if (!salvo) return;
      const v = JSON.parse(salvo) as { selecionados?: unknown; outro?: unknown };
      const lista: readonly string[] = MOTIVOS_PARADA;
      if (Array.isArray(v.selecionados)) setSelecionados(v.selecionados.filter((x): x is string => typeof x === 'string' && lista.includes(x)));
      if (typeof v.outro === 'string') setOutro(v.outro);
    } catch {
      /* sem armazenamento: segue com o valor do servidor */
    }
  }, [chave]);

  const guardar = (sel: string[], o: string) => {
    try { localStorage.setItem(chave, JSON.stringify({ selecionados: sel, outro: o })); } catch { /* sem armazenamento */ }
  };

  const alternar = (motivo: string) => {
    const novo = selecionados.includes(motivo) ? selecionados.filter((x) => x !== motivo) : [...selecionados, motivo];
    setSelecionados(novo);
    guardar(novo, outro);
  };

  const aoOutro = (v: string) => {
    setOutro(v);
    guardar(selecionados, v);
  };

  const valor = [...MOTIVOS_PARADA.filter((m) => selecionados.includes(m)), outro.trim()].filter(Boolean).join(SEP);

  const escolhidos = valor ? valor.split(SEP) : [];
  const abrir = () => { if (!folha.current?.open) folha.current?.showModal(); };
  const fechar = () => folha.current?.close();
  const limpar = () => { setSelecionados([]); setOutro(''); guardar([], ''); };

  return (
    <div className="motivos">
      <button type="button" className="motivos-campo" aria-haspopup="dialog" aria-label={`Parada ${n} às ${hora}: escolher motivos`} onClick={abrir}>
        <span className="motivos-escolhidos">
          {escolhidos.length === 0 && <span className="motivos-vazio">Escolher motivos</span>}
          {escolhidos.map((m) => <span key={m} className="motivos-chip">{m}</span>)}
        </span>
        <IconeSeta size={16} className="motivos-seta" />
      </button>

      <dialog
        ref={folha}
        className="motivos-folha"
        aria-labelledby={`${idBase}-titulo`}
        onClick={(e) => { if (e.target === e.currentTarget) fechar(); }}
      >
        <div className="motivos-folha-dentro">
          <header className="motivos-topo">
            <div>
              <p className="motivos-sobre">Parada {n} · {hora}</p>
              <h3 id={`${idBase}-titulo`} className="motivos-titulo">Motivos da parada</h3>
            </div>
            <button type="button" className="motivos-fechar" aria-label="Fechar" onClick={fechar}><IconeFechar size={18} /></button>
          </header>
          <p className="motivos-ajuda">Toque em todos os motivos que valem para esta parada.</p>

          <div role="group" aria-label="Motivos" className="motivos-lista">
            {MOTIVOS_PARADA.map((m) => {
              const on = selecionados.includes(m);
              return (
                <button key={m} type="button" role="checkbox" aria-checked={on} className="motivos-item" onClick={() => alternar(m)}>
                  <span className="motivos-caixa">{on && <IconeCheck size={14} />}</span>
                  <span>{m}</span>
                </button>
              );
            })}
          </div>

          <div className="field motivos-outro">
            <label htmlFor={`${idBase}-outro`}>Outro motivo</label>
            <input
              id={`${idBase}-outro`}
              placeholder="Escreva, se não estiver na lista"
              value={outro}
              onChange={(e) => aoOutro(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fechar(); } }}
              className="h-11 w-full"
            />
          </div>

          <footer className="motivos-rodape">
            <button type="button" className="btn btn-ghost h-11" onClick={limpar} disabled={escolhidos.length === 0}>Limpar</button>
            <button type="button" className="btn btn-primary h-11" onClick={fechar}>
              {escolhidos.length ? `Pronto (${escolhidos.length})` : 'Pronto'}
            </button>
          </footer>
        </div>
      </dialog>

      <input type="hidden" name={`parada_descricao_${hora}_${n}`} value={valor} />
    </div>
  );
}
