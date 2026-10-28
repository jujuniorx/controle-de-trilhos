import { saudacaoCompleta } from '@/lib/saudacao';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';

/** Cabeçalho das telas da Portaria: a mesma faixa em Carga e em Descarga. */
export function SaudacaoPortaria({ nome, linha }: { nome: string; linha: string }) {
  const primeiroNome = nome.trim().split(' ')[0] ?? nome;
  return (
    <section className="saudacao-hero">
      <FundoTrilhos />
      <div className="saudacao-hero-texto">
        <p className="saudacao-hero-saudacao">
          {saudacaoCompleta()}, {primeiroNome}
        </p>
        <p className="saudacao-hero-sub">{linha}</p>
      </div>
    </section>
  );
}

/** Frase de resumo: "2 podem sair e 1 aguardando o Pátio." (ou a frase de tela vazia). */
export function linhaResumo(partes: { n: number; singular: string; plural: string }[], vazia: string): string {
  const ativas = partes.filter((p) => p.n > 0).map((p) => `${p.n} ${p.n === 1 ? p.singular : p.plural}`);
  if (ativas.length === 0) return vazia;
  return ativas.join(' e ') + '.';
}
