// Linha do tempo de uma movimentação (remetido e recebimento). Componente de servidor,
// sem estado: agrupa por dia, mostra quem fez e de qual setor, e traduz códigos internos
// (status, ações) para o texto que o escritório usa no dia a dia.

export interface EventoHistorico {
  id: string;
  acao: string;
  usuarioNome: string;
  valorAntigo: string | null;
  valorNovo: string | null;
  timestamp: Date;
}

type Setor = 'Pátio' | 'Portaria' | 'Administrativo' | 'Sistema';

const SETOR_ESTILO: Record<Setor, { dot: string; pill: string }> = {
  Pátio: { dot: 'bg-primary', pill: 'text-primary border-primary/40' },
  Portaria: { dot: 'bg-warn', pill: 'text-warn border-warn/40' },
  Administrativo: { dot: 'bg-ink', pill: 'text-ink border-ink/30' },
  Sistema: { dot: 'bg-ink-dim', pill: 'text-ink-dim border-ink-dim/40' },
};

// Ação → título curto + setor que a originou. Ações novas caem em "Sistema" com o código cru.
const ACAO_INFO: Record<string, { titulo: string; setor: Setor }> = {
  // Remetido
  PRE_CADASTRO: { titulo: 'Pré-cadastro criado', setor: 'Administrativo' },
  CONFIRMACAO_CHEGADA: { titulo: 'Medidas confirmadas', setor: 'Pátio' },
  LANCAMENTO_DIRETO: { titulo: 'Remetido lançado direto', setor: 'Pátio' },
  NF_INFORMADA: { titulo: 'Nota fiscal informada/corrigida', setor: 'Administrativo' },
  NF_ADICIONADA: { titulo: 'Outra nota fiscal adicionada', setor: 'Administrativo' },
  NF_REMOVIDA: { titulo: 'Nota fiscal extra removida', setor: 'Administrativo' },
  PESO_NF_INFORMADO: { titulo: 'Peso da NF informado/corrigido', setor: 'Administrativo' },
  TIPO_REMETIDO_INFORMADO: { titulo: 'Tipo de remetido informado', setor: 'Administrativo' },
  EDICAO: { titulo: 'Remetido editado', setor: 'Administrativo' },
  REABERTURA: { titulo: 'Conferência reaberta', setor: 'Administrativo' },
  CONFERENCIA: { titulo: 'Remetido conferido', setor: 'Administrativo' },
  MEDICAO_CONCLUIDA: { titulo: 'Pátio terminou de medir', setor: 'Pátio' },
  MEDICAO_REABERTA: { titulo: 'Pátio voltou a medir', setor: 'Pátio' },
  // Portaria
  PORTARIA_DADOS: { titulo: 'Dados do motorista/caminhão salvos', setor: 'Portaria' },
  PORTARIA_CRIOU_ENVIO: { titulo: 'Envio criado pela Portaria (carreta chegou sem aviso)', setor: 'Portaria' },
  CARRETA_CHEGOU: { titulo: 'Carreta chegou na Portaria', setor: 'Portaria' },
  CARRETA_LIBERADA: { titulo: 'Carreta liberada pelo Pátio', setor: 'Pátio' },
  LIBERACAO_DESFEITA: { titulo: 'Liberação desfeita pelo Pátio', setor: 'Pátio' },
  CARRETA_SAIU: { titulo: 'Carreta saiu (Portaria)', setor: 'Portaria' },
  // Recebimento
  CRIACAO: { titulo: 'Recebimento criado pelo Pátio', setor: 'Pátio' },
  PESO_INFORMADO: { titulo: 'Peso da sucata informado/corrigido', setor: 'Administrativo' },
  ANEXO: { titulo: 'Documento de pesagem anexado', setor: 'Administrativo' },
  ANEXO_SUBSTITUIDO: { titulo: 'Documento de pesagem substituído', setor: 'Administrativo' },
};

const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_CHEGADA: 'Aguardando chegada',
  PENDENTE_CONFERENCIA: 'Pendente de conferência',
  CONFERIDO: 'Conferido',
};

function nomeESetor(usuarioNome: string): { nome: string; setor: Setor | null } {
  const m = usuarioNome.match(/^(.*)\s+\((pátio|portaria)\)$/i);
  if (!m) return { nome: usuarioNome, setor: null };
  const setor = m[2].toLowerCase() === 'portaria' ? 'Portaria' : 'Pátio';
  return { nome: m[1], setor };
}

function valorLegivel(v: string): string {
  return STATUS_LABEL[v] ?? v;
}

function diaDoEvento(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function horaDoEvento(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

function rotuloDia(d: Date): string {
  const hoje = diaDoEvento(new Date());
  const dia = diaDoEvento(d);
  if (dia === hoje) return 'Hoje';
  return dia;
}

export function HistoricoMovimentacao({ historico }: { historico: EventoHistorico[] }) {
  if (historico.length === 0) {
    return <p className="text-sm text-ink-dim">Nenhuma movimentação registrada ainda.</p>;
  }

  // Histórico vem do mais recente para o mais antigo; agrupa por dia mantendo essa ordem.
  const grupos: { dia: string; eventos: EventoHistorico[] }[] = [];
  for (const ev of historico) {
    const dia = rotuloDia(ev.timestamp);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.eventos.push(ev);
    else grupos.push({ dia, eventos: [ev] });
  }

  return (
    <div className="space-y-5">
      {grupos.map((g) => (
        <div key={g.dia}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-dim">{g.dia}</p>
          <ol className="relative ml-1 space-y-4 border-l border-ink-dim/30 pl-5">
            {g.eventos.map((ev) => {
              const info = ACAO_INFO[ev.acao];
              const { nome, setor: setorUsuario } = nomeESetor(ev.usuarioNome);
              const setor: Setor = info?.setor ?? setorUsuario ?? 'Sistema';
              const estilo = SETOR_ESTILO[setor];
              const temValor = ev.valorAntigo != null || ev.valorNovo != null;
              return (
                <li key={ev.id} className="relative">
                  <span className={`absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface ${estilo.dot}`} aria-hidden />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-ink">{info?.titulo ?? ev.acao}</span>
                    <span className={`rounded border px-1.5 py-px text-[11px] font-medium ${estilo.pill}`}>{setor}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {nome} · {horaDoEvento(ev.timestamp)}
                  </p>
                  {temValor && (
                    <p className="mt-1 text-sm text-ink-dim">
                      {ev.valorAntigo != null ? valorLegivel(ev.valorAntigo) : '—'}
                      <span className="mx-1.5" aria-hidden>→</span>
                      {ev.valorNovo != null ? valorLegivel(ev.valorNovo) : '—'}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
