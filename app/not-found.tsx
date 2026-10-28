import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

/** Página não encontrada: no visual do sistema, em português, com caminho de volta. */
export default function NaoEncontrada() {
  return (
    <main className="nao-encontrada">
      <div className="nao-encontrada-caixa">
        <Logo size={40} subtitle="Controle de Trilhos" showText={false} />
        <p className="nao-encontrada-codigo">404</p>
        <h1 className="nao-encontrada-titulo">Página não encontrada</h1>
        <p className="nao-encontrada-texto">
          O endereço pode ter mudado ou o registro foi excluído. Volte ao início e siga pelo menu.
        </p>
        <div className="nao-encontrada-acoes">
          <Link href="/" className="btn btn-primary">
            Voltar ao início
          </Link>
          <Link href="/admin" className="btn btn-ghost">
            Ir para o Administrativo
          </Link>
        </div>
      </div>
    </main>
  );
}
