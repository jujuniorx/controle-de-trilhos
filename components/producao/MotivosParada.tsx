'use client';

import { useEffect, useState } from 'react';
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

/** Descricao da parada: botoes dos motivos (marca quantos forem) e um campo Outro para o que nao estiver na lista. */
export function MotivosParada({ data, hora, n, descricaoPadrao }: { data: string; hora: string; n: number; descricaoPadrao: string }) {
  const inicial = separar(descricaoPadrao);
  const [selecionados, setSelecionados] = useState<string[]>(inicial.selecionados);
  const [outro, setOutro] = useState(inicial.outro);
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

  return (
    <div className="space-y-2">
      <div role="group" aria-label={`Motivos da parada ${n} às ${hora}`} className="flex flex-wrap gap-2">
        {MOTIVOS_PARADA.map((m) => {
          const on = selecionados.includes(m);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => alternar(m)}
              className={`btn h-auto min-h-10 px-3 py-1.5 text-sm ${on ? 'btn-primary' : 'btn-ghost'}`}
            >
              {m}
            </button>
          );
        })}
      </div>
      <input
        aria-label={`Parada ${n}: outro motivo às ${hora}`}
        placeholder="Outro motivo, se não estiver na lista"
        value={outro}
        onChange={(e) => aoOutro(e.target.value)}
        className="h-11 w-full"
      />
      <input type="hidden" name={`parada_descricao_${hora}_${n}`} value={valor} />
    </div>
  );
}
