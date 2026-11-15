import { FundoTrilhos } from '@/components/ui/FundoTrilhos';
import { periodoDoDia, saudacaoCompleta } from '@/lib/saudacao';

/**
 * Cartão do topo da Produção, na mesma posição e no mesmo estilo da saudação do Administrativo.
 * O nome é o do soldador lançado no dia (qualquer nome que ele tenha digitado), não o de quem está logado.
 * O céu segue a hora de Brasília, não o tema.
 */
export function SaudacaoProducao({ soldador }: { soldador?: string | null }) {
  const primeiro = soldador?.trim().split(/\s+/)[0];
  return (
    <section className="saudacao-hero" data-periodo={periodoDoDia()}>
      <FundoTrilhos />
      <div className="saudacao-hero-texto">
        <p className="saudacao-hero-saudacao">
          {saudacaoCompleta()}
          {primeiro ? `, ${primeiro}` : ''}
        </p>
        <p className="saudacao-hero-sub">
          {primeiro ? `Soldador de hoje: ${soldador!.trim()}` : 'Informe o soldador do dia para aparecer aqui.'}
        </p>
      </div>
    </section>
  );
}
