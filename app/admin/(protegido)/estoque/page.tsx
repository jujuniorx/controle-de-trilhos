import { AbasEstoque } from '@/components/estoque/AbasEstoque';
import { ResumoEstoque } from '@/components/estoque/ResumoEstoque';
import { TrilhosEstoque } from '@/components/estoque/TrilhosEstoque';
import { AlmoxarifadoEstoque } from '@/components/estoque/AlmoxarifadoEstoque';
import { MetrologiaEstoque } from '@/components/estoque/MetrologiaEstoque';
import { OleoEstoque } from '@/components/estoque/OleoEstoque';
import { listarAreasEstoque } from '@/lib/services/estoqueAreas';
import { AREA_METROLOGIA, AREA_OLEO, AREA_TRILHOS } from '@/lib/domain/estoque';

export const dynamic = 'force-dynamic';

/** Nome curto de cada área, para caber no celular. */
const CURTO_AREA: Record<string, string> = {
  [AREA_TRILHOS]: 'Trilhos',
  'area-almoxarifado': 'Almox.',
  [AREA_METROLOGIA]: 'Metrol.',
  [AREA_OLEO]: 'Óleo',
};

type Busca = { area?: string; q?: string; cat?: string; prateleira?: string; filtro?: string };

/** Estoque com abas: Resumo e as áreas (Trilhos, Almoxarifado, Metrologia e Materiais, Sala de Óleo). */
export default async function EstoquePage({ searchParams }: { searchParams: Promise<Busca> }) {
  const { area, q = '', cat = '', prateleira = '', filtro = '' } = await searchParams;
  const areas = await listarAreasEstoque();
  // "trilhos" é o endereço antigo da aba de Trilhos.
  const idArea = area === 'trilhos' ? AREA_TRILHOS : area;
  const areaAtual = idArea && idArea !== 'resumo' ? areas.find((a) => a.id === idArea) : undefined;

  let conteudo;
  if (!areaAtual) conteudo = <ResumoEstoque />;
  else if (areaAtual.id === AREA_TRILHOS) conteudo = <TrilhosEstoque busca={q} cat={cat} />;
  else if (areaAtual.id === AREA_METROLOGIA) conteudo = <MetrologiaEstoque areaId={areaAtual.id} nomeArea={areaAtual.nome} filtro={filtro} />;
  else if (areaAtual.id === AREA_OLEO) conteudo = <OleoEstoque areaId={areaAtual.id} nomeArea={areaAtual.nome} />;
  else conteudo = <AlmoxarifadoEstoque areaId={areaAtual.id} nomeArea={areaAtual.nome} busca={q} prateleira={prateleira} />;

  return (
    <>
      <AbasEstoque
        ativa={areaAtual?.id ?? 'resumo'}
        abas={[
          { id: 'resumo', rotulo: 'Resumo', curto: 'Resumo' },
          ...areas.map((a) => ({ id: a.id, rotulo: a.nome, curto: CURTO_AREA[a.id] ?? a.nome })),
        ]}
      />
      <div className="mx-auto mt-6 w-full max-w-7xl">{conteudo}</div>
    </>
  );
}
