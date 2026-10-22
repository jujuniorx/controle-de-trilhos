import { requireDono } from '@/lib/services/requireAdmin';
import { informativoDoAno, META_RECOLHIMENTO_M } from '@/lib/services/informativo';
import { listarPendentesConferencia } from '@/lib/services/movimentacao';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { listarCarretasNaPortaria } from '@/lib/services/portaria';
import { listarAuditoria } from '@/lib/services/auditoria';
import { saudacaoRotativa } from '@/lib/saudacao';
import { VisaoGeralDono } from '@/components/dono/VisaoGeralDono';

export const dynamic = 'force-dynamic';

function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export default async function VisaoGeralPage() {
  const { nome } = await requireDono();
  const primeiroNome = nome.trim().split(' ')[0] ?? nome;
  const hoje = hojeSP();
  const ano = Number(hoje.slice(0, 4));

  const [r, pendentes, remetidos, carretas, auditoria] = await Promise.all([
    informativoDoAno(ano, hoje),
    listarPendentesConferencia(),
    listarAguardandoChegada(),
    listarCarretasNaPortaria(),
    listarAuditoria(8),
  ]);

  const dataLabel = new Date(`${hoje}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  });

  return (
    <VisaoGeralDono
      primeiroNome={primeiroNome}
      saudacao={saudacaoRotativa()}
      hojeLabel={dataLabel.charAt(0).toUpperCase() + dataLabel.slice(1)}
      metaM={META_RECOLHIMENTO_M}
      recolhidoAno={r.acumAno.recolhido}
      chegouAno={r.acumAno.recebido}
      w61Ano={r.acumAno.w61}
      w62Ano={r.acumAno.w62}
      recolhidoMes={r.acumMes.recolhido}
      recolhidoHoje={r.doDia.recolhido}
      chegouHoje={r.doDia.recebido}
      pendentes={pendentes.length}
      remetidos={remetidos.length}
      carretas={carretas.length}
      ultimas={auditoria.map((a) => ({
        usuario: a.usuarioNome,
        acao: a.acao,
        descricao: a.descricao,
        quando: a.criadoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      }))}
    />
  );
}
