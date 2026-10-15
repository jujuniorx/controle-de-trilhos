'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { novoEnvioPortariaAction } from './actions';

/** Carreta que chegou sem o Pátio ter cadastrado o envio: a Portaria cria aqui e o Pátio é avisado. */
export function NovoEnvioPortaria() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState('');
  const vazio = { destino: '', origem: '', materialPrevisto: '', transportadora: '', motoristaNome: '', motoristaCpf: '', motoristaTelefone: '', placaCavalo: '', placaCarreta: '', capacidadeCarga: '', observacao: '' };
  const [valores, setValores] = useState(vazio);

  function campo(nome: keyof typeof valores, rotulo: string, opcoes?: { maiusculo?: boolean; obrigatorio?: boolean; numerico?: boolean }) {
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">
          {rotulo}
          {opcoes?.obrigatorio ? ' *' : ''}
        </span>
        <input
          className="h-11 w-full"
          inputMode={opcoes?.numerico ? 'decimal' : undefined}
          value={valores[nome]}
          style={opcoes?.maiusculo ? { textTransform: 'uppercase' } : undefined}
          onChange={(e) => setValores({ ...valores, [nome]: e.target.value })}
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
        setValores(vazio);
        setAberto(false);
        router.refresh();
      } catch {
        setErro('Sem conexão. Tente de novo.');
      }
    });
  }

  if (!aberto) {
    return (
      <button type="button" className="btn btn-primary h-12 w-full" onClick={() => setAberto(true)}>
        + Carreta sem aviso do Pátio
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <p className="font-semibold">Carreta que chegou sem aviso</p>
      <p className="text-sm text-ink-muted">A Portaria responde as perguntas. Destino e uma placa são obrigatórios. O Pátio recebe o aviso na hora.</p>
      {campo('destino', 'Carregar para (destino)', { obrigatorio: true, maiusculo: true })}
      {campo('origem', 'Local (de onde sai)', { maiusculo: true })}
      {campo('materialPrevisto', 'Material')}
      {campo('transportadora', 'Empresa')}
      <div className="grid grid-cols-2 gap-2">
        {campo('motoristaNome', 'Motorista')}
        {campo('motoristaCpf', 'CPF')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {campo('motoristaTelefone', 'Telefone')}
        {campo('capacidadeCarga', 'Capacidade (t)', { numerico: true })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {campo('placaCavalo', 'Placa do cavalo', { maiusculo: true })}
        {campo('placaCarreta', 'Placa da carreta', { maiusculo: true })}
      </div>
      {campo('observacao', 'Observação')}
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
