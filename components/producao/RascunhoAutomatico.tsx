'use client';

import { useEffect, useRef, useState } from 'react';
import { lerRascunhoAction, salvarRascunhoAction } from '@/app/producao/actions';

type Estado = 'parado' | 'salvando' | 'salvo' | 'erro' | 'recuperado';

/** Grava no servidor o que foi digitado, para nada se perder ao recarregar ou fechar o app. */
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
        if (typeof v === 'string') campos[k] = v;
      });
      return campos;
    };

    const gravar = async () => {
      setEstado('salvando');
      try {
        await salvarRascunhoAction(data, coletar());
        if (!cancelado) setEstado('salvo');
      } catch {
        if (!cancelado) setEstado('erro');
      }
    };

    const aoMudar = () => {
      if (timer.current) clearTimeout(timer.current);
      setEstado('salvando');
      timer.current = setTimeout(gravar, 700);
    };

    const aoSair = () => {
      if (document.visibilityState !== 'hidden') return;
      if (timer.current) clearTimeout(timer.current);
      void gravar();
    };

    lerRascunhoAction(data)
      .then((campos) => {
        if (cancelado || !campos) return;
        for (const [nome, valor] of Object.entries(campos)) {
          const el = form.elements.namedItem(nome);
          if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
            definirValor(el, valor);
          }
        }
        setEstado('recuperado');
      })
      .catch(() => {});

    form.addEventListener('input', aoMudar);
    form.addEventListener('change', aoMudar);
    document.addEventListener('visibilitychange', aoSair);
    window.addEventListener('pagehide', aoSair);
    return () => {
      cancelado = true;
      form.removeEventListener('input', aoMudar);
      form.removeEventListener('change', aoMudar);
      document.removeEventListener('visibilitychange', aoSair);
      window.removeEventListener('pagehide', aoSair);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data]);

  const texto: Record<Estado, string> = {
    parado: '',
    salvando: 'Salvando rascunho…',
    salvo: 'Rascunho salvo. O que você preencher fica guardado, mesmo se fechar o app.',
    recuperado: 'Rascunho recuperado. Confira os campos e salve o dia.',
    erro: 'Não foi possível salvar o rascunho agora. Confira a conexão.',
  };

  return (
    <p role="status" aria-live="polite" className="text-sm text-ink-muted">
      {texto[estado]}
    </p>
  );
}
