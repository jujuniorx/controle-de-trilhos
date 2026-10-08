'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { informarPesoGrupoAction } from './actions';

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
    <div className="mt-2 rounded border p-2">
      <p className="text-xs font-medium text-amber-800">{label} — peso da NF a confirmar</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          className="h-9 w-28 rounded border px-2 text-sm"
          inputMode="decimal"
          value={pesoTexto}
          onChange={(e) => {
            setPesoTexto(e.target.value);
            setErro('');
          }}
        />
        <button
          className="h-9 rounded bg-steel px-3 text-sm text-white disabled:bg-neutral-300"
          disabled={salvando}
          onClick={salvar}
        >
          {salvando ? 'Salvando...' : 'Confirmar peso da NF'}
        </button>
      </div>
      {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
