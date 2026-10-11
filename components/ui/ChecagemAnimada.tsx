/** Círculo verde com o "check" se desenhando — confirmação de que o registro foi salvo. */
export function ChecagemAnimada({ size = 56 }: { size?: number }) {
  return (
    <svg className="checagem" width={size} height={size} viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle className="checagem-fundo" cx="26" cy="26" r="25" fill="var(--ok)" />
      <circle className="checagem-anel" cx="26" cy="26" r="23" stroke="#fff" strokeWidth="2" strokeOpacity=".35" />
      <path className="checagem-risco" d="M15 27l8 8 14-16" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
    </svg>
  );
}
