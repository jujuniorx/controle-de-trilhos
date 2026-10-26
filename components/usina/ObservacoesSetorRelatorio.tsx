// Observações do dia de um setor, mostradas embaixo do bloco do setor no relatório (tela).
const NOME_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const CHAVE_SETOR: Record<string, string> = {
  'Estaleiro de solda': 'estaleiro',
  'Geração de trilho': 'geracao',
  'Recolhimento serra': 'serra',
  'Caminhão de solda': 'caminhao',
};

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
