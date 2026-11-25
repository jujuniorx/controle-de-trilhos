'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { converterTipoAction } from '@/app/admin/(protegido)/actions-converter';
import type { TipoConvertido } from '@/lib/services/converterTipo';

const ROTULO_DESTINO: Record<TipoConvertido, string> = {
  REMETIDO: 'Converter em remetido',
  RECEBIMENTO: 'Converter em recebimento',
};

/**
 * Admin: quando o lançamento saiu com o tipo errado (carregamento lançado como descarga, ou o contrário).
 * Muda o tipo do mesmo registro, com motivo obrigatório. Fica no fim da ficha.
 */
export function ConverterTipoPainel({ movimentacaoId, tipoAtual }: { movimentacaoId: string; tipoAtual: TipoConvertido }) {
  const router = useRouter();
  const destino: TipoConvertido = tipoAtual === 'REMETIDO' ? 'RECEBIMENTO' : 'REMETIDO';
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    setErro('');
    setSalvando(true);
    const resultado = await converterTipoAction(movimentacaoId, destino, motivo);
    setSalvando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Não foi possível converter.');
      return;
    }
    setAberto(false);
    setMotivo('');
    router.refresh();
  }

  return (
    <section className="card space-y-3 p-4">
      <p className="text-sm font-semibold">Tipo da movimentação</p>
      <p className="text-xs text-ink-muted">
        Use quando o lançamento saiu com o tipo errado (por exemplo, carregamento lançado como descarga). Medições, NF e grupos continuam os mesmos.
      </p>
      {!aberto ? (
        <button className="btn h-11" onClick={() => setAberto(true)}>
          {ROTULO_DESTINO[destino]}
        </button>
      ) : (
        <div className="space-y-2">
          <label className="space-y-1 text-sm">
            <span className="text-ink-muted">Motivo da conversão</span>
            <input
              className="h-11 w-full"
              value={motivo}
              maxLength={200}
              placeholder="Ex.: era carregamento, lançado como descarga pela portaria"
              onChange={(e) => {
                setMotivo(e.target.value);
                setErro('');
              }}
            />
          </label>
          <div className="flex gap-2">
            <button className="btn btn-primary h-11" disabled={salvando} onClick={confirmar}>
              {salvando ? 'Convertendo...' : ROTULO_DESTINO[destino]}
            </button>
            <button className="btn h-11" disabled={salvando} onClick={() => setAberto(false)}>
              Cancelar
            </button>
          </div>
          {erro && <p className="text-sm text-bad">{erro}</p>}
        </div>
      )}
    </section>
  );
}
