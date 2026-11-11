'use client';

import { useState } from 'react';

/** Converte "HH:MM" em minutos do dia. Vazio ou inválido vira null. */
function paraMinutos(hora: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hora);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Tempo entre o início e o fim, atravessando a meia-noite se preciso. */
function tempoEntre(inicio: string, fim: string): number | null {
  const a = paraMinutos(inicio);
  const b = paraMinutos(fim);
  if (a === null || b === null) return null;
  return (b - a + 1440) % 1440;
}

/** 23 vira "0:23", como se escreve na planilha. */
function emHoraMin(minutos: number): string {
  return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, '0')}`;
}

/** Soma minutos a um "HH:MM" (para mostrar o fim de uma parada já salva). */
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
  minutosPadrao: number;
}

/**
 * As três primeiras colunas de uma parada: Início, Fim e Tempo de parada.
 * O soldador escolhe o início e o fim no relógio; o tempo (h:min) é calculado
 * sozinho e é o que vai para o servidor, no campo oculto parada_{hora}_{n}.
 */
export function CelulasParada({ hora, n, inicioPadrao, minutosPadrao }: Props) {
  const [inicio, setInicio] = useState(inicioPadrao);
  const [fim, setFim] = useState(inicioPadrao && minutosPadrao ? horaMais(inicioPadrao, minutosPadrao) : '');
  const [mexeu, setMexeu] = useState(false);

  const calculado = tempoEntre(inicio, fim);
  // Parada antiga, salva só com o tempo (sem início): mantém o tempo até alguém mexer nos horários.
  const minutos = calculado ?? (!mexeu ? minutosPadrao : 0);
  const tempo = minutos > 0 ? emHoraMin(minutos) : '';
  const faltaUm = Boolean(inicio) !== Boolean(fim);
  const iguais = Boolean(inicio) && inicio === fim;
  const id = `${hora}_${n}`;

  let aviso = '';
  if (faltaUm) aviso = inicio ? 'Escolha o fim' : 'Escolha o início';
  else if (iguais) aviso = 'Início e fim iguais';

  return (
    <>
      <td className="py-1 pr-2">
        <input
          aria-label={`Parada ${n}: início da parada às ${hora}`}
          id={`parada_inicio_${id}`}
          name={`parada_inicio_${id}`}
          type="time"
          value={inicio}
          onChange={(e) => { setInicio(e.target.value); setMexeu(true); }}
          className="h-11 w-full"
        />
      </td>
      <td className="py-1 pr-2">
        <input
          aria-label={`Parada ${n}: fim da parada às ${hora}`}
          id={`parada_fim_${id}`}
          name={`parada_fim_${id}`}
          type="time"
          value={fim}
          onChange={(e) => { setFim(e.target.value); setMexeu(true); }}
          className="h-11 w-full"
        />
      </td>
      <td className="py-1 pr-2">
        <output
          htmlFor={`parada_inicio_${id} parada_fim_${id}`}
          aria-label={`Parada ${n}: tempo de parada às ${hora}`}
          className="parada-tempo"
          data-aviso={aviso ? 'true' : undefined}
        >
          {aviso || tempo || '—'}
        </output>
        <input type="hidden" name={`parada_${id}`} value={tempo} />
      </td>
    </>
  );
}
