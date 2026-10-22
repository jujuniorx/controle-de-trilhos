'use client';

import { useState, useTransition } from 'react';
import { OPCOES_MATERIAL_PILHA, type DadosPilhaPatio, type PilhaPatio } from '@/lib/domain/pilhasPatio';

type Resultado = { ok: true; pilha?: PilhaPatio } | { ok: false; erro: string };

export type AcoesPilhas = {
  criar: () => Promise<Resultado>;
  salvar: (id: string, dados: DadosPilhaPatio) => Promise<Resultado>;
  remover: (id: string) => Promise<Resultado>;
};

/**
 * Lista das pilhas do pátio. Cada alteração é salva ao sair do campo.
 * Usada pelo Pátio e pelo dono (mesma tela, ações diferentes para cada área).
 */
export function EditorPilhas({ iniciais, acoes }: { iniciais: PilhaPatio[]; acoes: AcoesPilhas }) {
  const [pilhas, setPilhas] = useState<PilhaPatio[]>(iniciais);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function atualizar(id: string, campo: keyof DadosPilhaPatio, valor: string) {
    setPilhas((atual) => atual.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
  }

  function salvar(p: PilhaPatio) {
    const dados: DadosPilhaPatio = { nome: p.nome, material: p.material, observacao: p.observacao };
    iniciar(async () => {
      const r = await acoes.salvar(p.id, dados);
      if (r.ok) setMensagem({ tipo: 'ok', texto: 'Salvo.' });
      else setMensagem({ tipo: 'erro', texto: r.erro });
    });
  }

  function adicionar() {
    iniciar(async () => {
      const r = await acoes.criar();
      if (r.ok && r.pilha) {
        setPilhas((atual) => [...atual, r.pilha!]);
        setMensagem({ tipo: 'ok', texto: 'Pilha adicionada. Preencha o nome e o que tem nela.' });
      } else if (!r.ok) setMensagem({ tipo: 'erro', texto: r.erro });
    });
  }

  function remover(id: string) {
    if (confirmarId !== id) {
      setConfirmarId(id);
      return;
    }
    setConfirmarId(null);
    iniciar(async () => {
      const r = await acoes.remover(id);
      if (r.ok) {
        setPilhas((atual) => atual.filter((p) => p.id !== id));
        setMensagem({ tipo: 'ok', texto: 'Pilha removida.' });
      } else setMensagem({ tipo: 'erro', texto: r.erro });
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        {pilhas.length === 0
          ? 'Nenhuma pilha cadastrada ainda.'
          : `${pilhas.length} ${pilhas.length === 1 ? 'pilha cadastrada' : 'pilhas cadastradas'}`}
      </p>

      {mensagem && (
        <p role="status" className={`text-sm ${mensagem.tipo === 'erro' ? 'text-bad' : 'text-ink-muted'}`}>
          {mensagem.texto}
        </p>
      )}

      <div className="grid gap-3">
        {pilhas.map((p) => (
          <div key={p.id} className="card grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-end">
            <label className="grid gap-1 text-sm font-medium">
              Nome da pilha
              <input
                className="h-11"
                maxLength={60}
                placeholder="ex.: P-01 ou Pilha do fundo"
                value={p.nome}
                onChange={(e) => atualizar(p.id, 'nome', e.target.value)}
                onBlur={() => salvar(p)}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              O que tem nela
              <select
                className="h-11"
                value={p.material}
                onChange={(e) => {
                  atualizar(p.id, 'material', e.target.value);
                  salvar({ ...p, material: e.target.value });
                }}
              >
                <option value="">Escolha</option>
                {OPCOES_MATERIAL_PILHA.map((g) => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.opcoes.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Observação (opcional)
              <input
                className="h-11"
                maxLength={120}
                value={p.observacao}
                onChange={(e) => atualizar(p.id, 'observacao', e.target.value)}
                onBlur={() => salvar(p)}
              />
            </label>
            <button
              type="button"
              className={`btn h-11 ${confirmarId === p.id ? 'btn-danger' : 'btn-ghost'}`}
              disabled={ocupado}
              onClick={() => remover(p.id)}
            >
              {confirmarId === p.id ? 'Toque de novo para remover' : 'Remover'}
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-primary h-12 w-full md:w-auto" disabled={ocupado} onClick={adicionar}>
        {ocupado ? 'Aguarde...' : 'Adicionar pilha'}
      </button>
    </div>
  );
}
