'use client';

import { useState } from 'react';

/** Baixa o SVG do relatório da serra como PNG (o dobro do tamanho, para ficar nítido no WhatsApp e no e-mail). */
export function BaixarImagemSerra({ svgId, nomeArquivo }: { svgId: string; nomeArquivo: string }) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar() {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    setGerando(true);
    setErro(null);
    try {
      const largura = Number(svg.getAttribute('width')) || 1600;
      const altura = Number(svg.getAttribute('height')) || 960;
      const copia = svg.cloneNode(true) as SVGElement;
      copia.removeAttribute('style');
      const texto = new XMLSerializer().serializeToString(copia);
      // data: e não blob: — a política de segurança do site só libera imagens de data: e do próprio domínio.
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texto)}`;
      const img = new Image();
      await new Promise<void>((ok, falha) => {
        img.onload = () => ok();
        img.onerror = () => falha(new Error('imagem'));
        img.src = url;
      });
      const escala = 2;
      const canvas = document.createElement('canvas');
      canvas.width = largura * escala;
      canvas.height = altura * escala;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
      if (!png) throw new Error('png');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(png);
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch {
      setErro('Não deu para gerar a imagem. Tente de novo.');
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" className="btn btn-primary" onClick={baixar} disabled={gerando}>
        {gerando ? 'Gerando…' : 'Baixar imagem (PNG)'}
      </button>
      {erro && <span className="text-sm text-red-500" role="alert">{erro}</span>}
    </div>
  );
}
