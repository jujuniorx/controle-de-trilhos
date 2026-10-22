'use client';

import { useState } from 'react';

/**
 * No PC, o botão é o link de sempre: abre o PDF numa aba nova.
 * No celular, o arquivo é buscado e entregue pela folha de compartilhamento (Salvar em Arquivos),
 * porque no iPhone o link abria o PDF em tela cheia sem botão de voltar. Quando o aparelho
 * não compartilha arquivos, baixa direto.
 * A troca entre os dois é feita por CSS (.inf-so-pc / .inf-so-celular), sem detectar o aparelho em JS.
 */
export function BotaoBaixarPdf({ href, nomeArquivo }: { href: string; nomeArquivo: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  async function baixar() {
    setOcupado(true);
    setErro('');
    try {
      const resposta = await fetch(href, { credentials: 'same-origin' });
      if (!resposta.ok) throw new Error('falha');
      const blob = await resposta.blob();
      const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });
      const nav = navigator as Navigator & { canShare?: (dados: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: nomeArquivo });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (erroCapturado) {
      // Cancelar a folha de compartilhamento não é erro.
      if ((erroCapturado as { name?: string })?.name === 'AbortError') return;
      setErro('Não foi possível baixar agora. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <a href={href} className="inf-so-pc btn btn-primary btn-sm">Baixar PDF</a>
      <div className="inf-so-celular flex flex-col items-end gap-1">
        <button type="button" onClick={baixar} disabled={ocupado} className="btn btn-primary btn-sm">
          {ocupado ? 'Preparando…' : 'Baixar PDF'}
        </button>
        {erro && <p role="alert" className="text-xs text-danger">{erro}</p>}
      </div>
    </>
  );
}
