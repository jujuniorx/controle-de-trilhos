import { CenaFerrovia } from '@/components/ui/CenaFerrovia';

/**
 * Fundo decorativo das telas: a cena da ferrovia (components/ui/CenaFerrovia.tsx).
 * inicio: tela inicial (o TLS saindo do estaleiro, com a emenda sendo soldada).
 * abertura: logins e abertura do app (a via vista da cabine, com farol e solda do logo).
 * saudacao: faixa "Bom dia" (a via vista de lado, com o céu da hora). É o padrão.
 */
export function FundoTrilhos({ className = '', modo = 'saudacao', intro = 'auto' }: { className?: string; modo?: 'abertura' | 'saudacao' | 'inicio'; intro?: 'auto' | 'completa' }) {
  return (
    <div className={`fundo-trilhos fundo-${modo} ${className}`} aria-hidden="true">
      <CenaFerrovia modo={modo} intro={intro} />
    </div>
  );
}
