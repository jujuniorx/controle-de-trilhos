'use client';

import { useEffect, useState } from 'react';
import { SOLDAS_POR_TLS, resumoTlsDoForm, type ConfigTlsForm, type ResumoTls } from '@/lib/producaoTls';
import { TrilhoTls } from '@/components/producao/TrilhoTls';

// Painel fixo no topo da Produção: o TLS em montagem, ao vivo, enquanto o soldador digita as soldas.
// O trecho que veio de ontem sai hachurado. No reemprego o TLS não fecha em 12, então só aparecem as barras soldadas.
// No celular fica compacto (trilho e número) e abre o detalhe ao tocar.

const VAZIO: ResumoTls = { soldasHoje: 0, tlsHoje: 0, fechouOntem: false, aberto: 0, deOntem: 0, reemprego: false };

export function TrilhoAoVivo(cfg: ConfigTlsForm & { formId: string }) {
  const [r, setR] = useState<ResumoTls>({ ...VAZIO, aberto: cfg.sobraEntrada, deOntem: cfg.sobraEntrada });
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const form = document.getElementById(cfg.formId) as HTMLFormElement | null;
    if (!form) return;
    let quadro = 0;
    const atualizar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => setR(resumoTlsDoForm(form, cfg)));
    };
    atualizar();
    form.addEventListener('input', atualizar);
    form.addEventListener('change', atualizar);
    form.addEventListener('click', atualizar);
    // O rascunho do aparelho e a resposta "TLS encerrado?" mudam campos sem avisar: confere de novo de vez em quando.
    const relogio = window.setInterval(atualizar, 1500);
    return () => {
      form.removeEventListener('input', atualizar);
      form.removeEventListener('change', atualizar);
      form.removeEventListener('click', atualizar);
      window.clearInterval(relogio);
      cancelAnimationFrame(quadro);
    };
    // cfg vem do servidor e não muda enquanto a página está aberta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.formId]);

  const hoje = r.aberto - r.deOntem;
  const faltam = SOLDAS_POR_TLS - r.aberto;
  const numero = r.reemprego ? `${r.aberto}` : `${r.aberto}/${SOLDAS_POR_TLS}`;

  return (
    <div className="trilho-ao-vivo" data-aberto={aberto ? 'sim' : 'nao'}>
      <button type="button" className="trilho-ao-vivo-topo" aria-expanded={aberto} aria-controls="trilho-ao-vivo-detalhe" onClick={() => setAberto((a) => !a)}>
        <span className="trilho-ao-vivo-rotulo">{r.reemprego ? 'TLS de reemprego' : 'TLS em montagem'}</span>
        <span className="trilho-ao-vivo-numero tabular-nums">{numero}</span>
        <span className="trilho-ao-vivo-tls tabular-nums">
          {r.tlsHoje} TLS hoje
        </span>
      </button>
      <TrilhoTls feitas={r.aberto} total={SOLDAS_POR_TLS} deOntem={r.deOntem} semSoltas={r.reemprego} />
      <div id="trilho-ao-vivo-detalhe" className="trilho-ao-vivo-detalhe" aria-live="polite">
        {r.aberto === 0 ? (
          <span>TLS novo: ainda sem soldas</span>
        ) : r.reemprego ? (
          <span>{r.aberto} soldas no TLS · fecha quando o soldador encerrar</span>
        ) : (
          <>
            {r.deOntem > 0 && <span className="trilho-ao-vivo-ontem">{r.deOntem} de ontem</span>}
            {r.deOntem > 0 && <span aria-hidden="true">·</span>}
            <span className="trilho-ao-vivo-hoje">{hoje} de hoje</span>
            <span aria-hidden="true">·</span>
            <span>faltam {faltam}</span>
          </>
        )}
        <span className="trilho-ao-vivo-dia">
          {r.soldasHoje} {r.soldasHoje === 1 ? 'solda' : 'soldas'} no dia{r.fechouOntem ? ' · 1 TLS de ontem fechou hoje' : ''}
        </span>
      </div>
    </div>
  );
}
