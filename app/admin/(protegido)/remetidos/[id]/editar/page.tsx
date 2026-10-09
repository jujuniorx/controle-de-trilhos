import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { buscarRemetidoDetalhe } from '@/lib/services/remetido';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { MARCA_LABEL } from '@/lib/validation/recebimento';
import { RemetidoWizard, type ValoresIniciaisEdicao } from '@/app/patio/(protegido)/remetidos/RemetidoWizard';

function fmtDataISO(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

/** Inverte MARCA_LABEL: "Nippon" -> "NIPPON". Fora das 3 marcas cadastradas, é texto livre ("Outros"). */
function marcaDoFabricante(fabricante: string | null): { marca: 'NIPPON' | 'EVRAZ' | 'PANGANG' | 'OUTROS' | undefined; fabricanteOutro: string | undefined } {
  if (!fabricante) return { marca: undefined, fabricanteOutro: undefined };
  const entrada = Object.entries(MARCA_LABEL).find(([, label]) => label === fabricante);
  if (entrada) return { marca: entrada[0] as 'NIPPON' | 'EVRAZ' | 'PANGANG', fabricanteOutro: undefined };
  return { marca: 'OUTROS', fabricanteOutro: fabricante };
}

export default async function EditarRemetidoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const mov = await buscarRemetidoDetalhe(id);
  if (!mov) notFound();
  // Sem grupos/medições ainda (o Pátio não confirmou) — não há o que editar
  // nesta tela; os painéis de completar Tipo/NF na própria página de detalhe
  // já cobrem esse estado.
  if (mov.status === 'AGUARDANDO_CHEGADA') redirect(`/admin/remetidos/${id}`);

  const valoresIniciais: ValoresIniciaisEdicao = {
    tipoRemetido: mov.remetidoDetalhe?.tipoRemetido ?? '',
    reservaPedido: mov.reservaPedido ?? '',
    destino: mov.destino ?? '',
    dados: {
      data: fmtDataISO(mov.dataMovimentacao),
      numeroDocumento: mov.numeroDocumento ?? '',
      placaCavalo: mov.placaCavalo ?? '',
      placaCarreta: mov.placaCarreta ?? '',
      placaCarreta2: mov.placaCarreta2 ?? '',
      transportadora: mov.transportadora ?? '',
      responsavelPatio: mov.responsavelPatio ?? '',
    },
    grupos: mov.grupos.map((g) => {
      const { marca, fabricanteOutro } = g.tipoMaterial === 'NOVO' ? marcaDoFabricante(g.fabricante) : { marca: undefined, fabricanteOutro: undefined };
      return {
        clientId: g.clientId,
        perfil: g.perfil,
        tipoMaterial: g.tipoMaterial,
        classificacao: g.classificacao ?? undefined,
        tampao: g.tampao,
        marca,
        fabricanteOutro,
        medicoes: g.medicoes.map((m) => ({
          clientId: m.clientId,
          modo: m.modo,
          quantidade: m.quantidade,
          comprimento: Number(m.comprimento),
          classificacaoSC: m.classificacaoSC ?? undefined,
        })),
      };
    }),
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <Link href={`/admin/remetidos/${id}`} className="back-link">
          ← Voltar ao remetido
        </Link>
        <h1 className="mt-1 font-condensed text-xl font-bold uppercase tracking-wide text-ink">Editar remetido</h1>
      </div>
      <RemetidoWizard modo="editar" movimentacaoId={id} valoresIniciais={valoresIniciais} />
    </main>
  );
}
