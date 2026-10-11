import type { ReactNode } from 'react';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';
import { LogoAnimada } from '@/components/ui/LogoAnimada';

/** Moldura das telas de login/acesso: painel da marca (azul-marinho) + área do formulário. */
export function TelaEntrada({
  area,
  children,
}: {
  area: 'area-admin' | 'area-patio';
  children: ReactNode;
}) {
  return (
    <main className={`${area} entrada-tela`}>
      <section className="entrada-marca">
        <FundoTrilhos />
        <div className="entrada-marca-conteudo">
          <LogoAnimada size={76} />
          <h2 className="entrada-marca-nome">Controle de Trilhos</h2>
          <p className="entrada-marca-frase">Recebimento, remessa e conferência de trilhos.</p>
        </div>
      </section>
      <section className="entrada-form">
        <div className="entrada-form-caixa">{children}</div>
      </section>
    </main>
  );
}
