// Chave de cada setor nas observações do dia (setor sem observação própria usa esta).
export const CHAVE_SETOR: Record<string, string> = {
  'Estaleiro de solda': 'estaleiro',
  'Geração de trilho': 'geracao',
  'Recolhimento serra': 'serra',
  'Caminhão de solda': 'caminhao',
};

/** Campo de observação do cartão: mesmo estilo das caixas de colunas, em todos os setores. */
export function CampoObservacao({ texto }: { texto: string }) {
  const t = texto.trim();
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Observação</p>
      <p className={`mt-1 whitespace-pre-line text-[13px] leading-snug ${t ? 'text-slate-700' : 'italic text-slate-400'}`}>
        {t || 'Sem observação registrada neste dia.'}
      </p>
    </div>
  );
}

const NOME_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Lista das observações da semana de um setor (usada na impressão). */
export function ObservacoesSetorRelatorio({ titulo, observacoes }: { titulo: string; observacoes: Record<string, string> }) {
  const chave = CHAVE_SETOR[titulo];
  if (!chave) return null;
  const linhas = Object.entries(observacoes)
    .filter(([k, texto]) => k.endsWith(`|${chave}`) && texto)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, texto]) => {
      const data = k.split('|')[0]!;
      const dia = NOME_DIA[new Date(`${data}T12:00:00Z`).getUTCDay()];
      return { data, rotulo: `${dia} ${data.split('-').reverse().join('/')}`, texto };
    });
  if (linhas.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg bg-slate-100 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Observações do dia</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {linhas.map((l) => (
          <li key={l.data}>
            <span className="font-semibold text-slate-800">{l.rotulo}:</span> <span className="text-slate-700">{l.texto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
