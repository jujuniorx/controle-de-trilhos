import Link from 'next/link';
import type { ReactNode } from 'react';
import { listarPendentesConferencia } from '@/lib/services/movimentacao';
import { listarAguardandoChegada } from '@/lib/services/remetido';
import { buscarDia, horasDoDia, paradasDaLinha } from '@/lib/services/producao';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { saudacaoRotativa } from '@/lib/saudacao';
import { FundoTrilhos } from '@/components/ui/FundoTrilhos';
import { ICONES_NAV } from '@/components/admin/navItens';

export const dynamic = 'force-dynamic';

function hojeSP(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type Secao = { href: string; nome: string; descricao: string };

const SECOES: Secao[] = [
  { href: '/admin/pendencias', nome: 'Pendências', descricao: 'Conferir o que chegou do Pátio' },
  { href: '/admin/producao', nome: 'Produção', descricao: 'Soldas, paradas e impressão do dia' },
  { href: '/admin/relatorios', nome: 'Relatórios', descricao: 'Movimentações por período' },
  { href: '/admin/portaria', nome: 'Portaria', descricao: 'Cargas e descargas' },
  { href: '/admin/usina', nome: 'Usina', descricao: 'Lançamentos da usina' },
  { href: '/admin/estoque', nome: 'Estoque', descricao: 'Itens e saldos' },
];

const SECOES_DONO: Secao[] = [
  { href: '/admin/dono', nome: 'Visão geral', descricao: 'Números gerais do sistema' },
  { href: '/admin/usuarios', nome: 'Usuários', descricao: 'Contas e senhas' },
  { href: '/admin/pilhas', nome: 'Pilhas do pátio', descricao: 'Cadastro das pilhas' },
  { href: '/admin/lixeira', nome: 'Lixeira', descricao: 'Itens excluídos' },
  { href: '/admin/auditoria', nome: 'Auditoria', descricao: 'Registro do que foi feito' },
];

function Resumo({ href, rotulo, valor, detalhe, alerta = false }: { href: string; rotulo: string; valor: ReactNode; detalhe: string; alerta?: boolean }) {
  return (
    <Link href={href} className="inicio-resumo" data-alerta={alerta ? 'true' : undefined}>
      <span className="inicio-resumo-rotulo">{rotulo}</span>
      <span className="inicio-resumo-valor">{valor}</span>
      <span className="inicio-resumo-detalhe">{detalhe}</span>
    </Link>
  );
}

function Cartao({ secao, selo }: { secao: Secao; selo?: number }) {
  return (
    <Link href={secao.href} className="inicio-cartao">
      <span className="inicio-cartao-icone">{ICONES_NAV[secao.href]}</span>
      <span className="inicio-cartao-texto">
        <span className="inicio-cartao-nome">{secao.nome}</span>
        <span className="inicio-cartao-descricao">{secao.descricao}</span>
      </span>
      {selo ? <span className="inicio-cartao-selo" aria-label={`${selo} para conferir`}>{selo}</span> : null}
    </Link>
  );
}

/** Tela inicial do Administrativo: o resumo do dia e a entrada para cada seção. */
export default async function AdminInicioPage() {
  const { nome, role } = await requireAdmin();
  const primeiroNome = nome.trim().split(' ')[0] ?? nome;
  const hoje = new Date(`${hojeSP()}T00:00:00Z`);
  const [movimentacoes, aguardandoChegada, dia] = await Promise.all([listarPendentesConferencia(), listarAguardandoChegada(), buscarDia(hoje)]);

  const linhas = dia?.linhas ?? [];
  const horas = new Set(horasDoDia(hoje));
  const doDia = linhas.filter((l) => horas.has(l.hora));
  const cortes = doDia.reduce((t, l) => t + (l.cortes ?? 0), 0);
  const paradaMin = doDia.reduce((t, l) => t + paradasDaLinha(l.paradas).reduce((s, p) => s + p.minutos, 0), 0);
  const tempoParado = paradaMin ? `${Math.floor(paradaMin / 60)}h${String(paradaMin % 60).padStart(2, '0')} parado` : 'sem paradas';

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6">
      <section className="saudacao-hero">
        <FundoTrilhos />
        <div className="saudacao-hero-texto">
          <p className="saudacao-hero-saudacao">
            {saudacaoRotativa()}, {primeiroNome}
          </p>
          <p className="saudacao-hero-sub">
            {movimentacoes.length === 0
              ? 'Nada pendente para conferir agora.'
              : movimentacoes.length === 1
                ? '1 movimentação para conferir.'
                : `${movimentacoes.length} movimentações para conferir.`}
          </p>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="inicio-hoje">
        <h2 id="inicio-hoje" className="section-title">Hoje</h2>
        <div className="inicio-resumos">
          <Resumo
            href="/admin/pendencias"
            rotulo="Para conferir"
            valor={movimentacoes.length}
            detalhe={movimentacoes.length === 1 ? 'movimentação' : 'movimentações'}
            alerta={movimentacoes.length > 0}
          />
          <Resumo
            href="/admin/pendencias"
            rotulo="Remetidos a caminho"
            valor={aguardandoChegada.length}
            detalhe="aguardando chegada"
          />
          <Resumo
            href="/admin/producao"
            rotulo="Produção de hoje"
            valor={dia ? dia.totalSoldas : '—'}
            detalhe={dia ? `soldas · ${cortes} ${cortes === 1 ? 'corte' : 'cortes'} · ${tempoParado}` : 'sem lançamento ainda'}
          />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="inicio-secoes">
        <h2 id="inicio-secoes" className="section-title">Seções</h2>
        <div className="inicio-grade">
          {SECOES.map((s) => (
            <Cartao key={s.href} secao={s} selo={s.href === '/admin/pendencias' ? movimentacoes.length : undefined} />
          ))}
        </div>
      </section>

      {role === 'DONO' && (
        <section className="space-y-3" aria-labelledby="inicio-dono">
          <h2 id="inicio-dono" className="section-title">Gestão do sistema</h2>
          <div className="inicio-grade">
            {SECOES_DONO.map((s) => <Cartao key={s.href} secao={s} />)}
          </div>
        </section>
      )}
    </main>
  );
}
