'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { IconeCheck, IconeSeta } from '@/components/icones/Icones';
import { COR_APP, ROTULOS_TEMA, TEMA_COOKIE, TEMA_PADRAO, TEMAS, iconesDoTema, temaValido, type Tema } from '@/lib/tema/tema';

/**
 * Seletor de tema do sistema. A escolha vale para todas as áreas: grava o cookie e
 * já atualiza o data-tema do <html> na hora, trocando o visual inteiro (cores, cards,
 * menu lateral, fundo e animações). Sem escolha, o padrão é o Azul-marinho.
 *
 * É um menu próprio (não o <select> do navegador): cada opção mostra uma amostra das
 * cores do tema, e o menu segue o visual do tema atual.
 */
/**
 * Troca na hora o ícone da aba, o ícone do iPhone, a cor da barra do sistema e o
 * manifesto do app instalado, para a marca acompanhar o tema escolhido.
 */
function trocarIconesDoApp(tema: Tema) {
  const icones = iconesDoTema(tema);
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((l) => { l.href = icones.favicon; });
  document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((l) => { l.href = icones.apple; });
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => { m.content = COR_APP[tema]; });
  // Novo endereço faz o navegador ler o manifesto de novo (com o cookie do tema já gravado).
  const manifesto = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifesto) manifesto.href = `/manifest.webmanifest?tema=${tema}`;
}

export function AlternarTema({ padrao = TEMA_PADRAO, className = '' }: { padrao?: Tema; className?: string }) {
  const [tema, setTema] = useState<Tema>(padrao);
  const [aberto, setAberto] = useState(false);
  const [lado, setLado] = useState<'direita' | 'esquerda'>('direita');
  const [paraCima, setParaCima] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTema(temaValido(document.documentElement.dataset.tema) ?? padrao);
  }, [padrao]);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: PointerEvent) => {
      if (!raizRef.current?.contains(evento.target as Node)) setAberto(false);
    };
    const tecla = (evento: globalThis.KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setAberto(false);
        botaoRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  // Ao abrir, o foco vai para o tema atual (setas do teclado andam pela lista).
  useEffect(() => {
    if (!aberto) return;
    raizRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
  }, [aberto]);

  function alternar() {
    if (!aberto) {
      // O menu abre para o lado e o sentido em que couber na tela.
      const caixa = botaoRef.current?.getBoundingClientRect();
      if (caixa) {
        setLado(caixa.right < 240 ? 'esquerda' : 'direita');
        setParaCima(window.innerHeight - caixa.bottom < 290 && caixa.top > 290);
      }
    }
    setAberto(!aberto);
  }

  function escolher(proximo: Tema) {
    setAberto(false);
    botaoRef.current?.focus();
    if (proximo === tema) return;
    const aplicar = () => {
      document.documentElement.dataset.tema = proximo;
      document.cookie = `${TEMA_COOKIE}=${proximo}; path=/; max-age=31536000; samesite=lax`;
      setTema(proximo);
      trocarIconesDoApp(proximo);
    };
    // Troca com o circulo que se expande a partir do seletor (como no Sales Dashboard).
    // Sem suporte ou com "reduzir movimento", troca direto.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!doc.startViewTransition || reduzir) {
      aplicar();
      return;
    }
    const caixa = botaoRef.current?.getBoundingClientRect();
    const x = caixa ? caixa.left + caixa.width / 2 : window.innerWidth - 40;
    const y = caixa ? caixa.top + caixa.height / 2 : 30;
    document.documentElement.style.setProperty('--vt-x', `${x}px`);
    document.documentElement.style.setProperty('--vt-y', `${y}px`);
    doc.startViewTransition(aplicar);
  }

  function andar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp' && evento.key !== 'Home' && evento.key !== 'End') return;
    evento.preventDefault();
    const itens = Array.from(evento.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
    const atual = itens.indexOf(document.activeElement as HTMLButtonElement);
    let proximo = atual;
    if (evento.key === 'ArrowDown') proximo = (atual + 1) % itens.length;
    if (evento.key === 'ArrowUp') proximo = (atual - 1 + itens.length) % itens.length;
    if (evento.key === 'Home') proximo = 0;
    if (evento.key === 'End') proximo = itens.length - 1;
    itens[proximo]?.focus();
  }

  return (
    <div ref={raizRef} className={`ct-seletor-tema ${className}`} data-aberto={aberto}>
      <button
        ref={botaoRef}
        type="button"
        className="tema-botao"
        onClick={alternar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Tema do sistema: ${ROTULOS_TEMA[tema]}`}
        title="Tema do sistema"
      >
        <span className="tema-amostra" data-amostra={tema} aria-hidden="true" />
        <span className="tema-rotulo">{ROTULOS_TEMA[tema]}</span>
        <IconeSeta size={14} className="tema-seta" />
      </button>
      {aberto && (
        <div className="tema-menu" role="menu" aria-label="Tema do sistema" data-lado={lado} data-para-cima={paraCima} onKeyDown={andar}>
          {TEMAS.map((opcao) => (
            <button
              key={opcao}
              type="button"
              role="menuitemradio"
              aria-checked={opcao === tema}
              className="tema-opcao"
              onClick={() => escolher(opcao)}
            >
              <span className="tema-amostra" data-amostra={opcao} aria-hidden="true" />
              <span className="tema-opcao-nome">{ROTULOS_TEMA[opcao]}</span>
              {opcao === tema && <IconeCheck size={15} className="tema-opcao-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
