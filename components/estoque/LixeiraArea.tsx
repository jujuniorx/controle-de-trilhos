import { listarMateriaisApagadosDaArea } from '@/lib/services/estoqueAreas';
import { restaurarMaterialEstoqueAction } from '@/app/admin/(protegido)/estoque/areas-actions';

/** Materiais apagados da área, para restaurar. Só aparece quando tem algum. */
export async function LixeiraArea({ areaId }: { areaId: string }) {
  const apagados = await listarMateriaisApagadosDaArea(areaId);
  if (apagados.length === 0) return null;
  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">Lixeira desta área ({apagados.length})</summary>
      <ul className="mt-4 divide-y divide-line">
        {apagados.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{m.nome}</p>
              <p className="text-xs text-ink-muted">{m.unidade} · {m.fabricante ?? 'Fabricante não informado'}</p>
            </div>
            <form action={restaurarMaterialEstoqueAction}>
              <input type="hidden" name="materialId" value={m.id} />
              <button type="submit" className="btn btn-ghost h-11">Restaurar</button>
            </form>
          </li>
        ))}
      </ul>
    </details>
  );
}
