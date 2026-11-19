import { notFound } from 'next/navigation';
import { NovoItemEstoque } from '@/components/estoque/NovoItemEstoque';
import { fatoresPerfil, listarAreasEstoque, listarMateriaisDaArea } from '@/lib/services/estoqueAreas';
import { rotuloUnidade } from '@/lib/domain/estoque';

export const dynamic = 'force-dynamic';

/** Cadastro de item numa área do estoque (/admin/estoque/novo?area=...). */
export default async function NovoItemPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await searchParams;
  const areas = await listarAreasEstoque();
  const achada = areas.find((a) => a.id === area);
  if (!achada) notFound();
  const atual = achada as NonNullable<typeof achada>;
  const [materiais, fatores] = await Promise.all([listarMateriaisDaArea(atual.id), fatoresPerfil()]);
  const unico = (lista: (string | null)[]) => [...new Set(lista.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return (
    <div className="mx-auto mt-2 w-full max-w-7xl">
      <NovoItemEstoque
        areaId={atual.id}
        areaNome={atual.nome}
        fatores={fatores}
        existentes={materiais.map((m) => ({
          id: m.id,
          nome: m.nome,
          fabricante: m.fabricante,
          saldo: `${m.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${rotuloUnidade(m.unidade, m.categoria, m.quantidade)}`,
        }))}
        grupos={unico(materiais.map((m) => m.grupo))}
        fabricantes={unico(materiais.map((m) => m.fabricante))}
      />
    </div>
  );
}
