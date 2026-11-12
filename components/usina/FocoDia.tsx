'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export type DiaFoco = { data: string; nome: string; numero: string };

const CHAVE = 'usina-foco';

/**
 * Escolha do dia a lançar: mostra só as linhas do dia escolhido (ou a semana toda).
 * As linhas dos outros dias continuam no formulário, só ficam escondidas, então salvar
 * grava a semana inteira do mesmo jeito e nada do que já foi lançado se perde.
 * Cada linha de dia leva data-dia="AAAA-MM-DD".
 */
export function FocoDia({ dias, inicial, hoje, children }: { dias: DiaFoco[]; inicial: string; hoje: string; children: ReactNode }) {
  const [foco, setFoco] = useState<string>(dias.some((d) => d.data === inicial) ? inicial : 'semana');
  const [comDados, setComDados] = useState<Set<string>>(new Set());
  const area = useRef<HTMLDivElement>(null);

  // Quem prefere ver a semana toda continua vendo a semana toda nas próximas visitas.
  useEffect(() => {
    try { if (localStorage.getItem(CHAVE) === 'semana') setFoco('semana'); } catch { /* sem armazenamento */ }
  }, []);

  // Marca os dias que já têm algo lançado (qualquer campo preenchido na linha do dia).
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const medir = () => {
      const cheios = new Set<string>();
      el.querySelectorAll<HTMLElement>('[data-dia]').forEach((linha) => {
        const dia = linha.dataset.dia ?? '';
        if (cheios.has(dia)) return;
        const campos = linha.matches('input, textarea') ? [linha as HTMLInputElement] : Array.from(linha.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([type="checkbox"]), textarea'));
        if (campos.some((c) => c.value.trim() !== '')) cheios.add(dia);
      });
      setComDados(cheios);
    };
    medir();
    el.addEventListener('input', medir);
    return () => el.removeEventListener('input', medir);
  }, []);

  function escolher(valor: string) {
    setFoco(valor);
    try { localStorage.setItem(CHAVE, valor === 'semana' ? 'semana' : 'dia'); } catch { /* sem armazenamento */ }
  }

  return (
    <div ref={area} data-usina-foco={foco}>
      {foco !== 'semana' && <style>{`[data-usina-foco] [data-dia]:not([data-dia="${foco}"]) { display: none !important; }`}</style>}
      <div className="foco-dia" role="group" aria-label="Dia a lançar">
        <div className="foco-dias">
          {dias.map((d) => (
            <button key={d.data} type="button" className="foco-botao" aria-pressed={foco === d.data} data-hoje={d.data === hoje ? 'true' : undefined} onClick={() => escolher(d.data)}>
              <span className="foco-nome">{d.nome}</span>
              <span className="foco-numero">{d.numero}</span>
              <span className="foco-ponto" data-cheio={comDados.has(d.data) ? 'true' : undefined} aria-hidden="true" />
              {comDados.has(d.data) && <span className="sr-only">, já lançado</span>}
              {d.data === hoje && <span className="sr-only">, hoje</span>}
            </button>
          ))}
        </div>
        <button type="button" className="foco-botao foco-semana" aria-pressed={foco === 'semana'} onClick={() => escolher('semana')}>
          Semana toda
        </button>
      </div>
      <p className="foco-legenda">
        {foco === 'semana' ? 'Mostrando os sete dias.' : 'Mostrando só o dia escolhido. Os outros dias continuam salvos.'} O ponto marca os dias que já têm lançamento.
      </p>
      {children}
    </div>
  );
}
