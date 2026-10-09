'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseNumeroBR } from '@/lib/domain/regras';
import { informarPesoSucataAction, conferirRecebimentoAction } from './actions';

interface Props {
  movimentacaoId: string;
  status: 'PENDENTE_CONFERENCIA' | 'CONFERIDO';
  temSucata: boolean;
  pesoSucataReal: number | null;
  /** Estimativa calculada (metros x fator) — usada só para pré-preencher o campo quando ainda não há peso real. */
  pesoSucataEstimado?: number;
}

export function ConferenciaPainel({ movimentacaoId, status, temSucata, pesoSucataReal, pesoSucataEstimado = 0 }: Props) {
  const router = useRouter();
  const [pesoTexto, setPesoTexto] = useState(
    pesoSucataReal != null
      ? String(pesoSucataReal).replace('.', ',')
      : pesoSucataEstimado > 0
        ? String(pesoSucataEstimado).replace('.', ',')
        : '',
  );
  const [erroPeso, setErroPeso] = useState('');
  const [salvandoPeso, setSalvandoPeso] = useState(false);

  const [erroConferir, setErroConferir] = useState('');
  const [conferindo, setConferindo] = useState(false);

  const pesoPendente = temSucata && pesoSucataReal == null;
  const podeConferir = status === 'PENDENTE_CONFERENCIA' && !pesoPendente;

  async function salvarPeso() {
    setErroPeso('');
    const valor = parseNumeroBR(pesoTexto);
    if (valor == null) {
      setErroPeso('Informe um peso válido, maior que zero, ex.: 1,250.');
      return;
    }
    setSalvandoPeso(true);
    const resultado = await informarPesoSucataAction(movimentacaoId, valor);
    setSalvandoPeso(false);
    if (!resultado.ok) {
      setErroPeso(resultado.erro ?? 'Não foi possível salvar o peso.');
      return;
    }
    router.refresh();
  }

  async function conferir() {
    setErroConferir('');
    setConferindo(true);
    const resultado = await conferirRecebimentoAction(movimentacaoId);
    setConferindo(false);
    if (!resultado.ok) {
      setErroConferir(resultado.erro ?? 'Não foi possível conferir o recebimento.');
      return;
    }
    router.refresh();
  }

  return (
    <section className="card">
      <h2 className="card-title">Conferência</h2>

      {status === 'CONFERIDO' ? (
        <span className="badge badge-ok">CONFERIDO</span>
      ) : (
        <span className="badge badge-warn">PENDENTE DE CONFERÊNCIA</span>
      )}

      {temSucata && (
        <div className="conf-block mt-3">
          {pesoPendente && (
            <p className="mb-2 font-semibold text-warn">
              Peso da sucata pendente. Informe o peso real antes de conferir o recebimento.
            </p>
          )}
          <label className="field-label block" htmlFor="peso-sucata">
            Peso real da sucata (t) — com base no documento de pesagem
          </label>
          {pesoSucataReal == null && pesoSucataEstimado > 0 && (
            <p className="mb-1 mt-1 text-xs text-ink-dim">
              Valor sugerido pelo cálculo automático (metros × fator do perfil). Confirme ou corrija com o peso real da pesagem.
            </p>
          )}
          <div className="mt-1 flex gap-2">
            <input
              id="peso-sucata"
              className="h-11 flex-1"
              inputMode="decimal"
              placeholder="Ex.: 1,250"
              value={pesoTexto}
              onChange={(e) => {
                setPesoTexto(e.target.value);
                setErroPeso('');
              }}
            />
            <button className="btn btn-primary h-11" disabled={salvandoPeso} onClick={salvarPeso}>
              {salvandoPeso ? 'Salvando...' : pesoSucataReal != null ? 'Corrigir peso' : 'Salvar peso'}
            </button>
          </div>
          {erroPeso && <p className="mt-1 text-sm text-bad">{erroPeso}</p>}
        </div>
      )}

      {status !== 'CONFERIDO' && (
        <div className="mt-3">
          <button className="btn btn-primary btn-lg h-12" disabled={!podeConferir || conferindo} onClick={conferir}>
            {conferindo ? 'Conferindo...' : 'Conferir recebimento'}
          </button>
          {erroConferir && <p className="mt-1 text-sm text-bad">{erroConferir}</p>}
        </div>
      )}
    </section>
  );
}
