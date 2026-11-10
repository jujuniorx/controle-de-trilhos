import Link from 'next/link';
import { TelaEntrada } from '@/components/ui/TelaEntrada';

export default function LoginProducaoPage() {
  return (
    <TelaEntrada area="area-admin">
      <div className="portaria-tela">
        <h1 className="font-condensed text-2xl font-bold uppercase tracking-wide text-ink">Produção</h1>
        <p className="mt-1 text-sm text-ink-muted">Acesso da equipe de soldagem. O login é criado pelo escritório.</p>
        <Link href="/" className="btn btn-ghost mt-6 h-12 w-full">
          Voltar ao início (trocar de setor)
        </Link>
      </div>
    </TelaEntrada>
  );
}
