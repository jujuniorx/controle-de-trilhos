'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { marcarCarregadoAction } from '@/app/patio/(protegido)/recebimentos/actions';

/** Converte a medição digitada ("12,5" ou "12.5") em metros. Vazio ou inválido vira null. */
function lerMedidaM(texto: string): number | null {
  const n = Number(texto.trim().replace(',', '.'));
  return texto.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
}

/** Pátio, carga e descarga: carregou. A medição da carga é obrigatória e libera a saída. */
export function CarregadoBotao({ id }: { id: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [medida, setMedida] = useState('');
  const [erro, setErro] = useState('');
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-ink" htmlFor={`${id}-medida-carga`}>
        Medição da carga (metros)
      </label>
      <input
        id={`${id}-medida-carga`}
        inputMode="decimal"
        className="h-12 w-full"
        value={medida}
        onChange={(e) => setMedida(e.target.value)}
        placeholder="Ex.: 120,5"
        autoComplete="off"
        disabled={pendente}
      />
      <button
        type="button"
        className="btn btn-primary h-12 w-full"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro('');
            const medidaM = lerMedidaM(medida);
            if (medidaM === null) {
              setErro('Informe a medição da carga antes de liberar a saída.');
              return;
            }
            try {
              const r = await marcarCarregadoAction(id, medidaM);
              if (!r.ok) setErro(r.erro ?? 'Não foi possível concluir.');
              else router.refresh();
            } catch {
              setErro('Sem conexão. Tente de novo quando houver internet.');
            }
          })
        }
      >
        {pendente ? 'Aguarde...' : 'Carregado — pode liberar a saída'}
      </button>
      {erro && <p role="alert" className="text-sm text-bad">{erro}</p>}
    </div>
  );
}
