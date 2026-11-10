import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { listarChegadasDaPortaria, listarRemetidosDaPortaria } from '@/lib/services/portaria-admin';
import { ROTULO_ESTADO, ROTULO_ESTADO_CHEGADA } from '@/lib/domain/portaria';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { BotaoApagar } from './BotaoApagar';
import { BotaoExcluirMovimentacao } from '@/components/admin/BotaoExcluirMovimentacao';
import { apagarChegadaAction, limparDadosPortariaAction } from './actions';

export const dynamic = 'force-dynamic';

const BADGE_REM = { AGUARDANDO_CARRETA: 'badge-muted', CHEGOU: 'badge-warn', LIBERADA: 'badge-ok', SAIU: 'badge-info' } as const;
const BADGE_CHEG = { AGUARDANDO_LIBERACAO: 'badge-muted', LIBERADA: 'badge-warn', RECEBIDA: 'badge-ok', SAIU: 'badge-info', CANCELADA: 'badge-muted' } as const;

/** Situações que já terminaram: ficam na aba "Já saíram". */
const ENCERRADAS_CHEG = new Set(['SAIU', 'CANCELADA']);
const ENCERRADAS_REM = new Set(['SAIU']);

interface Linha {
  key: string;
  tipo: 'Carga' | 'Descarga';
  placas: string[];
  motorista: string | null;
  cidade: string | null;
  status: string;
  badge: string;
  encerrada: boolean;
  etapas: { rotulo: string; em: Date | null }[];
  saidaPor: string | null;
  ver: ReactNode;
  menu: ReactNode;
}

const soAlfanumerico = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

function hora(d: Date | null): string {
  return d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—';
}

function casa(l: Linha, termo: string): boolean {
  if (!termo) return true;
  const placa = soAlfanumerico(termo);
  const porPlaca = placa.length > 0 && l.placas.some((p) => soAlfanumerico(p).includes(placa));
  const porTexto = (valor: string | null) => Boolean(valor && valor.toLowerCase().includes(termo.toLowerCase()));
  return porPlaca || porTexto(l.cidade) || porTexto(l.motorista);
}

function Abas({ aba, q, emAndamento, saidas }: { aba: string; q: string; emAndamento: number; saidas: number }) {
  const link = (valor: string, rotulo: string, n: number) => (
    <Link
      href={`/admin/portaria?aba=${valor}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
      className={`btn btn-sm ${aba === valor ? 'btn-primary' : 'btn-ghost'}`}
      aria-current={aba === valor ? 'page' : undefined}
    >
      {rotulo} <span className="ml-1 opacity-80">{n}</span>
    </Link>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {link('andamento', 'Em andamento', emAndamento)}
      {link('saidas', 'Já saíram', saidas)}
    </div>
  );
}

export default async function AdminPortariaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; q?: string | string[] }>;
}) {
  const { role } = await requireAdmin();
  const dono = role === 'DONO';
  const params = await searchParams;
  const aba = params.aba === 'saidas' ? 'saidas' : 'andamento';
  const q = typeof params.q === 'string' ? params.q.slice(0, 80) : '';

  const [remetidos, chegadas] = await Promise.all([listarRemetidosDaPortaria(), listarChegadasDaPortaria()]);

  const linhas: Linha[] = [
    ...chegadas.map<Linha>((c) => ({
      key: `d-${c.id}`,
      tipo: 'Descarga',
      placas: [c.placaCavalo, c.placaCarreta].filter((p): p is string => Boolean(p)),
      motorista: c.motoristaNome,
      cidade: c.origem,
      status: ROTULO_ESTADO_CHEGADA[c.estado],
      badge: BADGE_CHEG[c.estado],
      encerrada: ENCERRADAS_CHEG.has(c.estado),
      etapas: [
        { rotulo: 'Liberada', em: c.liberadaEm },
        { rotulo: 'Saiu', em: c.saidaEm },
      ],
      saidaPor: c.saidaPor,
      ver: c.movimentacaoId ? (
        <Link href={`/admin/recebimentos/${c.movimentacaoId}`} className="btn btn-ghost btn-sm">Ver detalhes</Link>
      ) : null,
      menu: (
        <>
          <a href={`/portaria/pdf-chegada/${c.id}`} download className="btn btn-ghost btn-sm">Baixar PDF</a>
          <BotaoApagar
            rotulo="Apagar"
            aviso="Apagar esta chegada de vez? Não dá para desfazer."
            acao={apagarChegadaAction.bind(null, c.id)}
          />
        </>
      ),
    })),
    ...remetidos.map<Linha>((m) => ({
      key: `c-${m.id}`,
      tipo: 'Carga',
      placas: [m.placaCavalo, m.placaCarreta].filter((p): p is string => Boolean(p)),
      motorista: m.motoristaNome,
      cidade: m.destino,
      status: ROTULO_ESTADO[m.estado],
      badge: BADGE_REM[m.estado],
      encerrada: ENCERRADAS_REM.has(m.estado),
      etapas: [
        { rotulo: 'Chegou', em: m.chegadaPortariaEm },
        { rotulo: 'Liberada', em: m.carretaLiberadaEm },
        { rotulo: 'Saiu', em: m.saidaPortariaEm },
      ],
      saidaPor: m.saidaPortariaPor,
      ver: <Link href={`/admin/remetidos/${m.id}`} className="btn btn-ghost btn-sm">Ver detalhes</Link>,
      menu: (
        <>
          <a href={`/portaria/pdf/${m.id}`} download className="btn btn-ghost btn-sm">Baixar PDF</a>
          {dono && (
            <BotaoApagar
              rotulo="Limpar dados da Portaria"
              aviso="Apagar motorista, placas, horários e observação da Portaria deste remetido? O remetido em si continua."
              acao={limparDadosPortariaAction.bind(null, m.id)}
            />
          )}
          <BotaoExcluirMovimentacao id={m.id} rotulo={m.destino || 'Remetido'} />
        </>
      ),
    })),
  ];

  const emAndamento = linhas.filter((l) => !l.encerrada).length;
  const saidas = linhas.length - emAndamento;
  const visiveis = linhas
    .filter((l) => l.encerrada === (aba === 'saidas'))
    .filter((l) => casa(l, q.trim()))
    .sort((a, b) => {
      const ultimo = (l: Linha) => Math.max(0, ...l.etapas.map((e) => (e.em ? new Date(e.em).getTime() : 0)));
      return ultimo(b) - ultimo(a);
    });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-1">
        <h1 className="page-title">Portaria</h1>
        <p className="text-sm text-ink-muted">Carretas que passaram pela Portaria: descargas (chegadas) e cargas (remetidos). Use a busca para achar por placa, cidade ou motorista.</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Abas aba={aba} q={q} emAndamento={emAndamento} saidas={saidas} />
        <form method="get" className="flex gap-2">
          <input type="hidden" name="aba" value={aba} />
          <input name="q" type="search" defaultValue={q} placeholder="Buscar placa, cidade ou motorista" className="h-10 w-full md:w-80" aria-label="Buscar na Portaria" />
          <button type="submit" className="btn btn-sm btn-primary">Buscar</button>
        </form>
      </div>

      {visiveis.length === 0 ? (
        <EstadoVazio
          titulo={q ? 'Nada encontrado' : aba === 'saidas' ? 'Nenhuma saída registrada' : 'Nada em andamento'}
          texto={q ? 'Tente outra placa, cidade ou motorista.' : 'Os lançamentos da Portaria aparecem aqui.'}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((l) => (
            <li key={l.key} className="card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="badge badge-muted">{l.tipo}</span>
                <span className={`badge whitespace-nowrap ${l.badge}`}>{l.status}</span>
              </div>

              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-ink">{l.motorista || 'Sem motorista'}</p>
                <p className="truncate text-sm text-ink-muted">{l.cidade || 'Sem cidade'}</p>
              </div>

              {l.placas.length > 0 ? (
                <span className="placas">{l.placas.map((p) => <span key={p}>{p}</span>)}</span>
              ) : (
                <span className="text-sm text-ink-muted">Sem placa</span>
              )}

              <ul className="space-y-1 text-xs text-ink-muted">
                {l.etapas.map((e) => (
                  <li key={e.rotulo} className="flex justify-between gap-2">
                    <span>{e.rotulo}</span>
                    <span className={e.em ? 'text-ink' : ''}>{hora(e.em)}</span>
                  </li>
                ))}
              </ul>
              {l.saidaPor && <p className="text-xs text-ink-muted">Saída por {l.saidaPor}</p>}

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
                {l.ver ?? <span />}
                <details className="relative">
                  <summary className="btn btn-ghost btn-sm cursor-pointer list-none">Mais</summary>
                  <div className="absolute right-0 z-10 mt-2 flex w-56 flex-col items-stretch gap-1 rounded-lg border border-line bg-surface p-2 shadow-lg">
                    {l.menu}
                  </div>
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
