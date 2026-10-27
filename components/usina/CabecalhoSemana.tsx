import { somarDiasPagina, br } from '@/lib/usina/formatoData';

/** Cabeçalho padrão de todo bloco semanal da usina: período (segunda a domingo) e uma instrução curta. */
export function CabecalhoSemana({ semana, ajuda }: { semana: string; ajuda: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="font-semibold">
        Semana de {br(semana)} a {br(somarDiasPagina(semana, 6))}
      </p>
      <p className="text-sm text-ink-muted">{ajuda}</p>
    </div>
  );
}
