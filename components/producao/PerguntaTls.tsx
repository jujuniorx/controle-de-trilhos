'use client';

import { useEffect, useRef, useState } from 'react';
import { tlsDoForm, type ConfigTlsForm, type SituacaoTls } from '@/lib/producaoTls';

type Props = ConfigTlsForm & { data: string; hora: string; respostaSalva: string };

const NADA: SituacaoTls = { aberto: 0, pergunta: false, pendente: false, encerradoCom: 0 };

/**
 * Reemprego: a partir de 28 soldas no TLS em aberto, pergunta nesta hora "TLS encerrado?".
 * Enquanto a resposta for "não", a pergunta volta a cada solda a mais. Sem resposta, o dia não salva.
 */
export function PerguntaTls({ data, hora, horas, sobraEntrada, fabricanteSalvo, fabricantesSalvos, respostaSalva }: Props) {
  const [resposta, setResposta] = useState(respostaSalva);
  const [situacao, setSituacao] = useState<SituacaoTls>(NADA);
  const oculto = useRef<HTMLInputElement>(null);
  const montado = useRef(false);
  // Mesmo prefixo das paradas: sai do aparelho junto com elas quando o dia é salvo.
  const chave = `producao-parada-${data}-${hora}-tls`;
  const horasKey = horas.join(',');
  const salvosKey = JSON.stringify(fabricantesSalvos);

  useEffect(() => {
    try {
      const v = localStorage.getItem(chave);
      if (v !== null) setResposta(v);
    } catch { /* sem armazenamento: segue com o que veio salvo */ }
  }, [chave]);

  useEffect(() => {
    const form = document.getElementById('form-producao') as HTMLFormElement | null;
    if (!form) return;
    const cfg = { horas: horasKey.split(','), sobraEntrada, fabricanteSalvo, fabricantesSalvos: JSON.parse(salvosKey) as Record<string, string> };
    const calcular = () => {
      const s = tlsDoForm(form, cfg)[hora] ?? NADA;
      setSituacao((a) => (a.aberto === s.aberto && a.pergunta === s.pergunta && a.pendente === s.pendente && a.encerradoCom === s.encerradoCom ? a : s));
    };
    calcular();
    form.addEventListener('input', calcular);
    form.addEventListener('change', calcular);
    return () => {
      form.removeEventListener('input', calcular);
      form.removeEventListener('change', calcular);
    };
  }, [hora, horasKey, sobraEntrada, fabricanteSalvo, salvosKey]);

  // Avisa o formulário (rascunho, avisos e as outras horas) quando a resposta muda.
  useEffect(() => {
    if (!montado.current) { montado.current = true; return; }
    oculto.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [resposta]);

  function guardar(v: string) {
    setResposta(v);
    try { localStorage.setItem(chave, v); } catch { /* sem armazenamento */ }
  }

  const { aberto, pergunta, pendente, encerradoCom } = situacao;
  const sim = pergunta && resposta.startsWith('sim:');
  const nao = pergunta && !pendente && resposta.startsWith('nao:');
  const qtd = sim ? resposta.slice(4).replace(/^0$/, '') : '';

  return (
    <>
      <input ref={oculto} type="hidden" name={`tls_${hora}`} value={resposta} readOnly />
      {pergunta && (
        <div
          role="group"
          aria-labelledby={`tls_titulo_${hora}`}
          className={`space-y-3 rounded-lg border p-3 sm:col-span-2 ${pendente ? 'border-bad/40 bg-bad/10' : 'border-line'}`}
        >
          <p id={`tls_titulo_${hora}`} className="text-sm font-semibold">
            Reemprego: o TLS em aberto está com {aberto} soldas. TLS encerrado?
          </p>
          <div className="flex flex-wrap gap-2">
            <button id={`tls_sim_${hora}`} type="button" aria-pressed={sim} onClick={() => guardar(`sim:${aberto}`)} className={`btn h-11 ${sim ? 'btn-primary' : 'btn-ghost'}`}>
              Sim, encerrou
            </button>
            <button type="button" aria-pressed={nao} onClick={() => guardar(`nao:${aberto}`)} className={`btn h-11 ${nao ? 'btn-primary' : 'btn-ghost'}`}>
              Não, continua
            </button>
          </div>
          {sim && (
            <div className="field">
              <label htmlFor={`tls_qtd_${hora}`}>Fechou com quantas soldas?</label>
              <input
                id={`tls_qtd_${hora}`}
                inputMode="numeric"
                value={qtd}
                onChange={(e) => guardar(`sim:${e.target.value.replace(/\D/g, '').slice(0, 3) || '0'}`)}
                className="h-11"
              />
              <p className="text-xs text-ink-muted">
                {encerradoCom
                  ? aberto - encerradoCom > 0
                    ? `TLS encerrado com ${encerradoCom} soldas. As outras ${aberto - encerradoCom} já contam para o próximo TLS.`
                    : `TLS encerrado com ${encerradoCom} soldas. O próximo começa do zero.`
                  : `Informe um número de 1 a ${aberto}.`}
              </p>
            </div>
          )}
          {nao && <p className="text-xs text-ink-muted">TLS continua aberto. A pergunta volta quando entrar mais solda.</p>}
          {pendente && !sim && <p className="text-xs font-semibold text-bad">Responda para poder salvar o dia.</p>}
        </div>
      )}
    </>
  );
}
