'use client';

import { useEffect, useRef, useState } from 'react';

type Estado = 'parado' | 'salvando' | 'salvo' | 'recuperado' | 'erro';

/** Rascunho guardado no proprio aparelho (tablet, celular ou computador): sobrevive a atualizar, fechar e reabrir. */
function chave(data: string) {
  return `producao-rascunho-${data}`;
}

function definirValor(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, valor: string) {
  const proto =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, valor);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** O que ainda falta preencher: soldas esquecidas e paradas com so o inicio ou so o fim. */
function avisosDoFormulario(form: HTMLFormElement, horas: string[]): string[] {
  const avisos: string[] = [];
  const valor = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value?.trim() ?? '';
  for (const hora of horas) {
    const soldas = valor(`soldas_${hora}`) || (form.elements.namedItem(`soldas_${hora}`) as HTMLInputElement | null)?.value?.trim() || '';
    const cortes = (form.elements.namedItem(`cortes_${hora}`) as HTMLInputElement | null)?.value?.trim() || '';
    let temParada = false;
    for (let n = 1; n <= 3; n++) {
      const inicio = (form.elements.namedItem(`parada_inicio_${hora}_${n}`) as HTMLInputElement | null)?.value?.trim() || '';
      const fim = valor(`parada_fim_${hora}_${n}`);
      if (inicio || fim) temParada = true;
      if (inicio && !fim) avisos.push(`Das ${hora}: parada ${n} sem o horário do fim.`);
      if (!inicio && fim) avisos.push(`Das ${hora}: parada ${n} sem o horário do início.`);
    }
    if (!soldas && (cortes || temParada)) avisos.push(`Das ${hora}: falta a quantidade de soldas.`);
  }
  return avisos;
}

export function RascunhoAutomatico({ data, horas }: { data: string; horas: string[] }) {
  const horasKey = horas.join(',');
  const [estado, setEstado] = useState<Estado>('parado');
  const [avisos, setAvisos] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const form = document.getElementById('form-producao') as HTMLFormElement | null;
    if (!form) return;
    const horas = horasKey.split(',');
    let cancelado = false;

    const coletar = () => {
      const campos: Record<string, string> = {};
      new FormData(form).forEach((v, k) => {
        if (typeof v === 'string' && k !== 'data') campos[k] = v;
      });
      return campos;
    };

    const gravar = () => {
      try {
        localStorage.setItem(chave(data), JSON.stringify(coletar()));
        if (!cancelado) setEstado('salvo');
      } catch {
        if (!cancelado) setEstado('erro');
      }
    };

    const aoMudar = () => {
      setAvisos(avisosDoFormulario(form, horas));
      if (timer.current) clearTimeout(timer.current);
      setEstado('salvando');
      timer.current = setTimeout(gravar, 400);
    };

    const aoSair = () => {
      if (document.visibilityState !== 'hidden') return;
      if (timer.current) clearTimeout(timer.current);
      gravar();
    };

    // Ao salvar o dia de verdade, o rascunho deste dia sai do aparelho.
    const aoEnviar = () => {
      if (timer.current) clearTimeout(timer.current);
      try { localStorage.removeItem(chave(data)); } catch { /* sem armazenamento: nada a limpar */ }
    };

    try {
      const salvo = localStorage.getItem(chave(data));
      if (salvo) {
        const campos = JSON.parse(salvo) as Record<string, string>;
        for (const [nome, valor] of Object.entries(campos)) {
          const el = form.elements.namedItem(nome);
          if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
            definirValor(el, valor);
          }
        }
        setEstado('recuperado');
      }
    } catch {
      /* rascunho ilegivel ou sem armazenamento: o formulario segue normal */
    }

    setAvisos(avisosDoFormulario(form, horas));
    form.addEventListener('input', aoMudar);
    form.addEventListener('change', aoMudar);
    form.addEventListener('submit', aoEnviar);
    document.addEventListener('visibilitychange', aoSair);
    window.addEventListener('pagehide', aoSair);
    return () => {
      cancelado = true;
      form.removeEventListener('input', aoMudar);
      form.removeEventListener('change', aoMudar);
      form.removeEventListener('submit', aoEnviar);
      document.removeEventListener('visibilitychange', aoSair);
      window.removeEventListener('pagehide', aoSair);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, horasKey]);

  const texto: Record<Estado, string> = {
    parado: '',
    salvando: 'Salvando rascunho…',
    salvo: 'Rascunho salvo neste aparelho. Se atualizar ou fechar, o que foi preenchido volta.',
    recuperado: 'Rascunho recuperado neste aparelho. Confira os campos e salve o dia.',
    erro: 'Não foi possível guardar o rascunho neste aparelho.',
  };

  return (
    <div className="space-y-2">
      {avisos.length > 0 && (
        <div role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          <p className="font-semibold">Antes de salvar o dia, falta preencher:</p>
          <ul className="mt-1 list-disc pl-5">
            {avisos.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm text-ink-muted">
        {texto[estado]}
      </p>
    </div>
  );
}
