'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { liberarCarretaAction, salvarDadosAction, type ResultadoPortaria } from './actions';
import { ROTULO_ESTADO } from '@/lib/domain/portaria';
import type { ItemPortaria } from '@/lib/services/portaria';

const TIPO_REMETIDO: Record<string, string> = { VENDA: 'Venda', TRANS: 'Transferência', INDUS: 'Industrialização' };
const BADGE = { MEDINDO: 'badge-muted', AGUARDANDO_CARRETA: 'badge-warn', LIBERADA: 'badge-ok' } as const;

function limparPlaca(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

export function CartaoPortaria({ item }: { item: ItemPortaria }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(item.estado === 'AGUARDANDO_CARRETA');
  const [resultado, setResultado] = useState<ResultadoPortaria | null>(null);
  const [v, setV] = useState({
    transportadora: item.transportadora ?? '',
    motoristaNome: item.motoristaNome ?? '',
    motoristaCpf: item.motoristaCpf ?? '',
    motoristaTelefone: item.motoristaTelefone ?? '',
    placaCarreta: item.placaCarreta ?? '',
    placaCavalo: item.placaCavalo ?? '',
    capacidadeCarga: item.capacidadeCarga != null ? String(item.capacidadeCarga).replace('.', ',') : '',
    origem: item.origem ?? '',
    destino: item.destino ?? '',
    materialPrevisto: item.materialPrevisto ?? '',
  });
  const set = (campo: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((atual) => ({ ...atual, [campo]: String(campo).startsWith('placa') ? limparPlaca(e.target.value) : e.target.value }));

  const liberada = item.estado === 'LIBERADA';
  const medindo = item.estado === 'MEDINDO';

  function enviar(acao: (id: string, dados: unknown) => Promise<ResultadoPortaria>) {
    setResultado(null);
    iniciar(async () => {
      try {
        const r = await acao(item.id, v);
        setResultado(r);
        if (r.ok) router.refresh();
      } catch {
        setResultado({ ok: false, erro: 'Sem conexão. Tente de novo.' });
      }
    });
  }

  const campo = (id: keyof typeof v, rotulo: string, extra: { inputMode?: 'numeric' | 'tel' | 'decimal'; maxLength?: number; className?: string } = {}) => (
    <div className={`field ${extra.className ?? ''}`}>
      <label htmlFor={`${item.id}-${id}`}>{rotulo}</label>
      <input
        id={`${item.id}-${id}`}
        value={v[id]}
        onChange={set(id)}
        className="h-12"
        inputMode={extra.inputMode}
        maxLength={extra.maxLength}
        autoComplete="off"
        disabled={pendente}
      />
    </div>
  );

  return (
    <section className="card space-y-3 p-4">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span>
          <span className="block font-medium text-ink">{item.destino || 'Remetido'}</span>
          <span className="block text-sm text-ink-muted">
            {TIPO_REMETIDO[item.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'}
            {item.reservaPedido ? ` · Reserva ${item.reservaPedido}` : ''}
            {item.numeroDocumento ? ` · NF ${item.numeroDocumento}` : ''}
          </span>
        </span>
        <span className={`badge ${BADGE[item.estado]} shrink-0`}>{ROTULO_ESTADO[item.estado]}</span>
      </button>

      {aberto && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(salvarDadosAction);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {campo('transportadora', 'Empresa (transportadora)')}
            {campo('motoristaNome', 'Motorista')}
            {campo('motoristaCpf', 'CPF do motorista', { inputMode: 'numeric', maxLength: 14 })}
            {campo('motoristaTelefone', 'Telefone do motorista', { inputMode: 'tel', maxLength: 16 })}
            {campo('placaCarreta', 'Placa da carreta', { maxLength: 7 })}
            {campo('placaCavalo', 'Placa do cavalo', { maxLength: 7 })}
            {campo('capacidadeCarga', 'Capacidade de carga (t)', { inputMode: 'decimal', maxLength: 6 })}
            {campo('materialPrevisto', 'Material')}
            {campo('origem', 'Origem')}
            {campo('destino', 'Destino')}
          </div>

          {medindo && <p className="text-sm text-ink-muted">O Pátio ainda está medindo. Você já pode salvar os dados; a liberação só fica disponível quando ele terminar.</p>}
          {liberada && <p className="text-sm text-ok">Carreta já liberada. Você ainda pode corrigir os dados.</p>}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-ghost h-12" disabled={pendente}>
              Salvar dados
            </button>
            {!liberada && (
              <button type="button" className="btn btn-primary h-12" disabled={pendente || medindo} onClick={() => enviar(liberarCarretaAction)}>
                {pendente ? 'Aguarde...' : 'Liberar carreta'}
              </button>
            )}
          </div>

          {resultado?.erro && (
            <p role="alert" className="text-sm text-bad">
              {resultado.erro}
            </p>
          )}
          {resultado?.ok && resultado.mensagem && <p role="status" className="badge badge-ok !text-sm !normal-case">{resultado.mensagem}</p>}
        </form>
      )}
    </section>
  );
}
