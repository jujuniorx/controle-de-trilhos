'use client';

import { useEffect, useRef, useState } from 'react';
import { buscarMotoristaAction } from '@/app/portaria/(protegido)/actions';
import { ICONE_REMETIDOS } from '@/components/portaria/icones';
import { formatarTelefone } from '@/lib/domain/portaria';
import type { MotoristaEncontrado, VeiculoMotorista } from '@/lib/domain/motoristaPortaria';

/** Campos que a escolha preenche, já no formato dos campos da tela (vírgula decimal, telefone com máscara). */
export interface DadosMotoristaEscolhido {
  transportadora?: string;
  motoristaNome?: string;
  motoristaTelefone?: string;
  placaCavalo?: string;
  placaCarreta?: string;
  placaCarreta2?: string;
  capacidadeCarga?: string;
  comprimentoCarreta?: string;
}

type Estado = 'parado' | 'buscando' | 'achou' | 'nada' | 'erro';

const decimal = (n: number | null) => (n == null ? undefined : String(n).replace('.', ','));
const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit' });
const placasDe = (v: VeiculoMotorista) => [v.placaCavalo, v.placaCarreta, v.placaCarreta2].filter(Boolean).join(' / ');

/**
 * Embaixo do campo de CPF: quando o CPF fica completo, busca as viagens anteriores desse motorista e
 * mostra os caminhões que ele já usou. Tocar em um preenche motorista, empresa, placas, limite e
 * comprimento; a Portaria confere e salva como sempre. O CPF que já vem salvo no cartão não dispara busca.
 */
export function BuscaMotorista({
  cpf,
  excluirId,
  aoEscolher,
  desabilitado = false,
}: {
  cpf: string;
  /** Cartão aberto: a própria viagem não entra na lista. */
  excluirId?: string;
  aoEscolher: (dados: DadosMotoristaEscolhido) => void;
  desabilitado?: boolean;
}) {
  const digitos = cpf.replace(/\D/g, '');
  const buscado = useRef(digitos.length === 11 ? digitos : '');
  const [estado, setEstado] = useState<Estado>('parado');
  const [motorista, setMotorista] = useState<MotoristaEncontrado | null>(null);
  const [erro, setErro] = useState('');
  const [escolhido, setEscolhido] = useState<string | null>(null);

  useEffect(() => {
    if (desabilitado) return;
    if (digitos.length !== 11) {
      buscado.current = '';
      setEstado('parado');
      setMotorista(null);
      setEscolhido(null);
      return;
    }
    if (buscado.current === digitos) return;
    let cancelado = false;
    const timer = setTimeout(async () => {
      buscado.current = digitos;
      setEstado('buscando');
      setEscolhido(null);
      try {
        const r = await buscarMotoristaAction(digitos, excluirId);
        if (cancelado) return;
        if (!r.ok) {
          setErro(r.erro);
          setEstado('erro');
          return;
        }
        setMotorista(r.motorista);
        setEstado(r.motorista ? 'achou' : 'nada');
      } catch {
        if (cancelado) return;
        buscado.current = '';
        setErro('Sem conexão. Preencha os dados à mão.');
        setEstado('erro');
      }
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [digitos, desabilitado, excluirId]);

  if (desabilitado || estado === 'parado') return null;

  if (estado === 'buscando') {
    return (
      <p role="status" className="text-sm text-ink-muted sm:col-span-2">
        Procurando viagens anteriores deste CPF...
      </p>
    );
  }
  if (estado === 'nada') {
    return (
      <p role="status" className="text-sm text-ink-muted sm:col-span-2">
        Primeira vez deste CPF por aqui. Preencha os dados do motorista e do caminhão.
      </p>
    );
  }
  if (estado === 'erro' || !motorista) {
    return (
      <p role="alert" className="text-sm text-bad sm:col-span-2">
        {erro || 'Não foi possível buscar agora. Preencha os dados à mão.'}
      </p>
    );
  }

  const m = motorista;
  function preencher(chave: string, v?: VeiculoMotorista) {
    const d: DadosMotoristaEscolhido = {};
    if (m.nome) d.motoristaNome = m.nome;
    if (m.telefone) d.motoristaTelefone = formatarTelefone(m.telefone);
    const empresa = v?.transportadora ?? m.transportadora;
    if (empresa) d.transportadora = empresa;
    if (v) {
      // O caminhão é a combinação de placas: as que ele não tem ficam em branco.
      d.placaCavalo = v.placaCavalo ?? '';
      d.placaCarreta = v.placaCarreta ?? '';
      d.placaCarreta2 = v.placaCarreta2 ?? '';
      const cap = decimal(v.capacidadeCarga);
      const comp = decimal(v.comprimentoCarreta);
      if (cap) d.capacidadeCarga = cap;
      if (comp) d.comprimentoCarreta = comp;
    }
    aoEscolher(d);
    setEscolhido(chave);
  }

  const resumo = [
    m.telefone ? formatarTelefone(m.telefone) : null,
    m.transportadora,
    m.viagens === 1 ? '1 viagem anterior' : `${m.viagens} viagens anteriores`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div role="status" className="space-y-3 rounded-xl border border-primary/40 bg-primary/10 p-3 sm:col-span-2">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-muted">Motorista já cadastrado</p>
        <p className="break-words font-semibold text-ink">{m.nome ?? 'Sem nome salvo'}</p>
        <p className="break-words text-sm text-ink-muted">{resumo}</p>
      </div>

      {escolhido ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ok">Dados preenchidos. Confira e salve.</p>
          <button type="button" className="min-h-10 text-sm font-semibold text-primary underline underline-offset-4" onClick={() => setEscolhido(null)}>
            Trocar caminhão
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">{m.veiculos.length > 0 ? 'Qual caminhão veio hoje?' : 'Nenhuma placa salva nas viagens anteriores.'}</p>
          {m.veiculos.map((v) => {
            const chave = placasDe(v);
            const detalhe = [
              v.transportadora,
              v.capacidadeCarga != null ? `${decimal(v.capacidadeCarga)} t` : null,
              v.comprimentoCarreta != null ? `${decimal(v.comprimentoCarreta)} m` : null,
              `última vez ${dataCurta(v.ultimaVez)}`,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <button
                key={chave}
                type="button"
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-primary"
                onClick={() => preencher(chave, v)}
              >
                <span className="flex-none text-primary">{ICONE_REMETIDOS(20)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-mono font-semibold text-ink">{chave}</span>
                  <span className="block break-words text-xs text-ink-muted">{detalhe}</span>
                </span>
              </button>
            );
          })}
          <button type="button" className="btn btn-ghost h-12 w-full" onClick={() => preencher('motorista')}>
            {m.veiculos.length > 0 ? 'Outro caminhão: usar só os dados do motorista' : 'Usar os dados do motorista'}
          </button>
        </div>
      )}
    </div>
  );
}
