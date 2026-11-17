'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { novoEnvioPortariaAction } from './actions';
import { ICONE_MAIS } from '@/components/portaria/icones';
import { formatarCpfDigitado, formatarTelefoneDigitado } from '@/lib/validation/portaria';
import type { MotoristaCadastrado } from '@/lib/services/motoristas';
import { acharMotoristaPorCpf, soDigitos } from '@/lib/domain/motorista';

type Campos = {
  destino: string;
  origem: string;
  materialPrevisto: string;
  transportadora: string;
  motoristaNome: string;
  motoristaCpf: string;
  motoristaTelefone: string;
  placaCavalo: string;
  placaCarreta: string;
  placaCarreta2: string;
  capacidadeCarga: string;
  comprimentoCarreta: string;
  observacao: string;
};

const VAZIO: Campos = { destino: '', origem: '', materialPrevisto: '', transportadora: '', motoristaNome: '', motoristaCpf: '', motoristaTelefone: '', placaCavalo: '', placaCarreta: '', placaCarreta2: '', capacidadeCarga: '', comprimentoCarreta: '', observacao: '' };
const PLACAS = new Set<keyof Campos>(['placaCavalo', 'placaCarreta', 'placaCarreta2']);
const MAIUSCULAS = new Set<keyof Campos>(['destino', 'origem', ...PLACAS]);

const soDigitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');
const chaveNome = (v: string) => v.trim().toLocaleUpperCase('pt-BR');

const CAMPO_BASE = 'h-12 w-full rounded-xl';

/** Carreta que chegou sem o Pátio ter cadastrado o envio: a Portaria cria aqui e o Pátio é avisado. */
export function NovoEnvioPortaria({ origens = [], motoristas = [] }: { origens?: string[]; motoristas?: MotoristaCadastrado[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState('');
  const [valores, setValores] = useState<Campos>(VAZIO);
  const lista = 'origens-novo-envio';

  // O CPF é a chave: com os 11 números, o motorista cadastrado preenche tudo.
  const cadastrado = acharMotoristaPorCpf(motoristas, valores.motoristaCpf);
  const cpfCompleto = soDigitos(valores.motoristaCpf).length === 11;

  function preencherComVeiculo(v: MotoristaCadastrado['veiculos'][number]) {
    setValores((atual) => ({
      ...atual,
      placaCavalo: v.placaCavalo ?? '',
      placaCarreta: v.placaCarreta ?? '',
      placaCarreta2: v.placaCarreta2 ?? '',
      capacidadeCarga: v.capacidadeCarga === null ? '' : String(v.capacidadeCarga).replace('.', ','),
      comprimentoCarreta: v.comprimentoCarreta === null ? '' : String(v.comprimentoCarreta).replace('.', ','),
    }));
  }

  function escolherMotorista(m: MotoristaCadastrado) {
    setValores((atual) => ({
      ...atual,
      motoristaNome: m.nome,
      motoristaCpf: m.cpf ?? '',
      motoristaTelefone: m.telefone ?? '',
      transportadora: m.transportadora ?? '',
    }));
    if (m.veiculos[0]) preencherComVeiculo(m.veiculos[0]);
  }

  function trocarMotorista() {
    setValores((atual) => ({ ...atual, motoristaNome: '', motoristaCpf: '', motoristaTelefone: '', transportadora: '', placaCavalo: '', placaCarreta: '', placaCarreta2: '', capacidadeCarga: '', comprimentoCarreta: '' }));
  }

  function mudar(nome: keyof Campos, bruto: string) {
    let valor = bruto;
    if (nome === 'motoristaCpf') {
      valor = formatarCpfDigitado(bruto);
      const m = acharMotoristaPorCpf(motoristas, valor);
      if (m) {
        escolherMotorista(m);
        return;
      }
    }
    else if (nome === 'motoristaTelefone') valor = formatarTelefoneDigitado(bruto);
    else if (PLACAS.has(nome)) valor = bruto.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    else if (MAIUSCULAS.has(nome)) valor = bruto.toLocaleUpperCase('pt-BR');
    setValores((atual) => ({ ...atual, [nome]: valor }));
  }

  function campo(nome: keyof Campos, rotulo: string, opcoes: { obrigatorio?: boolean; numerico?: boolean; placeholder?: string; maxLength?: number; lista?: boolean } = {}) {
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">
          {rotulo}
          {opcoes.obrigatorio ? ' *' : ''}
        </span>
        <input
          className={CAMPO_BASE}
          inputMode={opcoes.numerico ? 'decimal' : nome === 'motoristaCpf' ? 'numeric' : nome === 'motoristaTelefone' ? 'tel' : undefined}
          value={valores[nome]}
          placeholder={opcoes.placeholder}
          maxLength={opcoes.maxLength ?? 120}
          autoCapitalize={PLACAS.has(nome) ? 'characters' : undefined}
          autoComplete="off"
          list={opcoes.lista ? lista : undefined}
          onChange={(e) => mudar(nome, e.target.value)}
        />
      </label>
    );
  }

  function enviar() {
    setErro('');
    iniciar(async () => {
      try {
        const r = await novoEnvioPortariaAction(valores);
        if (!r.ok) {
          setErro(r.erro ?? 'Não foi possível criar o envio.');
          return;
        }
        setValores(VAZIO);
        setAberto(false);
        router.refresh();
      } catch {
        setErro('Sem conexão. Tente de novo.');
      }
    });
  }

  if (!aberto) {
    return (
      <button type="button" className="btn btn-ghost h-12 w-full" onClick={() => setAberto(true)}>
        {ICONE_MAIS(18)}
        Nova chegada
      </button>
    );
  }

  return (
    <div className="card space-y-5">
      {origens.length > 0 && (
        <datalist id={lista}>
          {origens.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
      <div>
        <p className="font-semibold">Carreta que chegou sem aviso</p>
        <p className="text-sm text-ink-muted">Digite só o CPF do motorista. Se ele já passou antes, todos os dados preenchem sozinhos.</p>
      </div>

      {/* 1. Motorista: o CPF é a chave; o cartão mostra quem foi reconhecido. */}
      <section className="space-y-3">
        <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">1. Motorista</p>
        {!cadastrado && (
          <div className="space-y-3">
            {campo('motoristaCpf', 'CPF do motorista', { placeholder: '000.000.000-00', maxLength: 14 })}
            {cpfCompleto && (
              <p className="text-sm font-semibold text-warn">CPF não cadastrado. Preencha nome e telefone: ao criar o envio, o motorista fica no cadastro e na próxima vez o CPF preenche tudo.</p>
            )}
            {cpfCompleto && (
              <div className="grid gap-3 sm:grid-cols-2">
                {campo('motoristaNome', 'Nome do motorista')}
                {campo('motoristaTelefone', 'Telefone', { placeholder: '(00) 00000-0000', maxLength: 16 })}
                {campo('transportadora', 'Empresa')}
              </div>
            )}
          </div>
        )}
        {cadastrado ? (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-ok/40 bg-ok/10 p-3">
            <div className="min-w-0 text-sm">
              <p className="font-bold text-ink">{cadastrado.nome}</p>
              <p className="text-ink-muted">{[cadastrado.cpf, cadastrado.telefone].filter(Boolean).join(' · ') || 'Sem CPF cadastrado'}</p>
              {cadastrado.transportadora && <p className="text-ink-muted">{cadastrado.transportadora}</p>}
              <p className="mt-1 text-xs font-semibold text-ok">Preenchido do cadastro</p>
            </div>
            <button type="button" className="btn btn-ghost h-9 shrink-0 text-sm" onClick={trocarMotorista}>Trocar</button>
          </div>
        ) : null}
        {motoristas.length > 0 && (
          <datalist id="motoristas-novo-envio">
            {motoristas.map((m) => (
              <option key={m.id} value={m.nome} />
            ))}
          </datalist>
        )}
      </section>

      {/* 2. Veículo: os que este motorista já usou, em um toque. */}
      <section className="space-y-3">
        <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">2. Veículo</p>
        {cadastrado && cadastrado.veiculos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {cadastrado.veiculos.map((v) => (
              <button key={v.id} type="button" className="btn btn-ghost h-11 text-sm" onClick={() => preencherComVeiculo(v)}>
                {[v.placaCavalo, v.placaCarreta, v.placaCarreta2].filter(Boolean).join(' / ') || 'Sem placa'}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {campo('placaCavalo', 'Placa do cavalo', { placeholder: 'ABC1D23 ou CMG1234', maxLength: 7 })}
          {campo('placaCarreta', 'Placa da carreta', { placeholder: 'ABC1D23 ou CMG1234', maxLength: 7 })}
        </div>
        {campo('placaCarreta2', '2ª placa da carreta (opcional)', { placeholder: 'ABC1D23 ou CMG1234', maxLength: 7 })}
      </section>

      {/* 3. Carga: para onde vai o carregamento. */}
      <section className="space-y-3">
        <p className="text-sm font-bold uppercase tracking-wide text-ink-muted">3. Carga</p>
        {campo('destino', 'Carregar para (destino)', { obrigatorio: true })}
      </section>

      {/* Detalhes: fechados por padrão, para a tela não ficar longa. */}
      <details className="rounded-xl border border-line p-3">
        <summary className="cursor-pointer text-sm font-bold text-ink">Mais detalhes</summary>
        <div className="mt-3 space-y-3">
          {campo('origem', 'Local (de onde sai)', { lista: true })}
          {campo('materialPrevisto', 'Material')}
          <div className="grid gap-3 sm:grid-cols-2">
            {campo('capacidadeCarga', 'Limite de carga (t)', { numerico: true, placeholder: 'ex.: 48 (máx. 200)', maxLength: 6 })}
            {campo('comprimentoCarreta', 'Comprimento da carreta (m)', { numerico: true, placeholder: 'ex.: 15,5 (máx. 60)', maxLength: 6 })}
          </div>
          {campo('observacao', 'Observação', { maxLength: 500 })}
        </div>
      </details>

      {erro && <p role="alert" className="text-sm text-bad">{erro}</p>}
      <div className="sticky bottom-24 flex gap-2 rounded-xl bg-card/95 py-2 backdrop-blur">
        <button type="button" className="btn btn-ghost h-12 flex-1" onClick={() => setAberto(false)} disabled={pendente}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary h-12 flex-1" onClick={enviar} disabled={pendente}>
          {pendente ? 'Criando...' : 'Criar e avisar o Pátio'}
        </button>
      </div>
    </div>
  );
}
