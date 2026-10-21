'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CampoObservacao, ICONE_CAMINHAO, Secao } from '@/components/portaria/Secao';
import { confirmarSaidaAction, desfazerSaidaAction, registrarChegadaAction, salvarDadosAction, type ResultadoPortaria } from './actions';
import { ROTULO_ESTADO } from '@/lib/domain/portaria';
import type { ItemPortaria } from '@/lib/services/portaria';
import { formatarCpfDigitado, formatarTelefoneDigitado } from '@/lib/validation/portaria';
import { formatarCpf, formatarTelefone } from '@/lib/domain/portaria';

const TIPO_REMETIDO: Record<string, string> = { VENDA: 'Venda', TRANS: 'Transferência', INDUS: 'Industrialização' };
const BADGE = { AGUARDANDO_CARRETA: 'badge-muted', CHEGOU: 'badge-warn', LIBERADA: 'badge-ok', SAIU: 'badge-info' } as const;

function hora(d: Date | null): string {
  return d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '';
}

function limparPlaca(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

export function CartaoPortaria({ item }: { item: ItemPortaria }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(item.estado === 'AGUARDANDO_CARRETA' || item.estado === 'LIBERADA');
  const [resultado, setResultado] = useState<ResultadoPortaria | null>(null);
  const [v, setV] = useState({
    transportadora: item.transportadora ?? '',
    motoristaNome: item.motoristaNome ?? '',
    motoristaCpf: formatarCpf(item.motoristaCpf),
    motoristaTelefone: formatarTelefone(item.motoristaTelefone),
    placaCarreta: item.placaCarreta ?? '',
    placaCarreta2: item.placaCarreta2 ?? '',
    placaCavalo: item.placaCavalo ?? '',
    capacidadeCarga: item.capacidadeCarga != null ? String(item.capacidadeCarga).replace('.', ',') : '',
    comprimentoCarreta: item.comprimentoCarreta != null ? String(item.comprimentoCarreta).replace('.', ',') : '',
    origem: item.origem ?? '',
    destino: item.destino ?? '',
    materialPrevisto: item.materialPrevisto ?? '',
    observacao: item.observacaoPortaria ?? '',
  });
  const set = (campo: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((atual) => ({ ...atual, [campo]: campo === 'motoristaCpf' ? formatarCpfDigitado(e.target.value) : campo === 'motoristaTelefone' ? formatarTelefoneDigitado(e.target.value) : String(campo).startsWith('placa') ? limparPlaca(e.target.value) : e.target.value }));

  const aguardando = item.estado === 'AGUARDANDO_CARRETA';
  const chegou = item.estado === 'CHEGOU';
  const liberada = item.estado === 'LIBERADA';
  const saiu = item.estado === 'SAIU';
  const semSalvar = saiu;

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
        disabled={pendente || saiu}
      />
    </div>
  );

  return (
    <section className="card space-y-4">
      <button type="button" className="flex w-full flex-col items-start gap-2 text-left" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-primary/15 text-primary">{ICONE_CAMINHAO}</span>
          <span className="min-w-0">
          <span className="block break-words font-semibold text-ink">{item.destino || 'Carga'}</span>
          <span className="block text-sm text-ink-muted">
            {TIPO_REMETIDO[item.remetidoDetalhe?.tipoRemetido ?? ''] ?? '—'}
            {item.reservaPedido ? ` · Reserva ${item.reservaPedido}` : ''}
            {item.numeroDocumento ? ` · NF ${item.numeroDocumento}` : ''}
          </span>
          {item.chegadaPortariaEm && (
            <span className="block text-xs text-ink-muted">
              Chegou {hora(item.chegadaPortariaEm)}
              {item.saidaPortariaEm ? ` · Saiu ${hora(item.saidaPortariaEm)}` : ''}
            </span>
          )}
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
          <Secao titulo="Motorista">
            {campo('transportadora', 'Empresa (transportadora)')}
            {campo('motoristaNome', 'Motorista')}
            {campo('motoristaCpf', 'CPF do motorista', { inputMode: 'numeric', maxLength: 14 })}
            {campo('motoristaTelefone', 'Telefone do motorista', { inputMode: 'tel', maxLength: 16 })}
          </Secao>
          <Secao titulo="Caminhão">
            {campo('placaCarreta', 'Placa da carreta', { maxLength: 7 })}
            {campo('placaCarreta2', 'Placa da 2ª carreta (opcional)', { maxLength: 7 })}
            {campo('placaCavalo', 'Placa do cavalo', { maxLength: 7 })}
          </Secao>
          <Secao titulo="Carga">
            {campo('materialPrevisto', 'Material')}
            {campo('origem', 'Origem')}
            {campo('destino', 'Destino')}
          </Secao>
          <div className="grid grid-cols-2 gap-2">
            {campo('capacidadeCarga', 'Limite de carga (t)', { inputMode: 'decimal', maxLength: 6 })}
            {campo('comprimentoCarreta', 'Comprimento da carreta (m)', { inputMode: 'decimal', maxLength: 6 })}
          </div>
          <CampoObservacao id={`${item.id}-observacao`} valor={v.observacao} aoMudar={(x) => setV((a) => ({ ...a, observacao: x }))} desabilitado={pendente || saiu} />

          {aguardando && <p className="text-sm text-ink-muted">Quando a carreta chegar, preencha ao menos uma placa e toque em &ldquo;Registrar chegada&rdquo;. O Pátio será avisado.</p>}
          {chegou && <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">Chegada registrada. Agora o Pátio carrega e libera a carreta; você será avisado.</p>}
          {liberada && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">O Pátio liberou a carreta. Quando ela passar pela portaria, toque em &ldquo;Saída confirmada&rdquo;.</p>}
          {saiu && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-muted">Carreta saiu. Só consulta.</p>}
          {saiu && (
            <button
              type="button"
              className="btn btn-ghost h-12 w-full"
              disabled={pendente}
              onClick={() => {
                setResultado(null);
                iniciar(async () => {
                  try {
                    const r = await desfazerSaidaAction(item.id);
                    setResultado(r);
                    if (r.ok) router.refresh();
                  } catch {
                    setResultado({ ok: false, erro: 'Sem conexão. Tente de novo.' });
                  }
                });
              }}
            >
              {pendente ? 'Aguarde...' : 'Desfazer saída (voltar para a portaria)'}
            </button>
          )}

          <p className="text-xs text-ink-muted">O PDF leva o que está <b>salvo</b>: toque em &ldquo;Salvar dados&rdquo; antes de baixar.</p>
          <div className="grid grid-cols-2 gap-2">
            {!semSalvar && (
              <button type="submit" className="btn btn-ghost h-12" disabled={pendente}>
                Salvar dados
              </button>
            )}
            <a href={`/portaria/pdf/${item.id}`} download className={`btn btn-ghost h-12 ${semSalvar ? 'col-span-2' : ''}`} aria-label="Baixar PDF com os dados preenchidos">
              Baixar PDF
            </a>
            {aguardando && (
              <button type="button" className="btn btn-primary h-12 col-span-2 order-first" disabled={pendente} onClick={() => enviar(registrarChegadaAction)}>
                {pendente ? 'Aguarde...' : 'Registrar chegada'}
              </button>
            )}
            {liberada && (
              <button
                type="button"
                className="btn btn-primary h-12 col-span-2 order-first"
                disabled={pendente}
                onClick={() => {
                  setResultado(null);
                  iniciar(async () => {
                    try {
                      const r = await confirmarSaidaAction(item.id);
                      setResultado(r);
                      if (r.ok) router.refresh();
                    } catch {
                      setResultado({ ok: false, erro: 'Sem conexão. Tente de novo.' });
                    }
                  });
                }}
              >
                {pendente ? 'Aguarde...' : 'Saída confirmada'}
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
