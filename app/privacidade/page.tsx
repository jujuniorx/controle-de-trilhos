import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacidade e cookies — Controle de Trilhos',
  description: 'Quais dados o Controle de Trilhos guarda, para quê, e como falar com o responsável.',
};

// Contato de privacidade: defina NEXT_PUBLIC_CONTATO_PRIVACIDADE (e-mail) na Vercel.
// Sem a variável, a página orienta a falar com o responsável pelo sistema.
const CONTATO = process.env.NEXT_PUBLIC_CONTATO_PRIVACIDADE;

const COOKIES = [
  { nome: 'sessao_admin', para: 'Mantém o Administrativo conectado depois do login.', prazo: '7 dias, ou até você sair' },
  { nome: 'acesso_patio', para: 'Mantém o aparelho do Pátio autorizado depois de digitar o código de acesso.', prazo: '90 dias, ou até o acesso ser revogado' },
  { nome: 'ct_tema', para: 'Lembra se você escolheu o tema claro ou escuro.', prazo: '1 ano' },
];

export default function PrivacidadePage() {
  return (
    <main className="area-admin mx-auto max-w-2xl space-y-6 p-6">
      <Link href="/" className="text-sm text-ink-muted underline hover:text-ink">
        ← Voltar ao início
      </Link>
      <h1 className="font-condensed text-3xl font-bold uppercase tracking-wide text-ink">Privacidade e cookies</h1>
      <p className="text-sm text-ink-muted">
        O Controle de Trilhos é um sistema de uso interno para registrar o recebimento e a remessa de trilhos e conferir os
        lançamentos. Esta página explica, em linguagem simples, o que o sistema guarda e por quê.
      </p>

      <section className="card space-y-2">
        <h2 className="card-title">Dados que o sistema guarda</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          <li><b>Registros da operação:</b> data, nota fiscal, origem ou destino, placas, perfis, medições, pesos e fotos ou documentos anexados.</li>
          <li><b>Nome de quem lançou:</b> o responsável informado pelo Pátio e o nome do administrador que conferiu, para saber quem fez cada lançamento.</li>
          <li><b>Contas do Administrativo:</b> nome, usuário ou e-mail e a senha, guardada de forma protegida (nunca em texto aberto).</li>
          <li><b>Histórico de alterações:</b> o que mudou, quando e por quem.</li>
        </ul>
        <p className="text-sm text-ink-muted">Os dados são usados só para operar e conferir o controle de trilhos. Não são vendidos nem usados para publicidade.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="card-title">Cookies e armazenamento no aparelho</h2>
        <p className="text-sm text-ink-muted">
          O sistema usa apenas cookies necessários para funcionar e para lembrar uma preferência. Não usa cookies de publicidade
          nem de acompanhamento, e não usa Google Analytics.
        </p>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Cookie</th><th>Para quê</th><th>Duração</th></tr>
            </thead>
            <tbody>
              {COOKIES.map((c) => (
                <tr key={c.nome}>
                  <td className="font-mono">{c.nome}</td>
                  <td>{c.para}</td>
                  <td>{c.prazo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-ink-muted">
          Além dos cookies, o aparelho guarda no próprio navegador os lançamentos feitos sem internet (até serem enviados), uma cópia
          da tela inicial para o app abrir mais rápido e o aviso de que você dispensou o convite de instalação.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="card-title">Seus direitos</h2>
        <p className="text-sm text-ink">
          Você pode pedir para saber quais dados seus estão no sistema, corrigir um dado errado ou pedir a exclusão do que não precisa
          ser mantido, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
        </p>
        <p className="text-sm text-ink">
          Para isso, fale com o responsável pelo sistema
          {CONTATO ? (
            <>
              : <a className="underline" href={`mailto:${CONTATO}`}>{CONTATO}</a>.
            </>
          ) : (
            ' da sua empresa.'
          )}
        </p>
      </section>

      <p className="text-xs text-ink-dim">Última atualização: outubro de 2026.</p>
    </main>
  );
}
