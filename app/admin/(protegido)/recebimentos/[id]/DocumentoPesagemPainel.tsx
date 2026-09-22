'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { enviarDocumentoPesagemAction, obterUrlDocumentoAction } from './actions';

interface AnexoExistente {
  id: string;
  url: string;
  uploadedAt: string;
}

interface Props {
  movimentacaoId: string;
  anexo: AnexoExistente | null;
}

const FORMATOS_ACEITOS = '.pdf,.jpg,.jpeg,.png';

function nomeParaExibicao(chave: string): string {
  // chave: documentos-pesagem/<movimentacaoId>/<uuid>-<nome-sanitizado>
  const ultimaParte = chave.split('/').pop() ?? chave;
  const semUuid = ultimaParte.replace(/^[0-9a-f-]{36}-/, '');
  return semUuid || ultimaParte;
}

export function DocumentoPesagemPainel({ movimentacaoId, anexo }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [abrindo, setAbrindo] = useState(false);

  async function enviar() {
    setErro('');
    const arquivo = inputRef.current?.files?.[0];
    if (!arquivo) {
      setErro('Selecione um arquivo (PDF, JPG ou PNG) antes de enviar.');
      return;
    }
    const formData = new FormData();
    formData.append('arquivo', arquivo);

    setEnviando(true);
    const resultado = await enviarDocumentoPesagemAction(movimentacaoId, formData);
    setEnviando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Não foi possível enviar o documento.');
      return;
    }
    if (inputRef.current) inputRef.current.value = '';
    router.refresh();
  }

  async function abrir() {
    if (!anexo) return;
    setAbrindo(true);
    const resultado = await obterUrlDocumentoAction(anexo.id);
    setAbrindo(false);
    if (!resultado.ok || !resultado.url) {
      setErro(resultado.erro ?? 'Não foi possível abrir o documento.');
      return;
    }
    window.open(resultado.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold text-neutral-800">Documento de pesagem</h2>
      <p className="mt-1 text-sm text-neutral-500">Nota de pesagem do caminhão. Formatos aceitos: PDF, JPG ou PNG.</p>

      {anexo ? (
        <div className="mt-3 flex items-center justify-between rounded border bg-neutral-50 p-3 text-sm">
          <div>
            <p className="font-medium text-neutral-800">{nomeParaExibicao(anexo.url)}</p>
            <p className="text-neutral-500">Enviado em {anexo.uploadedAt}</p>
          </div>
          <button
            className="h-10 rounded border px-4 disabled:opacity-50"
            disabled={abrindo}
            onClick={abrir}
          >
            {abrindo ? 'Abrindo...' : 'Abrir documento'}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-amber-700">Nenhum documento anexado ainda.</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input ref={inputRef} type="file" accept={FORMATOS_ACEITOS} className="text-sm" />
        <button
          className="h-10 rounded bg-neutral-900 px-4 text-sm text-white disabled:bg-neutral-300"
          disabled={enviando}
          onClick={enviar}
        >
          {enviando ? 'Enviando...' : anexo ? 'Substituir documento' : 'Enviar documento'}
        </button>
      </div>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      <p className="mt-2 text-xs text-neutral-400">Tamanho máximo: 10 MB.</p>
    </section>
  );
}
