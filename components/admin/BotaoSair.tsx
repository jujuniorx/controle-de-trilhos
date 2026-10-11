import { sairAction } from '@/app/admin/(protegido)/actions-sair';

export function BotaoSair({ className = '' }: { className?: string }) {
  return (
    <form action={sairAction} className={className}>
      <button type="submit" className="ct-sair">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        Sair
      </button>
    </form>
  );
}
