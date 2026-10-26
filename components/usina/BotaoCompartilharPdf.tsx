'use client';

// Compartilha o PDF do relatorio: no celular abre o menu de compartilhar (WhatsApp, e-mail, Arquivos...).
// Onde o aparelho nao compartilha arquivo, baixa o PDF.
import { useState } from 'react';

export function BotaoCompartilharPdf({ url, nomeArquivo, titulo }: { url: string; nomeArquivo: string; titulo: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function compartilhar() {
    setErro(null);
    setOcupado(true);
    try {
      const resposta = await fetch(url, { credentials: 'same-origin' });
      if (!resposta.ok) throw new Error('falha');
      const blob = await resposta.blob();
      const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });
      const nav = navigator as Navigator & { canShare?: (dados: ShareData) => boolean };
      // Menu de compartilhar só em aparelho de toque (celular/tablet); no computador baixa o PDF.
      const ehToque = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      if (ehToque && nav.share && nav.canShare?.({ files: [arquivo] })) {
        await nav.share({ files: [arquivo], title: titulo });
      } else {
        // Computador (ou aparelho sem compartilhamento de arquivo): baixa o PDF.
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      }
    } catch (e) {
      // Cancelar o menu de compartilhar nao e erro.
      if (!(e instanceof DOMException && e.name === 'AbortError')) setErro('Não foi possível gerar o PDF. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={compartilhar} disabled={ocupado} className="btn btn-primary h-11">
        {ocupado ? 'Preparando PDF…' : 'Compartilhar PDF'}
      </button>
      {erro && <span className="text-sm text-bad">{erro}</span>}
    </div>
  );
}
