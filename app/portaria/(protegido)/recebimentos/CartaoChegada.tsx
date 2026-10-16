'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CampoObservacao, ICONE_CAMINHAO, Secao } from '@/components/portaria/Secao';
import { cancelarChegadaAction, confirmarSaidaChegadaAction, registrarChegadaAction, salvarChegadaAction } from './actions';
import type { ResultadoPortaria } from '../actions';
import { ROTULO_ESTADO_CHEGADA } from '@/lib/domain/portaria';
import { formatarCpfDigitado } from '@/lib/validation/portaria';
import type { ItemChegada } from '@/lib/services/chegada';

const BADGE_CHEGADA = { AGUARDANDO_LIBERACAO: 'badge-muted', LIBERADA: 'badge-warn', RECEBIDA: 'badge-ok', SAIU: 'badge-info', CANCELADA: 'badge-muted' } as const;

function limparPlaca(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

function hora(d: Date): string {
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function dataHora(d: Date): string {
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}

export function CartaoChegada({ item }: { item: ItemChegada }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aberto, setAberto] = useState(item.estado === 'AGUARDANDO_LIBERACAO' || item.estado === 'RECEBIDA');
  const [confirmaCancelar, setConfirmaCancelar] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPortaria | null>(null);
  const [v, setV] = useState({
    transportadora: item.transportadora ?? '',
    motoristaNome: item.motoristaNome ?? '',
    motoristaCpf: item.motoristaCpf ?? '',
    motoristaTelefone: item.motoristaTelefone ?? '',
    placaCarreta: item.placaCarreta ?? '',
    placaCarreta2: item.placaCarreta2 ?? '',
    placaCavalo: item.placaCavalo ?? '',
    capacidadeCarga: item.capacidadeCarga != null ? String(item.capacidadeCarga).replace('.', ',') : '',
    comprimentoCarreta: item.comprimentoCarreta != null ? String(item.comprimentoCarreta).replace('.', ',') : '',
    materialPrevisto: item.materialPrevisto ?? '',
    observacao: item.observacao ?? '',
    origem: item.origem ?? '',
  });
  const set = (campo: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((atual) => ({ ...atual, [campo]: campo === 'motoristaCpf' ? formatarCpfDigitado(e.target.value) : String(campo).startsWith('placa') ? limparPlaca(e.target.value) : e.target.value }));

  const rascunho = item.estado === 'AGUARDANDO_LIBERACAO';
  const chegou = item.estado === 'LIBERADA';
  const descarregado = item.estado === 'RECEBIDA';
  const saiu = item.estado === 'SAIU';
  const semSalvar = saiu || descarregado;

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

  function cancelar() {
    setResultado(null);
    iniciar(async () => {
      try {
        const r = await cancelarChegadaAction(item.id);
        if (!r.ok) setResultado(r);
        else router.refresh();
      } catch {
        setResultado({ ok: false, erro: 'Sem conexão. Tente de novo.' });
      }
    });
  }

  const campo = (id: keyof typeof v, rotulo: string, extra: { inputMode?: 'numeric' | 'tel' | 'decimal'; maxLength?: number; placeholder?: string } = {}) => (
    <div className="field">
      <label htmlFor={`${item.id}-${id}`}>{rotulo}</label>
      <input
        id={`${item.id}-${id}`}
        value={v[id]}
        onChange={set(id)}
        className="h-12"
        inputMode={extra.inputMode}
        maxLength={extra.maxLength}
        placeholder={extra.placeholder}
        autoComplete="off"
        disabled={pendente || saiu || descarregado}
      />
    </div>
  );

  const titulo = item.placaCarreta || item.placaCavalo || item.motoristaNome || 'Caminhão sem identificação';

  return (
    <section className="card space-y-4">
      <button type="button" className="flex w-full flex-col items-start gap-2 text-left" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-primary/15 text-primary">{ICONE_CAMINHAO}</span>
          <span className="min-w-0">
          <span className="block break-words font-semibold text-ink">{titulo}</span>
          <span className="block text-sm text-ink-muted">
            {item.origem ? `${item.origem} · ` : ''}{item.liberadaEm ? `chegou às ${hora(item.liberadaEm)}` : `aberta às ${hora(item.criadoEm)}`}
            {item.saidaEm ? ` · saiu ${dataHora(item.saidaEm)}` : ''}
          </span>
          </span>
        </span>
        <span className={`badge ${BADGE_CHEGADA[item.estado]} shrink-0`}>{ROTULO_ESTADO_CHEGADA[item.estado]}</span>
      </button>

      {aberto && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(salvarChegadaAction);
          }}
        >
          <Secao titulo="Motorista">
            {campo('transportadora', 'Empresa (transportadora)')}
            {campo('motoristaNome', 'Motorista')}
            {campo('motoristaCpf', 'CPF do motorista', { inputMode: 'numeric', maxLength: 14, placeholder: '000.000.000-00' })}
            {campo('motoristaTelefone', 'Telefone do motorista', { inputMode: 'tel', maxLength: 16, placeholder: '(00) 00000-0000' })}
          </Secao>
          <Secao titulo="Caminhão">
            {campo('placaCarreta', 'Placa da carreta', { maxLength: 7, placeholder: 'ABC1D23' })}
            {campo('placaCarreta2', 'Placa da 2ª carreta (opcional)', { maxLength: 7, placeholder: 'ABC1D23' })}
            {campo('placaCavalo', 'Placa do cavalo', { maxLength: 7, placeholder: 'ABC1D23' })}
          </Secao>
          <Secao titulo="Carga">
            {campo('materialPrevisto', 'Material')}
            {campo('origem', 'Origem')}
          </Secao>
          <div className="grid grid-cols-2 gap-2">
            {campo('capacidadeCarga', 'Limite de carga (t)', { inputMode: 'decimal', maxLength: 6, placeholder: 'ex.: 48' })}
            {campo('comprimentoCarreta', 'Comprimento da carreta (m)', { inputMode: 'decimal', maxLength: 6, placeholder: 'ex.: 15,5' })}
          </div>
          <CampoObservacao id={`${item.id}-observacao`} valor={v.observacao} aoMudar={(x) => setV((a) => ({ ...a, observacao: x }))} desabilitado={pendente || saiu || descarregado} />

          {rascunho && <p className="text-sm text-ink-muted">Preencha ao menos uma placa e toque em &ldquo;Registrar chegada&rdquo;. O Pátio será avisado.</p>}
          {chegou && <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">Chegada registrada. O Pátio vai descarregar; você será avisado quando terminar.</p>}
          {descarregado && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">O Pátio descarregou. Quando o caminhão passar pela portaria, toque em &ldquo;Saída confirmada&rdquo;.</p>}
          {saiu && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-muted">Caminhão saiu. Só consulta.</p>}
          {!rascunho && <p className="text-xs text-ink-muted">O PDF leva o que está <b>salvo</b>: toque em &ldquo;Salvar dados&rdquo; antes de baixar.</p>}

          <div className="grid grid-cols-2 gap-2">
            {!semSalvar && !rascunho && (
              <button type="submit" className="btn btn-ghost h-12" disabled={pendente}>
                Salvar dados
              </button>
            )}
            <a href={`/portaria/pdf-chegada/${item.id}`} download className={`btn btn-ghost h-12 ${semSalvar || rascunho ? 'col-span-2' : ''}`} aria-label="Baixar PDF com os dados preenchidos">
              Baixar PDF
            </a>
            {rascunho && (
              <button type="button" className="btn btn-primary h-12 col-span-2 order-first" disabled={pendente} onClick={() => enviar(registrarChegadaAction)}>
                {pendente ? 'Aguarde...' : 'Registrar chegada'}
              </button>
            )}
            {descarregado && (
              <button
                type="button"
                className="btn btn-primary h-12 col-span-2 order-first"
                disabled={pendente}
                onClick={() => {
                  setResultado(null);
                  iniciar(async () => {
                    try {
                      const r = await confirmarSaidaChegadaAction(item.id);
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

          {(rascunho || chegou) && (!confirmaCancelar ? (
            <button type="button" className="text-sm text-ink-muted underline" onClick={() => setConfirmaCancelar(true)}>
              Cancelar esta chegada
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Cancelar esta chegada?</span>
              <button type="button" className="btn btn-ghost btn-sm text-bad" disabled={pendente} onClick={cancelar}>
                Sim, cancelar
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmaCancelar(false)}>
                Não
              </button>
            </div>
          ))}

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
