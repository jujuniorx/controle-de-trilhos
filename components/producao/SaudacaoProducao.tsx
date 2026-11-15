import { FundoTrilhos } from '@/components/ui/FundoTrilhos';
import { periodoDoDia, saudacaoCompleta } from '@/lib/saudacao';

/**
 * Cartão do topo da Produção, na mesma posição e no mesmo estilo da saudação do Administrativo.
 * O nome é o do soldador lançado no dia (qualquer nome que ele tenha digitado), não o de quem está logado.
 * O céu segue a hora de Brasília, não o tema.
 */
/** Primeiro nome de cada soldador lançado: "Roberval/Antônio", "Roberval e Antônio" ou "Roberval, Antônio". */
export function primeirosNomes(texto?: string | null): string[] {
  return (texto ?? '')
    .split(/\s*(?:\/|,|;|\be\b)\s*/i)
    .map((parte) => parte.trim().split(/\s+/)[0])
    .filter(Boolean);
}

/** "Roberval", "Roberval e Antônio", "Roberval, Antônio e Juca". */
function listar(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

export function SaudacaoProducao({ soldador }: { soldador?: string | null }) {
  const nomes = primeirosNomes(soldador);
  const primeiro = nomes.length ? listar(nomes) : '';
  return (
    <section className="saudacao-hero" data-periodo={periodoDoDia()}>
      <FundoTrilhos />
      <div className="saudacao-hero-texto">
        <p className="saudacao-hero-saudacao">
          {saudacaoCompleta()}
          {primeiro ? `, ${primeiro}` : ''}
        </p>
        <p className="saudacao-hero-sub">
          {primeiro ? `Soldadores de hoje: ${soldador!.trim()}` : 'Informe o soldador do dia para aparecer aqui.'}
        </p>
      </div>
    </section>
  );
}
