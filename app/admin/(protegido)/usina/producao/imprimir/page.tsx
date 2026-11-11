import { redirect } from 'next/navigation';

/** A impressao da Producao agora fica na aba Producao do Administrativo. */
export default async function ImprimirAntigo({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const params = await searchParams;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(params.data ?? '') ? `?data=${params.data}` : '';
  redirect(`/admin/producao${data}`);
}
