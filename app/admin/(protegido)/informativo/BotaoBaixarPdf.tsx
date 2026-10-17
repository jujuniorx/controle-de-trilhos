'use client';

import { useState } from 'react';

/**
 * Baixa o PDF sem abrir o leitor do navegador. No iPhone, o link comum abria o PDF em tela cheia
 * sem botão de voltar; aqui o arquivo é buscado e entregue pela folha de compartilhamento (Salvar em Arquivos),
 * ou baixado direto quando o aparelho não compartilha arquivos.
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
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={baixar} disabled={ocupado} className="btn btn-primary btn-sm">
        {ocupado ? 'Preparando…' : 'Baixar PDF'}
      </button>
      {erro && <p role="alert" className="text-xs text-danger">{erro}</p>}
    </div>
  );
}
