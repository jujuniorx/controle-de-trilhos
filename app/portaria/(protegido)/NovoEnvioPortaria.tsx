'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { novoEnvioPortariaAction } from './actions';
import { ICONE_MAIS } from '@/components/portaria/icones';
import { formatarCpfDigitado, formatarTelefoneDigitado } from '@/lib/validation/portaria';

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

/** Carreta que chegou sem o Pátio ter cadastrado o envio: a Portaria cria aqui e o Pátio é avisado. */
export function NovoEnvioPortaria({ origens = [] }: { origens?: string[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState('');
  const [valores, setValores] = useState<Campos>(VAZIO);
  const lista = 'origens-novo-envio';

  function mudar(nome: keyof Campos, bruto: string) {
    let valor = bruto;
    if (nome === 'motoristaCpf') valor = formatarCpfDigitado(bruto);
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
          className="h-11 w-full"
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
        Carreta sem aviso do Pátio
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      {origens.length > 0 && (
        <datalist id={lista}>
          {origens.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
      <p className="font-semibold">Carreta que chegou sem aviso</p>
      <p className="text-sm text-ink-muted">Destino e uma placa são obrigatórios. O Pátio recebe o aviso na hora.</p>
      {campo('destino', 'Carregar para (destino)', { obrigatorio: true })}
      {campo('origem', 'Local (de onde sai)', { lista: true })}
      {campo('materialPrevisto', 'Material')}
      {campo('transportadora', 'Empresa')}
      <div className="grid grid-cols-2 gap-2">
        {campo('motoristaNome', 'Motorista')}
        {campo('motoristaCpf', 'CPF', { placeholder: '000.000.000-00', maxLength: 14 })}
      </div>
      {campo('motoristaTelefone', 'Telefone', { placeholder: '(00) 00000-0000', maxLength: 16 })}
      <div className="grid grid-cols-2 gap-2">
        {campo('placaCavalo', 'Placa do cavalo', { placeholder: 'ABC1D23 ou CMG1234', maxLength: 7 })}
        {campo('placaCarreta', 'Placa da carreta', { placeholder: 'ABC1D23 ou CMG1234', maxLength: 7 })}
      </div>
      {campo('placaCarreta2', '2ª placa da carreta (opcional)', { placeholder: 'ABC1D23 ou CMG1234', maxLength: 7 })}
      <div className="grid grid-cols-2 gap-2">
        {campo('capacidadeCarga', 'Limite de carga (t)', { numerico: true, placeholder: 'ex.: 48 (máx. 200)', maxLength: 6 })}
        {campo('comprimentoCarreta', 'Comprimento da carreta (m)', { numerico: true, placeholder: 'ex.: 15,5 (máx. 60)', maxLength: 6 })}
      </div>
      {campo('observacao', 'Observação', { maxLength: 500 })}
      {erro && <p role="alert" className="text-sm text-bad">{erro}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost h-11 flex-1" onClick={() => setAberto(false)} disabled={pendente}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary h-11 flex-1" onClick={enviar} disabled={pendente}>
          {pendente ? 'Criando...' : 'Criar e avisar o Pátio'}
        </button>
      </div>
    </div>
  );
}
