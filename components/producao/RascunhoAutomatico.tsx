'use client';

import { useEffect, useState } from 'react';

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

/** O que falta em cada hora: soldas esquecidas e paradas com so o inicio ou so o fim. */
function faltasDaHora(form: HTMLFormElement, hora: string): { campo: HTMLElement | null; textos: string[] } {
  const textos: string[] = [];
  const campo = (name: string) => form.elements.namedItem(name) as HTMLInputElement | null;
  const soldas = campo(`soldas_${hora}`)?.value.trim() ?? '';
  const cortes = campo(`cortes_${hora}`)?.value.trim() ?? '';
  let temParada = false;
  let primeiro: HTMLElement | null = null;
  for (let n = 1; n <= 3; n++) {
    const inicio = campo(`parada_inicio_${hora}_${n}`)?.value.trim() ?? '';
    const fim = (document.getElementById(`parada_fim_${hora}_${n}`) as HTMLInputElement | null)?.value.trim() ?? '';
    if (inicio || fim) temParada = true;
    if (inicio && !fim) {
      textos.push(`Parada ${n}: falta o horário do fim.`);
      primeiro ??= document.getElementById(`parada_fim_${hora}_${n}`);
    }
    if (!inicio && fim) {
      textos.push(`Parada ${n}: falta o horário do início.`);
      primeiro ??= campo(`parada_inicio_${hora}_${n}`);
    }
  }
  if (!soldas && (cortes || temParada)) {
    textos.unshift('Falta a quantidade de soldas.');
    primeiro = campo(`soldas_${hora}`) ?? primeiro;
  }
  return { campo: primeiro, textos };
}

export function RascunhoAutomatico({ data, horas }: { data: string; horas: string[] }) {
  const [estado, setEstado] = useState<Estado>('parado');
  const horasKey = horas.join(',');

  useEffect(() => {
    const form = document.getElementById('form-producao') as HTMLFormElement | null;
    if (!form) return;
    const listaHoras = horasKey.split(',');
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Soldas acumuladas do dia ate o fim de cada hora, atualizadas enquanto se digita.
    const mostrarAcumulado = () => {
      let total = 0;
      for (const hora of listaHoras) {
        const valor = parseInt((form.elements.namedItem(`soldas_${hora}`) as HTMLInputElement | null)?.value ?? '', 10);
        if (Number.isFinite(valor) && valor > 0) total += valor;
        const el = document.getElementById(`acum_hora_${hora}`);
        if (el) el.textContent = `Acumulado até as ${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}:00: ${total} soldas`;
      }
    };

    // Mostra, dentro de cada hora, o que falta. Retorna a primeira hora com falta.
    const mostrarFaltas = () => {
      let primeira: { hora: string; campo: HTMLElement | null } | null = null;
      for (const hora of listaHoras) {
        const aviso = document.getElementById(`aviso_hora_${hora}`);
        const { campo, textos } = faltasDaHora(form, hora);
        if (aviso) {
          aviso.textContent = textos.join(' ');
          aviso.hidden = textos.length === 0;
        }
        if (textos.length && !primeira) primeira = { hora, campo };
      }
      return primeira;
    };

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
      mostrarFaltas();
      mostrarAcumulado();
      if (timer) clearTimeout(timer);
      setEstado('salvando');
      timer = setTimeout(gravar, 400);
    };

    const aoSair = () => {
      if (document.visibilityState !== 'hidden') return;
      if (timer) clearTimeout(timer);
      gravar();
    };

    // Ao tentar salvar o dia com algo faltando: volta para a hora, abre e mostra o que falta.
    const aoEnviar = (e: Event) => {
      if (timer) clearTimeout(timer);
      const primeira = mostrarFaltas();
      if (primeira) {
        e.preventDefault();
        const bloco = document.getElementById(`hora_${primeira.hora}`) as HTMLDetailsElement | null;
        if (bloco) bloco.open = true;
        bloco?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        (primeira.campo as HTMLElement | null)?.focus({ preventScroll: true });
        return;
      }
      // Dia salvo de verdade: o rascunho deste dia e os inicios/fins das paradas saem do aparelho.
      try {
        localStorage.removeItem(chave(data));
        const prefixo = `producao-parada-${data}-`;
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefixo)) localStorage.removeItem(k);
        }
      } catch { /* sem armazenamento: nada a limpar */ }
    };

    try {
      const salvo = localStorage.getItem(chave(data));
      if (salvo) {
        const campos = JSON.parse(salvo) as Record<string, string>;
        for (const [nome, valor] of Object.entries(campos)) {
          // Inicio e fim das paradas voltam pelo proprio componente da parada (que guarda cada um separado).
          if (/^parada_(inicio|fim|descricao)_/.test(nome)) continue;
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
    mostrarFaltas();
    mostrarAcumulado();

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
      if (timer) clearTimeout(timer);
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
    <p role="status" aria-live="polite" className="text-sm text-ink-muted">
      {texto[estado]}
    </p>
  );
}
