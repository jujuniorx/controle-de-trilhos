'use client';

import { useState } from 'react';

/** Converte "HH:MM" em minutos do dia. Vazio ou inválido vira null. */
function paraMinutos(hora: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Tempo entre início e fim, atravessando a meia-noite se preciso. */
export function tempoEntre(inicio: string, fim: string): number | null {
  const a = paraMinutos(inicio);
  const b = paraMinutos(fim);
  if (a === null || b === null) return null;
  return (b - a + 1440) % 1440;
}

function formataTempo(minutos: number): string {
  return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, '0')}`;
}

/** Soma minutos a um "HH:MM" (usado para preencher o "Até" a partir do tempo já salvo). */
function horaMais(inicio: string, minutos: number): string {
  const a = paraMinutos(inicio);
  if (a === null) return '';
  const t = (a + minutos) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

interface Props {
  hora: string;
  n: number;
  inicioPadrao: string;
  minutosPadrao: number | null;
}

/**
 * Uma parada: o Início e o Até são horários escolhidos no relógio. O tempo é calculado
 * sozinho (Até menos Início) e vai, em h:min, para o campo oculto que a ação salva.
 */
export function CelulasParada({ hora, n, inicioPadrao, minutosPadrao }: Props) {
  const [inicio, setInicio] = useState(inicioPadrao);
  const [fim, setFim] = useState(
    minutosPadrao && inicioPadrao ? horaMais(inicioPadrao, minutosPadrao) : '',
  );
  const minutos = tempoEntre(inicio, fim);
  const valorTempo = minutos && minutos > 0 ? formataTempo(minutos) : '';
  const id = `${hora}_${n}`;

  return (
    <>
      <td className="py-1 pr-2">
        <input
          aria-label={`Parada ${n}: início da parada às ${hora}`}
          id={`parada_inicio_${id}`}
          name={`parada_inicio_${id}`}
          type="time"
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          className="h-11 w-full"
        />
      </td>
      <td className="py-1 pr-2">
        <div className="flex items-center gap-2">
          <input
            aria-label={`Parada ${n}: até que horas foi a parada às ${hora}`}
            id={`parada_fim_${id}`}
            type="time"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="h-11 w-full"
          />
          <span className="whitespace-nowrap text-sm tabular-nums text-ink-muted" aria-live="polite">
            {valorTempo ? `= ${valorTempo}` : ''}
          </span>
        </div>
        {/* Valor final em h:min, o que a ação grava. */}
        <input type="hidden" name={`parada_${id}`} value={valorTempo} />
      </td>
    </>
  );
}
