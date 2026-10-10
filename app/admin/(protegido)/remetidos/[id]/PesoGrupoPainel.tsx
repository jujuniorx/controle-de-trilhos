'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { informarPesoGrupoAction } from './actions';
import { PESO_MAX_GRUPO_T, MSG_PESO_UNIDADE } from '@/lib/validation/remetido';

export function PesoGrupoPainel({ grupoId, pesoEstimado, label }: { grupoId: string; pesoEstimado: number; label: string }) {
  const router = useRouter();
  const [pesoTexto, setPesoTexto] = useState(pesoEstimado > 0 ? String(pesoEstimado).replace('.', ',') : '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro('');
    const valor = Number(pesoTexto.replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um peso válido, maior que zero.');
      return;
    }
    if (valor > PESO_MAX_GRUPO_T) {
      setErro(MSG_PESO_UNIDADE);
      return;
    }
    setSalvando(true);
    const resultado = await informarPesoGrupoAction(grupoId, valor);
    setSalvando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Não foi possível salvar o peso.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="conf-block mt-2 !p-2">
      <p className="text-xs font-medium text-warn">{label} — peso da NF a confirmar</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          className="h-9 w-28 text-sm"
          inputMode="decimal"
          value={pesoTexto}
          onChange={(e) => {
            setPesoTexto(e.target.value);
            setErro('');
          }}
        />
        <span className="text-sm text-ink-muted">t</span>
        <button className="btn btn-primary btn-sm h-9" disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando...' : 'Confirmar peso da NF'}
        </button>
      </div>
      {erro && <p className="mt-1 text-sm text-bad">{erro}</p>}
    </div>
  );
}
