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

export function RascunhoAutomatico({ data }: { data: string }) {
  const [estado, setEstado] = useState<Estado>('parado');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const form = document.getElementById('form-producao') as HTMLFormElement | null;
    if (!form) return;
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
  }, [data]);

  const texto: Record<Estado, string> = {
    parado: '',
    salvando: 'Salvando rascunho…',
    salvo: 'Rascunho salvo neste aparelho. Se atualizar ou fechar, o que foi preenchido volta.',
    recuperado: 'Rascunho recuperado neste aparelho. Confira os campos e salve o dia.',
    erro: 'Não foi possível guardar o rascunho neste aparelho.',
  };

  return (
    <p role="status" aria-live="polite" className="text-sm text-ink-muted">
      {texto[estado]}
    </p>
  );
}
