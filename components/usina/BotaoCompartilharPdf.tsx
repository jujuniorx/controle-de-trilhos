'use client';

// Compartilha o PDF do relatorio: no celular abre o menu de compartilhar (WhatsApp, e-mail, Arquivos...).
// Onde o aparelho nao compartilha arquivo, baixa o PDF.
import { useState } from 'react';

/** Converte o SVG do relatorio em PNG, no navegador, na resolucao 2x (texto nitido no celular). */
async function svgParaPng(blobSvg: Blob): Promise<Blob> {
  const texto = await blobSvg.text();
  const medida = texto.match(/width="(\d+)" height="(\d+)"/);
  if (!medida) throw new Error('svg sem medidas');
  const largura = Number(medida[1]);
  const altura = Number(medida[2]);
  const urlSvg = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml' }));
  try {
    const imagem = await new Promise<HTMLImageElement>((ok, falha) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => falha(new Error('imagem invalida'));
      img.src = urlSvg;
    });
    const escala = 2;
    const canvas = document.createElement('canvas');
    canvas.width = largura * escala;
    canvas.height = altura * escala;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponivel');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
    if (!png) throw new Error('png falhou');
    return png;
  } finally {
    URL.revokeObjectURL(urlSvg);
  }
}

export function BotaoCompartilharPdf({ url, nomeArquivo, titulo, rotulo = 'Compartilhar', png = false }: { url: string; nomeArquivo: string; titulo: string; rotulo?: string; /** Entrega PNG (convertido aqui) em vez do arquivo recebido. */ png?: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function compartilhar() {
    setErro(null);
    setOcupado(true);
    try {
      const resposta = await fetch(url, { credentials: 'same-origin' });
      if (!resposta.ok) throw new Error(`servidor respondeu ${resposta.status}`);
      const blobOriginal = await resposta.blob();
      let blob = blobOriginal;
      let nome = nomeArquivo;
      if (png) {
        try {
          blob = await svgParaPng(blobOriginal);
        } catch (e) {
          // Não converteu: entrega o SVG para não ficar sem arquivo, e avisa o motivo.
          nome = nomeArquivo.replace(/\.png$/, '.svg');
          blob = blobOriginal;
          setErro(`Não converteu em PNG (${e instanceof Error ? e.message : 'erro'}). Baixei em SVG.`);
        }
      }
      const arquivo = new File([blob], nome, { type: blob.type || 'application/octet-stream' });
      const nav = navigator as Navigator & { canShare?: (dados: ShareData) => boolean };
      // Menu de compartilhar só em aparelho de toque (celular/tablet); no computador baixa o PDF.
      const ehToque = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      if (ehToque && nav.share && nav.canShare?.({ files: [arquivo] })) {
        await nav.share({ files: [arquivo], title: titulo });
      } else {
        // Computador (ou aparelho sem compartilhamento de arquivo): baixa o PDF.
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = nome;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      }
    } catch (e) {
      // Cancelar o menu de compartilhar nao e erro.
      if (!(e instanceof DOMException && e.name === 'AbortError')) setErro(`Não foi possível gerar o arquivo (${e instanceof Error ? e.message : 'erro'}). Tente de novo.`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={compartilhar} disabled={ocupado} className="btn btn-primary h-11">
        {ocupado ? 'Preparando…' : rotulo}
      </button>
      {erro && <span className="text-sm text-bad">{erro}</span>}
    </div>
  );
}
