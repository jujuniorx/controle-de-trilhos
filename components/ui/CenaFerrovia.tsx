'use client';

import { useEffect, useRef } from 'react';

/**
 * Cena da ferrovia em canvas, usada no fundo das telas.
 *
 * inicio (tela inicial, logins e abertura do app): o TLS saindo do estaleiro. O trilho longo desliza sobre
 *   roletes na parte de baixo e para na Schlatter a cada barra: as garras descem, a emenda centelha, recalca,
 *   é rebarbada e segue esfriando. Atrás, o galpão com as luminárias; ao lado da máquina, o soldador.
 *   A primeira solda acontece junto com a solda do logo. ("abertura" é o nome antigo e cai aqui também.)
 * saudacao (faixa "Bom dia"): a via vista de lado, com o céu da hora de verdade (sol nascendo, de tarde,
 *   pondo, lua e estrelas à noite), a serra ao fundo, postes com fios, os dormentes passando e, de tempos
 *   em tempos, uma composição da Rumo (locomotiva prata e azul) levando TLS sobre vagões plataforma.
 *
 * As cores vêm do tema: no estaleiro, das variáveis --cena-* (app/temas.css); na saudação, da cor do texto da
 * faixa, então a cena funciona sobre o fundo de qualquer tema. Com "reduzir movimento" fica um quadro parado.
 * O desenho para quando a tela não está visível.
 */

type Modo = 'abertura' | 'saudacao' | 'inicio';
type RGB = [number, number, number];

const CHAVE_INTRO = 'ct_cena_intro';

export function CenaFerrovia({ modo, intro = 'auto' }: { modo: Modo; intro?: 'auto' | 'completa' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    return modo === 'saudacao' ? iniciarSaudacao(cv) : iniciarInicio(cv, intro);
  }, [modo, intro]);
  return <canvas ref={ref} className={`cena-ferrovia cena-${modo}`} aria-hidden="true" />;
}

// ---------- utilidades ----------

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const suave = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
const misturar = (c1: RGB, c2: RGB, t: number): RGB => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
const cor = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function lerRGB(estilo: CSSStyleDeclaration, nome: string, padrao: RGB): RGB {
  const v = estilo.getPropertyValue(nome).trim();
  const n = v.split(/[\s,]+/).map(Number);
  return n.length >= 3 && n.every((x) => Number.isFinite(x)) ? [n[0], n[1], n[2]] : padrao;
}
function rgbDeCor(css: string, padrao: RGB): RGB {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(css);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : padrao;
}
function reduzirMovimento() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Família de fonte para o canvas. O canvas não entende var(--...), então lê o valor da variável do tema
 * (a fonte carregada pelo Next) e cai para as genéricas se não houver.
 */
const fontesCache: Record<string, string> = {};
function fonte(variavel: '--font-barlow' | '--font-barlow-cond', reserva: string): string {
  if (fontesCache[variavel]) return fontesCache[variavel];
  let v = '';
  try { v = getComputedStyle(document.body).getPropertyValue(variavel).trim(); } catch { /* fora do navegador */ }
  fontesCache[variavel] = v ? `${v}, ${reserva}` : reserva;
  return fontesCache[variavel];
}

/** Laço de desenho com pausa quando a tela some, ajuste de tamanho e troca de tema. */
function laco(
  cv: HTMLCanvasElement,
  dprMax: number,
  aoMudarTema: () => void,
  quadro: (ctx: CanvasRenderingContext2D, W: number, H: number, t: number, dt: number) => void,
) {
  const ctx = cv.getContext('2d');
  if (!ctx) return () => {};
  const parado = reduzirMovimento();
  let W = 0;
  let H = 0;
  let visivel = true;
  let pedido = 0;
  let inicio = performance.now();
  let ultimo = inicio;
  let tParado = 0;

  const medir = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, dprMax);
    W = cv.clientWidth;
    H = cv.clientHeight;
    cv.width = Math.max(1, Math.round(W * dpr));
    cv.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (parado) desenharUma();
  };
  const passo = (agora: number) => {
    pedido = 0;
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    if (W > 0 && H > 0) quadro(ctx, W, H, (agora - inicio) / 1000, dt);
    if (visivel && !parado) pedido = requestAnimationFrame(passo);
  };
  // Quadro único (movimento reduzido): a cena já pronta, como no fim da abertura.
  const desenharUma = () => {
    if (W > 0 && H > 0) quadro(ctx, W, H, 6 + tParado, 0);
  };
  const retomar = () => {
    if (parado) return desenharUma();
    if (!pedido && visivel) {
      ultimo = performance.now();
      pedido = requestAnimationFrame(passo);
    }
  };

  const ro = new ResizeObserver(medir);
  ro.observe(cv);
  const io = new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting && !document.hidden;
    if (visivel) retomar();
  });
  io.observe(cv);
  const aoOcultar = () => {
    visivel = !document.hidden;
    if (visivel) retomar();
  };
  document.addEventListener('visibilitychange', aoOcultar);
  const mo = new MutationObserver(() => {
    aoMudarTema();
    if (parado) desenharUma();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema', 'class'] });

  medir();
  retomar();
  return {
    reiniciar: () => {
      inicio = performance.now();
    },
    parar: () => {
      cancelAnimationFrame(pedido);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', aoOcultar);
    },
  };
}

/** Faíscas de solda saindo da emenda dos trilhos do logo, desenhadas no mesmo canvas. */
interface Faisca { x: number; y: number; vx: number; vy: number; v: number; clarao?: boolean }
function soldarLogo(cv: HTMLCanvasElement, faiscas: Faisca[]) {
  const raiz = cv.closest('main, section, .abertura') ?? document;
  const logo = raiz.querySelector('.logo-animada');
  if (!logo) return;
  const r = logo.getBoundingClientRect();
  const c = cv.getBoundingClientRect();
  if (!r.width) return;
  // Trilhos do logo em y = 15 e 41 na caixa de 56; a emenda fica no meio (x = 28).
  for (const yRel of [15 / 56, 41 / 56]) {
    const x = r.left - c.left + r.width / 2;
    const y = r.top - c.top + r.height * yRel;
    faiscas.push({ x, y, vx: 0, vy: 0, v: 1, clarao: true });
    for (let i = 0; i < 16; i++) {
      // Faíscas saem para os lados e para cima, caem com a gravidade e apagam piscando.
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 3.0;
      const v = 120 + Math.random() * 260;
      faiscas.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, v: 0.45 + Math.random() * 0.55 });
    }
  }
}
function desenharFaiscas(ctx: CanvasRenderingContext2D, faiscas: Faisca[], dt: number, H: number) {
  for (const s of faiscas) {
    if (s.clarao) { s.v -= dt * 2.6; continue; }
    s.vy += 820 * dt;
    s.vx *= 1 - dt * 0.8;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.v -= dt * 1.25;
  }
  for (let i = faiscas.length - 1; i >= 0; i--) if (faiscas[i].v <= 0 || faiscas[i].y > H) faiscas.splice(i, 1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const s of faiscas) {
    if (s.clarao) {
      // Clarão da solda: branco no centro, laranja em volta, some rápido.
      const r = 10 + (1 - s.v) * 26;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
      g.addColorStop(0, `rgba(255,255,240,${0.95 * s.v})`);
      g.addColorStop(0.35, `rgba(255,190,90,${0.6 * s.v})`);
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.283); ctx.fill();
      continue;
    }
    const pisca = 0.7 + 0.3 * Math.sin(s.x * 0.7 + s.y);
    const a = Math.min(1, s.v * 1.4) * pisca;
    // Esfria do branco-amarelado para o laranja e o vermelho.
    const g = Math.round(110 + 140 * s.v), b = Math.round(40 + 120 * Math.max(0, s.v - 0.6));
    ctx.strokeStyle = `rgba(255,${g},${b},${a})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 0.016, s.y - s.vy * 0.016);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- cores da cena (variáveis --cena-* de app/temas.css) ----------

interface PaletaAbertura {
  ceuTopo: RGB; ceuHorizonte: RGB; neblina: RGB; brita: RGB; britaPerto: RGB; dorm: RGB;
  aco: RGB; acoLado: RGB; farol: RGB; poste: RGB; sinal1: RGB; sinal2: RGB; estrelas: number;
}

function paletaAbertura(el: Element): PaletaAbertura {
  const e = getComputedStyle(el);
  return {
    ceuTopo: lerRGB(e, '--cena-ceu-topo', [5, 9, 18]),
    ceuHorizonte: lerRGB(e, '--cena-ceu-horizonte', [26, 42, 66]),
    neblina: lerRGB(e, '--cena-neblina', [44, 66, 98]),
    brita: lerRGB(e, '--cena-brita', [36, 47, 64]),
    britaPerto: lerRGB(e, '--cena-brita-perto', [46, 56, 72]),
    dorm: lerRGB(e, '--cena-dormente', [22, 27, 36]),
    aco: lerRGB(e, '--cena-aco', [232, 241, 252]),
    acoLado: lerRGB(e, '--cena-aco-lado', [74, 97, 128]),
    farol: lerRGB(e, '--cena-farol', [255, 214, 160]),
    poste: lerRGB(e, '--cena-poste', [120, 140, 165]),
    sinal1: lerRGB(e, '--cena-sinal-1', [90, 230, 160]),
    sinal2: lerRGB(e, '--cena-sinal-2', [255, 170, 70]),
    estrelas: Number(e.getPropertyValue('--cena-estrelas').trim() || '1'),
  };
}

// ---------- saudação: a via vista de lado, com o céu da hora ----------

function iniciarSaudacao(cv: HTMLCanvasElement) {
  const caixa = cv.parentElement ?? cv;
  let tinta = rgbDeCor(getComputedStyle(caixa).color, [255, 255, 255]);
  const parado = reduzirMovimento();
  let semente = 5;
  const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  const estrelas = Array.from({ length: 60 }, () => ({ x: rnd(), y: rnd() * 0.6, r: rnd() * 0.9 + 0.3, f: rnd() * 6.28 }));
  // Velocidades (px/s) das camadas: serra longe, serra perto, postes, dormentes.
  const VEL = { serraLonge: 5, serraPerto: 11, postes: 46, via: 150, tls: 230 };
  let x0 = 0;
  const lua = document.createElement('canvas');
  const PRIMEIRO_TLS = 2.5, INTERVALO_TLS = 22;

  const controle = laco(cv, 1.5, () => { tinta = rgbDeCor(getComputedStyle(caixa).color, tinta); }, (ctx, W, H, t, dt) => {
    ctx.clearRect(0, 0, W, H);
    x0 += parado ? 0 : dt;
    const entra = parado ? 1 : suave(0, 1.4, t);
    const agora = new Date();
    const hora = agora.getHours() + agora.getMinutes() / 60;
    const dia = hora >= 6 && hora < 18.3;
    const quente = Math.max(0, 1 - Math.abs(hora - 6.6) / 1.4, 1 - Math.abs(hora - 17.6) / 1.4);
    const chao = H * 0.86;
    const fino = W < 560;

    // sol (de dia) ou lua e estrelas (de noite), no lado direito, onde não tem texto
    const p = dia ? (hora - 6) / 12.3 : (((hora - 18.3 + 24) % 24) / 11.7);
    const ax = W * (fino ? 0.6 : 0.52) + W * (fino ? 0.32 : 0.42) * p;
    const ay = chao * 0.95 - Math.sin(Math.min(1, Math.max(0, p)) * Math.PI) * H * 0.62 + (1 - entra) * H * 0.25;
    if (dia) {
      const corSol: RGB = misturar([255, 236, 176], [255, 150, 84], quente);
      const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, H * 0.9);
      g.addColorStop(0, cor(corSol, 0.38 * entra)); g.addColorStop(1, cor(corSol, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = cor(corSol, 0.95 * entra);
      ctx.beginPath(); ctx.arc(ax, ay, Math.max(9, H * 0.09), 0, 6.283); ctx.fill();
    } else {
      for (const s of estrelas) {
        const a = (0.25 + 0.3 * Math.sin(t * 1.1 + s.f)) * entra;
        ctx.fillStyle = cor(tinta, a);
        ctx.beginPath(); ctx.arc(W * (0.35 + s.x * 0.65), s.y * chao, s.r, 0, 6.283); ctx.fill();
      }
      const r = Math.max(8, H * 0.075);
      const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, r * 5);
      g.addColorStop(0, cor(tinta, 0.18 * entra)); g.addColorStop(1, cor(tinta, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ax, ay, r * 5, 0, 6.283); ctx.fill();
      // Lua crescente: recortada numa tela à parte, para o recorte não apagar o céu atrás.
      const lado = Math.ceil(r * 2 + 4);
      lua.width = lado;
      lua.height = lado;
      const lc = lua.getContext('2d');
      if (lc) {
        lc.fillStyle = cor(tinta, 0.85 * entra);
        lc.beginPath(); lc.arc(lado / 2, lado / 2, r, 0, 6.283); lc.fill();
        lc.globalCompositeOperation = 'destination-out';
        lc.beginPath(); lc.arc(lado / 2 - r * 0.45, lado / 2 - r * 0.2, r * 0.92, 0, 6.283); lc.fill();
        ctx.drawImage(lua, ax - lado / 2, ay - lado / 2);
      }
    }

    // serra ao fundo (duas camadas, a de trás mais clara)
    const serra = (base: number, amp: number, vel: number, alfa: number, k: number) => {
      const desl = x0 * vel;
      ctx.fillStyle = cor(tinta, alfa * entra);
      ctx.beginPath();
      ctx.moveTo(0, chao);
      for (let x = 0; x <= W + 8; x += 8) {
        const u = (x + desl) * k;
        const y = base - amp * (0.55 * Math.sin(u) + 0.3 * Math.sin(u * 2.3 + 1.7) + 0.15 * Math.sin(u * 5.1 + 0.4)) - amp * 0.6;
        ctx.lineTo(x, y + (1 - entra) * H * 0.2);
      }
      ctx.lineTo(W, chao);
      ctx.closePath();
      ctx.fill();
    };
    serra(chao - H * 0.18, H * 0.2, VEL.serraLonge, 0.06, 0.006);
    serra(chao - H * 0.08, H * 0.16, VEL.serraPerto, 0.09, 0.011);

    // postes com fios, como os da beira da linha
    const esp = 190;
    const desl = (x0 * VEL.postes) % esp;
    const topoPoste = chao - H * 0.5;
    ctx.strokeStyle = cor(tinta, 0.2 * entra);
    ctx.lineWidth = 1.6;
    const xs: number[] = [];
    for (let x = -desl; x < W + esp; x += esp) xs.push(x);
    for (const x of xs) {
      ctx.beginPath(); ctx.moveTo(x, chao); ctx.lineTo(x, topoPoste); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 9, topoPoste + 5); ctx.lineTo(x + 9, topoPoste + 5); ctx.stroke();
    }
    ctx.strokeStyle = cor(tinta, 0.13 * entra);
    ctx.lineWidth = 1;
    for (let i = 0; i < xs.length - 1; i++) {
      for (const dx of [-8, 8]) {
        ctx.beginPath();
        ctx.moveTo(xs[i] + dx, topoPoste + 5);
        ctx.quadraticCurveTo((xs[i] + xs[i + 1]) / 2 + dx, topoPoste + 14, xs[i + 1] + dx, topoPoste + 5);
        ctx.stroke();
      }
    }

    // composição de TLS cruzando: locomotiva + vagões plataforma com os trilhos longos por cima
    if (!parado && t > PRIMEIRO_TLS) {
      const ciclo = (t - PRIMEIRO_TLS) % INTERVALO_TLS;
      const alto0 = Math.max(16, H * 0.15);
      const LL = alto0 * 4.8; // locomotiva AC44i: uns 22 m de comprimento para 4,7 m de altura
      const comp = LL + 8 * 96;
      const xFrente = W + 40 - ciclo * VEL.tls;
      if (xFrente > -comp - 40) {
        const trilhoY = chao - H * 0.06;
        const alto = alto0;
        const a = 0.94 * entra;
        // Locomotiva da Rumo no desenho de uma AC44i: cinza-prateado com a faixa azul e o nome, cabine na frente,
        // capô longo, radiadores atrás, estrado azul com faixa amarela, tanque e truques de três eixos.
        const PRATA: RGB = [200, 206, 214], AZUL_RUMO: RGB = [22, 58, 136], AZUL_ESTRADO: RGB = [16, 38, 92], ESCURO: RGB = [40, 44, 52];
        const lx = xFrente;
        const X = (f: number) => lx + f * LL;
        const Y = (f: number) => trilhoY - f * alto;
        const corpo = () => {
          ctx.beginPath();
          ctx.moveTo(X(0), Y(0.32));
          ctx.lineTo(X(0), Y(0.58));
          ctx.lineTo(X(0.025), Y(0.64));
          ctx.lineTo(X(0.07), Y(0.64)); // nariz
          ctx.lineTo(X(0.07), Y(0.9));
          ctx.lineTo(X(0.085), Y(1.0));
          ctx.lineTo(X(0.21), Y(1.0)); // cabine
          ctx.lineTo(X(0.21), Y(0.84));
          ctx.lineTo(X(0.84), Y(0.84)); // capô longo
          ctx.lineTo(X(0.87), Y(0.92));
          ctx.lineTo(X(0.995), Y(0.92)); // radiadores
          ctx.lineTo(X(0.995), Y(0.32));
          ctx.closePath();
        };
        const lataria = ctx.createLinearGradient(0, Y(1), 0, Y(0.32));
        lataria.addColorStop(0, cor(misturar(PRATA, [255, 255, 255], 0.4), a));
        lataria.addColorStop(1, cor(misturar(PRATA, [0, 0, 0], 0.15), a));
        ctx.fillStyle = lataria;
        corpo();
        ctx.fill();
        ctx.save();
        corpo();
        ctx.clip();
        // faixa azul na metade de baixo, com um filete claro em cima
        ctx.fillStyle = cor(AZUL_RUMO, a);
        ctx.fillRect(X(0), Y(0.56), LL, alto * 0.24);
        ctx.fillStyle = cor(misturar(AZUL_RUMO, [255, 255, 255], 0.3), a);
        ctx.fillRect(X(0), Y(0.575), LL, alto * 0.018);
        // portas do capô e grade dos radiadores
        ctx.fillStyle = cor([0, 0, 0], 0.16 * a);
        for (let f = 0.27; f < 0.82; f += 0.055) ctx.fillRect(X(f), Y(0.82), 1, alto * 0.24);
        for (let f = 0.62; f < 0.9; f += 0.06) ctx.fillRect(X(0.875), Y(f), LL * 0.11, 1);
        ctx.restore();
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.font = `700 ${Math.round(alto * 0.2)}px ${fonte('--font-barlow', '"Barlow", Arial, sans-serif')}`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText('rumo', X(0.52), Y(0.445));
        ctx.textAlign = 'left';
        // freio dinâmico e chaminé em cima do capô
        ctx.fillStyle = cor(misturar(PRATA, [0, 0, 0], 0.25), a);
        ctx.fillRect(X(0.45), Y(0.88), LL * 0.13, alto * 0.04);
        ctx.fillStyle = cor(ESCURO, a);
        ctx.fillRect(X(0.63), Y(0.89), LL * 0.02, alto * 0.05);
        // janelas da cabine com luz
        ctx.fillStyle = `rgba(255,214,150,${0.85 * a})`;
        ctx.fillRect(X(0.075), Y(0.9), LL * 0.022, alto * 0.15);
        ctx.fillRect(X(0.12), Y(0.9), LL * 0.07, alto * 0.16);
        // estrado azul com a faixa amarela, tanque e truques de três eixos
        ctx.fillStyle = cor(AZUL_ESTRADO, a);
        ctx.fillRect(X(0.005), Y(0.32), LL * 0.99, alto * 0.1);
        ctx.fillStyle = cor([236, 190, 40], a);
        ctx.fillRect(X(0.005), Y(0.24), LL * 0.99, alto * 0.025);
        ctx.fillStyle = cor(misturar(ESCURO, [255, 255, 255], 0.1), a);
        ctx.beginPath(); ctx.roundRect(X(0.36), Y(0.22), LL * 0.28, alto * 0.11, alto * 0.04); ctx.fill();
        ctx.fillStyle = cor(ESCURO, a);
        ctx.fillRect(X(0.06), Y(0.22), LL * 0.26, alto * 0.08);
        ctx.fillRect(X(0.68), Y(0.22), LL * 0.26, alto * 0.08);
        // farol aceso na frente
        const g = ctx.createRadialGradient(X(0), Y(0.48), 0, X(0), Y(0.48), alto * 1.6);
        g.addColorStop(0, `rgba(255,226,170,${0.75 * entra})`); g.addColorStop(1, 'rgba(255,226,170,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(0), Y(0.48), alto * 1.6, 0, 6.283); ctx.fill();
        // vagões plataforma (cinza escuro) com o TLS por cima, em duas camadas
        const v0 = lx + LL + 4;
        for (let v = 0; v < 8; v++) {
          const vx = v0 + v * 96;
          ctx.fillStyle = cor(ESCURO, a);
          ctx.fillRect(vx, trilhoY - alto * 0.3, 92, alto * 0.12);
          ctx.fillStyle = cor(misturar(ESCURO, [255, 255, 255], 0.15), a);
          ctx.fillRect(vx, trilhoY - alto * 0.3, 92, alto * 0.025);
          ctx.fillStyle = cor(AZUL_RUMO, a);
          ctx.fillRect(vx + 30, trilhoY - alto * 0.36, 4, alto * 0.06);
          ctx.fillRect(vx + 62, trilhoY - alto * 0.36, 4, alto * 0.06);
        }
        const tls = ctx.createLinearGradient(0, trilhoY - alto * 0.55, 0, trilhoY - alto * 0.36);
        tls.addColorStop(0, cor([236, 240, 246], a)); tls.addColorStop(1, cor([140, 150, 165], a));
        ctx.fillStyle = tls;
        ctx.fillRect(v0 + 6, trilhoY - alto * 0.43, 8 * 96 - 14, alto * 0.06);
        ctx.fillRect(v0 + 12, trilhoY - alto * 0.53, 8 * 96 - 26, alto * 0.06);
        // rodas (três por truque na locomotiva, duas por truque nos vagões)
        ctx.fillStyle = cor([24, 26, 30], a);
        const rodas: number[] = [];
        for (const f of [0.1, 0.19, 0.28, 0.72, 0.81, 0.9]) rodas.push(X(f));
        for (let v = 0; v < 8; v++) rodas.push(v0 + v * 96 + 14, v0 + v * 96 + 78);
        for (const rx of rodas) { ctx.beginPath(); ctx.arc(rx, trilhoY - alto * 0.12, alto * 0.08, 0, 6.283); ctx.fill(); }
      }
    }

    // via em primeiro plano: lastro, dormentes passando e o trilho com um brilho correndo
    const esp2 = 26;
    const d2 = (x0 * VEL.via) % esp2;
    ctx.fillStyle = cor(tinta, 0.07 * entra);
    ctx.fillRect(0, chao + 2, W, H - chao);
    ctx.fillStyle = cor(tinta, 0.22 * entra);
    for (let x = -d2; x < W + esp2; x += esp2) ctx.fillRect(x, chao + 1, 13, 4);
    const brilho = ctx.createLinearGradient(0, 0, W, 0);
    const pos = parado ? 0.8 : ((t * 0.22) % 1.4) - 0.2;
    brilho.addColorStop(0, cor(tinta, 0.42 * entra));
    brilho.addColorStop(Math.min(1, Math.max(0, pos - 0.06)), cor(tinta, 0.42 * entra));
    brilho.addColorStop(Math.min(1, Math.max(0, pos)), cor(tinta, 0.95 * entra));
    brilho.addColorStop(Math.min(1, Math.max(0, pos + 0.06)), cor(tinta, 0.42 * entra));
    brilho.addColorStop(1, cor(tinta, 0.42 * entra));
    ctx.fillStyle = brilho;
    ctx.fillRect(0, chao - 2, W, 3);

    // calmaria à esquerda, onde fica o texto
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const calma = ctx.createLinearGradient(0, 0, W * (fino ? 1 : 0.58), 0);
    calma.addColorStop(0, `rgba(0,0,0,${fino ? 0.55 : 0.8})`);
    calma.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = calma;
    ctx.fillRect(0, 0, W, chao - 4);
    ctx.restore();
  });
  return typeof controle === 'function' ? controle : controle.parar;
}

// ---------- Schlatter e soldador (desenhos do estaleiro) ----------

interface GeoMaquina {
  M: number; mL: number; mR: number; mT: number; wL: number; wR: number; wT: number; wB: number; piso: number;
  estreito: boolean; mq: (c: RGB) => RGB;
}
const SCH = {
  LARANJA: [235, 161, 58] as RGB, CREME: [216, 204, 176] as RGB, AZUL: [44, 90, 147] as RGB, TUBO: [120, 166, 214] as RGB,
  CINZA: [70, 74, 80] as RGB, LONA: [150, 150, 142] as RGB, AMARELO: [240, 196, 40] as RGB,
};

/** Frente da Schlatter, sem as partes que mexem (desenhada uma vez numa tela à parte e reaproveitada). A janela fica vazada. */
function desenharFrenteSchlatter(c: CanvasRenderingContext2D, g: GeoMaquina) {
  const { M, mL, mR, mT, wL, wR, wT, wB, piso, mq } = g;
  const painel = (x: number, y: number, w: number, h: number, base: RGB, claro = 0.1, escuro = 0.14) => {
    const gr = c.createLinearGradient(x, y, x + w * 0.6, y + h);
    gr.addColorStop(0, cor(misturar(mq(base), [255, 255, 255], claro)));
    gr.addColorStop(1, cor(misturar(mq(base), [0, 0, 0], escuro)));
    c.fillStyle = gr;
    c.fillRect(x, y, w, h);
  };
  const linha = (x1: number, y1: number, x2: number, y2: number, cc: string, w = 1) => {
    c.strokeStyle = cc; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  };
  const parafuso = (x: number, y: number) => {
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(x, y, Math.max(1, M * 0.012), 0, 6.283); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(x - 0.4, y - 0.4, Math.max(0.5, M * 0.006), 0, 6.283); c.fill();
  };
  const sombraAresta = 'rgba(0,0,0,.28)', luzAresta = 'rgba(255,255,255,.22)';

  // caixa do transformador em cima, atrás
  painel(mL + 0.9 * M, mT - 0.45 * M, mR - mL - 1.3 * M, 0.37 * M, misturar(SCH.CREME, [0, 0, 0], 0.18));
  linha(mL + 0.9 * M, mT - 0.45 * M, mR - 0.4 * M, mT - 0.45 * M, luzAresta);
  // saia de lona cinza na boca do tubo de exaustão
  const sx0 = mL + 0.55 * M;
  c.fillStyle = cor(mq(SCH.LONA));
  c.beginPath();
  c.moveTo(sx0 - 0.24 * M, mT - 0.08 * M); c.lineTo(sx0 + 0.24 * M, mT - 0.08 * M);
  c.lineTo(sx0 + 0.15 * M, mT - 0.55 * M); c.lineTo(sx0 - 0.15 * M, mT - 0.55 * M);
  c.closePath(); c.fill();
  for (let i = -2; i <= 2; i++) linha(sx0 + i * 0.07 * M, mT - 0.1 * M, sx0 + i * 0.045 * M, mT - 0.53 * M, 'rgba(0,0,0,.18)');

  // barra azul do topo
  painel(mL - 0.06 * M, mT - 0.1 * M, mR - mL + 0.12 * M, 0.1 * M, SCH.AZUL, 0.15, 0.1);

  // bloco creme da esquerda com duas portas
  painel(mL, mT, wL - mL, wB - mT, SCH.CREME);
  const meio = (mL + wL) / 2;
  for (const [x0, x1] of [[mL + 0.07 * M, meio - 0.025 * M], [meio + 0.025 * M, wL - 0.07 * M]]) {
    c.strokeStyle = sombraAresta; c.lineWidth = 1.2;
    c.strokeRect(x0, mT + 0.12 * M, x1 - x0, wB - mT - 0.24 * M);
    linha(x0 + 1, mT + 0.12 * M + 1, x1 - 1, mT + 0.12 * M + 1, luzAresta);
    // dobradiças e puxador
    c.fillStyle = 'rgba(40,40,40,.55)';
    c.fillRect(x0 - 0.015 * M, mT + 0.3 * M, 0.03 * M, 0.12 * M);
    c.fillRect(x0 - 0.015 * M, wB - 0.42 * M, 0.03 * M, 0.12 * M);
    c.fillRect(x1 - 0.07 * M, (mT + wB) / 2 - 0.08 * M, 0.025 * M, 0.16 * M);
  }
  // venezianas na porta da esquerda
  for (let i = 0; i < 6; i++) {
    const y = mT + 0.3 * M + i * 0.09 * M;
    linha(mL + 0.17 * M, y, meio - 0.12 * M, y, 'rgba(0,0,0,.3)', 1.2);
    linha(mL + 0.17 * M, y + 1.2, meio - 0.12 * M, y + 1.2, 'rgba(255,255,255,.18)');
  }
  // plaqueta da máquina
  const plL = meio + 0.1 * M, plW = wL - 0.17 * M - plL;
  c.fillStyle = 'rgb(200,204,210)';
  c.fillRect(plL, mT + 0.32 * M, plW, 0.13 * M);
  c.fillStyle = 'rgb(40,44,52)';
  let tam = 0.075 * M;
  c.font = `700 ${tam}px ${fonte('--font-barlow-cond', '"Barlow Condensed", "Arial Narrow", sans-serif')}`;
  const largTexto = c.measureText('SCHLATTER').width;
  if (largTexto > plW * 0.86) { tam *= (plW * 0.86) / largTexto; c.font = `700 ${tam}px ${fonte('--font-barlow-cond', '"Barlow Condensed", "Arial Narrow", sans-serif')}`; }
  c.textBaseline = 'middle';
  c.textAlign = 'center';
  c.fillText('SCHLATTER', plL + plW / 2, mT + 0.386 * M);
  c.textAlign = 'left';
  // botoeira de emergência amarela com o botão vermelho
  const bx = mL + 0.16 * M, by = wB - 0.62 * M;
  painel(bx, by, 0.2 * M, 0.24 * M, SCH.AMARELO, 0.15, 0.1);
  c.fillStyle = 'rgb(205,40,36)';
  c.beginPath(); c.arc(bx + 0.1 * M, by + 0.12 * M, 0.06 * M, 0, 6.283); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)';
  c.beginPath(); c.arc(bx + 0.085 * M, by + 0.105 * M, 0.02 * M, 0, 6.283); c.fill();

  // faixa sobre a janela, com uma etiqueta de aviso
  painel(wL, mT, wR - wL, wT - mT, SCH.CREME, 0.06, 0.18);
  c.fillStyle = cor(mq(SCH.AZUL));
  c.fillRect(wL, wT - 0.12 * M, wR - wL, 0.05 * M);
  const tx = (wL + wR) / 2, ty = mT + 0.28 * M, ts = 0.12 * M;
  c.fillStyle = cor(SCH.AMARELO);
  c.beginPath(); c.moveTo(tx, ty - ts); c.lineTo(tx + ts, ty + ts * 0.75); c.lineTo(tx - ts, ty + ts * 0.75); c.closePath(); c.fill();
  c.strokeStyle = 'rgb(30,30,30)'; c.lineWidth = Math.max(1, M * 0.012); c.stroke();
  c.beginPath(); c.moveTo(tx + 0.02 * M, ty - 0.06 * M); c.lineTo(tx - 0.03 * M, ty + 0.01 * M); c.lineTo(tx + 0.02 * M, ty + 0.01 * M); c.lineTo(tx - 0.02 * M, ty + 0.07 * M); c.stroke();

  // corpo da máquina atrás da porta (aparece quando a porta fecha sobre a janela)
  painel(wR, mT, mR - wR, wB - mT, misturar(SCH.CREME, [0, 0, 0], 0.22), 0.04, 0.2);
  for (let i = 0; i < 8; i++) {
    const y = mT + 0.3 * M + i * 0.1 * M;
    linha(wR + 0.2 * M, y, mR - 0.2 * M, y, 'rgba(0,0,0,.28)', 1.2);
  }
  // trilhos da porta (em cima e embaixo, da janela até a direita) e as guias da grade, dos lados da janela
  c.fillStyle = 'rgb(58,62,70)';
  c.fillRect(wL - 0.04 * M, mT - 0.02 * M, mR - wL + 0.04 * M, 0.05 * M);
  c.fillRect(wL - 0.04 * M, wB - 0.03 * M, mR - wL + 0.04 * M, 0.05 * M);
  c.fillRect(wL - 0.1 * M, mT + 0.05 * M, 0.04 * M, wB - mT - 0.05 * M);
  c.fillRect(wR + 0.06 * M, mT + 0.05 * M, 0.04 * M, wB - mT - 0.05 * M);
  // cilindro do hidráulico da porta, em cima da janela da esquerda (puxa a porta da direita para a esquerda)
  const cg = c.createLinearGradient(0, mT - 0.2 * M, 0, mT - 0.08 * M);
  cg.addColorStop(0, 'rgb(90,96,104)'); cg.addColorStop(0.5, 'rgb(150,156,164)'); cg.addColorStop(1, 'rgb(70,74,80)');
  c.fillStyle = cg;
  c.beginPath(); c.roundRect(mL + 0.15 * M, mT - 0.2 * M, wL - mL - 0.15 * M, 0.12 * M, 0.04 * M); c.fill();

  // base azul com a sapata escura e parafusos
  painel(mL, wB, mR - mL, piso - wB, SCH.AZUL, 0.08, 0.2);
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.fillRect(mL - 0.04 * M, piso - 0.08 * M, mR - mL + 0.08 * M, 0.08 * M);
  for (let x = mL + 0.15 * M; x < mR - 0.1 * M; x += 0.3 * M) parafuso(x, wB + 0.08 * M);
  linha(mL, wB, mR, wB, luzAresta);

  // moldura da janela, com chanfro
  c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = Math.max(2, 0.03 * M);
  c.strokeRect(wL, wT, wR - wL, wB - wT);
  linha(wL, wB + 1, wR, wB + 1, luzAresta);

  // estrutura azul de tubos à direita, que segura o tubo de exaustão
  if (!g.estreito) {
    c.fillStyle = cor(mq(SCH.AZUL));
    for (const px of [mR + 0.3 * M, mR + 1.25 * M]) c.fillRect(px - 0.035 * M, mT - 1.6 * M, 0.07 * M, piso - mT + 1.6 * M);
    c.fillRect(mR + 0.3 * M, mT - 1.63 * M, 0.95 * M, 0.07 * M);
    c.strokeStyle = cor(mq(SCH.AZUL)); c.lineWidth = 0.05 * M;
    c.beginPath(); c.moveTo(mR + 0.3 * M, mT - 1.0 * M); c.lineTo(mR + 1.25 * M, mT - 1.56 * M); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.18)';
    for (const px of [mR + 0.3 * M, mR + 1.25 * M]) c.fillRect(px - 0.035 * M, mT - 1.6 * M, 0.015 * M, piso - mT + 1.6 * M);
  }
}

/** Porta laranja da Schlatter (desliza da direita para a esquerda, com hidráulico), desenhada a partir de (0, 0). */
function desenharPortaSchlatter(c: CanvasRenderingContext2D, M: number, w: number, h: number, mq: (c: RGB) => RGB) {
  const gr = c.createLinearGradient(0, 0, w * 0.6, h);
  gr.addColorStop(0, cor(misturar(mq(SCH.LARANJA), [255, 255, 255], 0.1)));
  gr.addColorStop(1, cor(misturar(mq(SCH.LARANJA), [0, 0, 0], 0.16)));
  c.fillStyle = gr;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.2;
  c.strokeRect(0.05 * M, 0.08 * M, w - 0.1 * M, h - 0.16 * M);
  c.fillStyle = 'rgba(255,255,255,.2)';
  c.fillRect(0.05 * M, 0.08 * M, w - 0.1 * M, 1);
  for (let i = 0; i < 5; i++) {
    for (const y of [0.14 * M, h - 0.13 * M]) {
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(0.12 * M + i * ((w - 0.24 * M) / 4), y, Math.max(1, M * 0.012), 0, 6.283); c.fill();
    }
  }
  // roldanas em cima (corre no trilho) e o puxador
  c.fillStyle = 'rgb(50,52,58)';
  for (const x of [0.18 * M, w - 0.18 * M]) { c.beginPath(); c.arc(x, 0.03 * M, 0.04 * M, 0, 6.283); c.fill(); }
  c.fillStyle = cor(mq(misturar(SCH.LARANJA, [0, 0, 0], 0.45)));
  c.fillRect(0.12 * M, h * 0.42, 0.05 * M, 0.45 * M);
  // etiqueta zebrada e aviso
  c.fillStyle = cor(SCH.AMARELO);
  c.fillRect(w * 0.35, h - 0.62 * M, 0.3 * M, 0.2 * M);
  c.fillStyle = 'rgb(30,30,30)';
  for (let i = 0; i < 4; i++) c.fillRect(w * 0.35 + i * 0.08 * M, h - 0.62 * M, 0.035 * M, 0.035 * M);
  const tx = w * 0.78, ty = h * 0.2, ts = 0.1 * M;
  c.fillStyle = cor(SCH.AMARELO);
  c.beginPath(); c.moveTo(tx, ty - ts); c.lineTo(tx + ts, ty + ts * 0.75); c.lineTo(tx - ts, ty + ts * 0.75); c.closePath(); c.fill();
  c.strokeStyle = 'rgb(30,30,30)'; c.lineWidth = Math.max(1, M * 0.012); c.stroke();

  // conjunto da janelinha de visita (como na foto): caixa azul com etiqueta amarela, alavanca preta com bola
  // vermelha em cima e, ao lado, a abertura com moldura creme onde desce a grade de barras
  const j = JANELINHA(M);
  const azulCx = c.createLinearGradient(j.caixaX, 0, j.caixaX + j.caixaW, 0);
  azulCx.addColorStop(0, cor(mq([58, 104, 178]))); azulCx.addColorStop(1, cor(mq([34, 72, 138])));
  c.fillStyle = azulCx;
  c.fillRect(j.caixaX, j.y, j.caixaW, j.h);
  c.fillStyle = cor(SCH.AMARELO);
  c.fillRect(j.caixaX + j.caixaW * 0.55, j.y + j.h * 0.12, j.caixaW * 0.32, j.h * 0.42);
  c.fillStyle = 'rgb(28,30,34)';
  c.fillRect(j.caixaX + j.caixaW * 0.12, j.y + j.h * 0.62, j.caixaW * 0.4, j.h * 0.28);
  c.strokeStyle = 'rgb(28,30,34)'; c.lineWidth = Math.max(1.5, 0.025 * M); c.lineCap = 'round';
  c.beginPath(); c.moveTo(j.caixaX + j.caixaW * 0.7, j.y); c.lineTo(j.caixaX + j.caixaW * 0.7, j.y - 0.1 * M); c.lineTo(j.caixaX + j.caixaW * 0.15, j.y - 0.2 * M); c.stroke();
  c.fillStyle = 'rgb(200,50,40)';
  c.beginPath(); c.arc(j.caixaX + j.caixaW * 0.25, j.y - 0.04 * M, 0.035 * M, 0, 6.283); c.fill();
  c.strokeStyle = 'rgb(28,30,34)';
  c.beginPath(); c.moveTo(j.caixaX + j.caixaW * 0.25, j.y - 0.01 * M); c.lineTo(j.caixaX + j.caixaW * 0.25, j.y); c.stroke();
  // abertura (escura) com a moldura creme e as dobradiças da grade em cima
  c.fillStyle = 'rgb(20,22,26)';
  c.fillRect(j.abX, j.y, j.abW, j.h);
  c.strokeStyle = cor(mq([214, 204, 176])); c.lineWidth = Math.max(2, 0.03 * M);
  c.strokeRect(j.abX, j.y, j.abW, j.h);
  c.fillStyle = 'rgb(40,42,46)';
  c.fillRect(j.abX + j.abW * 0.1, j.y - 0.03 * M, j.abW * 0.18, 0.045 * M);
  c.fillRect(j.abX + j.abW * 0.72, j.y - 0.03 * M, j.abW * 0.18, 0.045 * M);
}

/** Posição da janelinha de visita na porta (em relação ao canto da porta). */
function JANELINHA(M: number) {
  return { caixaX: 0.2 * M, caixaW: 0.24 * M, abX: 0.48 * M, abW: 0.32 * M, y: 0.55 * M, h: 0.5 * M };
}

interface PoseSoldador {
  sx: number; piso: number; Hs: number; t: number; mq: (c: RGB) => RGB; parado: boolean;
  /** andando (0 parado, 1 andando) e a fase do passo */
  anda: number; passo: number;
  /** onde a mão da frente vai (grade ou botão) e quanto (0 a 1) */
  alvo: [number, number] | null; alcance: number;
  protege: number; confere: number;
}

/** Dois segmentos (ombro, cotovelo, mão): devolve o cotovelo, dobrando para baixo. */
function cotovelo(ax: number, ay: number, bx: number, by: number, l1: number, l2: number, lado: number): [number, number] {
  const dx = bx - ax, dy = by - ay;
  const d = Math.min(l1 + l2 - 0.001, Math.max(Math.abs(l1 - l2) + 0.001, Math.hypot(dx, dy)));
  const a = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const base = Math.atan2(dy, dx);
  return [ax + Math.cos(base + a * lado) * l1, ay + Math.sin(base + a * lado) * l1];
}

/**
 * O soldador, de lado, olhando para a máquina (à esquerda): capacete branco com abafador e óculos, uniforme
 * azul-marinho com "rumo" nas costas e faixas refletivas. Anda até a grade e até o painel, desce e sobe a grade
 * na mão, aperta o botão, vira o rosto no centelhamento e se inclina para conferir a emenda.
 * Parado, respira e troca o peso de perna.
 */
function desenharSoldador(ctx: CanvasRenderingContext2D, p: PoseSoldador) {
  const { sx, piso, Hs, t, mq } = p;
  const azul = cor(mq([30, 40, 86])), azulSombra = cor(mq([20, 27, 60]));
  const faixa = cor(mq([196, 226, 72])), prata = 'rgba(214,220,226,.95)';
  const pele = cor(mq([176, 128, 98])), bota = 'rgb(26,26,28)';
  const vivo = p.parado ? 0 : 1;
  const peso = Math.sin(t * 0.42) * vivo * (1 - p.anda);
  const respira = Math.sin(t * 1.7) * Hs * 0.004 * vivo;
  const passada = Math.sin(p.passo) * p.anda; // -1 a 1: uma perna à frente, depois a outra
  const sobe = Math.abs(Math.cos(p.passo)) * p.anda * Hs * 0.012; // o corpo sobe um pouco a cada passo
  // alvo baixo (grade embaixo) faz ele se curvar; conferir também
  const abaixa = p.alvo && p.alcance > 0 ? Math.max(0, Math.min(1, (p.alvo[1] - (piso - Hs * 0.62)) / (Hs * 0.3))) * p.alcance : 0;
  const curva = Math.max(p.confere, abaixa * 0.9);
  const incl = -0.24 * curva + 0.07 * p.protege;
  const quadril: [number, number] = [sx + peso * Hs * 0.014 - curva * Hs * 0.03, piso - Hs * 0.52 + Math.abs(peso) * Hs * 0.004 + curva * Hs * 0.035 - sobe];
  const ombro: [number, number] = [quadril[0] + Math.sin(incl) * Hs * 0.3, quadril[1] - Math.cos(incl) * Hs * 0.3 + respira];
  const cabeca: [number, number] = [ombro[0] + Math.sin(incl) * Hs * 0.11 + p.protege * Hs * 0.035, ombro[1] - Hs * 0.115];
  const peFrente: [number, number] = [sx - Hs * 0.07 - passada * Hs * 0.13, piso - Math.max(0, -Math.cos(p.passo)) * p.anda * Hs * 0.03];
  const peTras: [number, number] = [sx + Hs * 0.06 + passada * Hs * 0.13, piso - Math.max(0, Math.cos(p.passo)) * p.anda * Hs * 0.03];
  const membro = (pts: [number, number][], largura: number, c: string) => {
    ctx.strokeStyle = c; ctx.lineWidth = largura; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };
  const faixaEm = (a: [number, number], b: [number, number], f: number, largura: number) => {
    const x = mix(a[0], b[0], f), y = mix(a[1], b[1], f);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
    const dx = Math.cos(ang) * largura / 2, dy = Math.sin(ang) * largura / 2;
    membro([[x - dx, y - dy], [x + dx, y + dy]], Hs * 0.022, faixa);
    membro([[x - dx * 0.92, y - dy * 0.92], [x + dx * 0.92, y + dy * 0.92]], Hs * 0.006, prata);
  };
  const L1 = Hs * 0.17, L2 = Hs * 0.17, perna = Hs * 0.255;
  const botaEm = (pe: [number, number], c: string) => {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.roundRect(pe[0] - Hs * 0.075, pe[1] - Hs * 0.048, Hs * 0.12, Hs * 0.048, Hs * 0.016); ctx.fill();
  };

  // braço de trás: balança ao andar, sobe para proteger o rosto no centelhamento
  const ombroTras: [number, number] = [ombro[0] + Hs * 0.03, ombro[1] + Hs * 0.01];
  const maoTrasLivre: [number, number] = [ombroTras[0] + Hs * 0.02 + passada * Hs * 0.1, ombroTras[1] + Hs * 0.3];
  const maoTrasRosto: [number, number] = [cabeca[0] - Hs * 0.09, cabeca[1] + Hs * 0.02];
  const maoTras: [number, number] = [mix(maoTrasLivre[0], maoTrasRosto[0], p.protege), mix(maoTrasLivre[1], maoTrasRosto[1], p.protege)];
  const cotTras = cotovelo(ombroTras[0], ombroTras[1], maoTras[0], maoTras[1], L1, L2, p.protege > 0.5 ? 1 : -1);
  membro([ombroTras, cotTras, maoTras], Hs * 0.07, azulSombra);
  // perna de trás
  const qT: [number, number] = [quadril[0] + Hs * 0.02, quadril[1]];
  const tornT: [number, number] = [peTras[0], peTras[1] - Hs * 0.03];
  membro([qT, cotovelo(qT[0], qT[1], tornT[0], tornT[1], perna, perna, -1), tornT], Hs * 0.085, azulSombra);
  botaEm(peTras, bota);
  // perna da frente
  const qF: [number, number] = [quadril[0] - Hs * 0.02, quadril[1]];
  const tornF: [number, number] = [peFrente[0], peFrente[1] - Hs * 0.03];
  const joelho = cotovelo(qF[0], qF[1], tornF[0], tornF[1], perna * (1 + 0.01 * peso), perna, -1);
  membro([qF, joelho, tornF], Hs * 0.088, azul);
  faixaEm(joelho, tornF, 0.55, Hs * 0.088);
  botaEm(peFrente, bota);

  // tronco, com as alças cinza e "rumo" nas costas
  membro([[quadril[0], quadril[1] - Hs * 0.02], [ombro[0], ombro[1] + Hs * 0.03]], Hs * 0.2, azul);
  const meioT: [number, number] = [(quadril[0] + ombro[0]) / 2, (quadril[1] + ombro[1]) / 2];
  ctx.save();
  ctx.translate(meioT[0], meioT[1]);
  ctx.rotate(incl);
  ctx.strokeStyle = prata; ctx.lineWidth = Hs * 0.012;
  ctx.beginPath(); ctx.moveTo(-Hs * 0.06, -Hs * 0.12); ctx.lineTo(Hs * 0.08, Hs * 0.02); ctx.stroke();
  ctx.fillStyle = faixa;
  ctx.fillRect(-Hs * 0.1, Hs * 0.05, Hs * 0.2, Hs * 0.024);
  ctx.fillStyle = prata;
  ctx.fillRect(-Hs * 0.1, Hs * 0.059, Hs * 0.2, Hs * 0.006);
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.font = `700 ${Math.max(6, Math.round(Hs * 0.05))}px ${fonte('--font-barlow', '"Barlow", Arial, sans-serif')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('rumo', Hs * 0.02, -Hs * 0.04);
  ctx.textAlign = 'left';
  ctx.restore();

  // cabeça: rosto, óculos, capacete branco com aba e o abafador cinza
  membro([[ombro[0], ombro[1] - Hs * 0.01], [cabeca[0], cabeca[1] + Hs * 0.04]], Hs * 0.05, pele);
  ctx.fillStyle = pele;
  ctx.beginPath(); ctx.arc(cabeca[0], cabeca[1], Hs * 0.058, 0, 6.283); ctx.fill();
  ctx.fillStyle = 'rgba(30,40,50,.85)';
  ctx.fillRect(cabeca[0] - Hs * 0.062, cabeca[1] - Hs * 0.012, Hs * 0.04, Hs * 0.018);
  ctx.fillStyle = 'rgb(242,244,246)';
  ctx.beginPath(); ctx.ellipse(cabeca[0] + Hs * 0.005, cabeca[1] - Hs * 0.028, Hs * 0.07, Hs * 0.055, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(cabeca[0] - Hs * 0.09, cabeca[1] - Hs * 0.03, Hs * 0.15, Hs * 0.012);
  ctx.fillStyle = cor(mq([92, 96, 104]));
  ctx.beginPath(); ctx.ellipse(cabeca[0] + Hs * 0.025, cabeca[1] + Hs * 0.004, Hs * 0.02, Hs * 0.03, 0, 0, 6.283); ctx.fill();

  // braço da frente: solto (balançando ao andar) ou indo até a grade / o botão
  const maoLivre: [number, number] = [ombro[0] - Hs * 0.04 - passada * Hs * 0.1, ombro[1] + Hs * 0.31];
  const alvo = p.alvo ?? maoLivre;
  const mao: [number, number] = [mix(maoLivre[0], alvo[0], p.alcance), mix(maoLivre[1], alvo[1], p.alcance)];
  const cot = cotovelo(ombro[0], ombro[1] + Hs * 0.01, mao[0], mao[1], L1, L2, -1);
  membro([[ombro[0], ombro[1] + Hs * 0.01], cot, mao], Hs * 0.072, azul);
  faixaEm([ombro[0], ombro[1]], cot, 0.6, Hs * 0.072);
  ctx.fillStyle = 'rgb(36,36,40)'; // luva
  ctx.beginPath(); ctx.arc(mao[0], mao[1], Hs * 0.03, 0, 6.283); ctx.fill();
}

// ---------- início: o TLS saindo do estaleiro ----------

/**
 * O trilho longo atravessa a parte de baixo da tela, de lado e um pouco visto de cima, deslizando sobre roletes.
 * A cada barra, ele para no meio, a emenda é soldada (clarão e faíscas) e segue andando enquanto a solda esfria:
 * branca, amarela, laranja, vermelha e depois aço. Atrás, o galpão do estaleiro: colunas, luminárias que acendem
 * uma a uma na abertura, fachos de luz, brasas subindo e o clarão de outra estação soldando ao fundo.
 */
function iniciarInicio(cv: HTMLCanvasElement, intro: 'auto' | 'completa') {
  const caixa = cv.parentElement ?? cv;
  let pal = paletaAbertura(caixa);
  let completa = intro === 'completa';
  try {
    if (intro === 'auto') completa = !sessionStorage.getItem(CHAVE_INTRO);
    sessionStorage.setItem(CHAVE_INTRO, '1');
  } catch {
    /* sem armazenamento: abertura curta */
  }
  const parado = reduzirMovimento();
  // A primeira emenda chega na Schlatter em CHEGA; o centelhamento passa por SOLDA, junto com a emenda do logo.
  const CHEGA = 0.55, SOLDA = 1.25;
  // Ciclo da Schlatter (s desde a chegada da emenda): garras descem, centelhamento, recalque, rebarbação, garras sobem.
  // Ciclo da Schlatter (s desde a chegada da emenda), como na máquina de verdade:
  // o soldador desce a grade na mão, se afasta e aperta o botão; a porta fecha sozinha (hidráulico, da direita para a
  // esquerda); as garras descem, centelha, recalca, rebarba; as garras sobem, a porta abre sozinha; ele volta, sobe a
  // grade e confere a emenda.
  const F = {
    grade: 0.9, vai: 1.8, botao: 2.0, fecha: 2.8, garraIni: 2.8, garra: 3.1, centelha: 4.5, recalque: 4.7, rebarba: 5.1,
    sobe: 5.4, abre: 6.2, volta: 7.0, sobeGrade: 7.6, solta: 7.8, confere: 8.6,
  };
  let ciclo: { k: number; inicio: number } | null = null;
  let ultimoInicio = -99; // começo do último ciclo da Schlatter (para o soldador terminar os gestos)
  const fumaca: { x: number; y: number; r: number; v: number }[] = [];
  let frente: HTMLCanvasElement | null = null; // frente da máquina desenhada uma vez e reaproveitada
  let chaveFrente = '';
  let portaCache: HTMLCanvasElement | null = null;
  let chavePortaCache = '';
  const faiscas: Faisca[] = [];
  const brasas: { x: number; y: number; vy: number; vx: number; v: number }[] = [];
  let soldouLogo = false;

  // Emendas: k = 0 é a que chega no meio na abertura. Guarda quando cada uma foi soldada (s).
  const soldada = new Map<number, number>();
  if (!completa) for (let k = -6; k < 0; k++) soldada.set(k, -60);
  if (reduzirMovimento()) for (let k = -6; k <= 6; k++) soldada.set(k, -60);
  let u = 0; // quanto o trilho andou desde que a emenda 0 ficou no meio (px)
  let vel = 0;
  let proxima = 0; // próxima emenda a soldar
  let ultimoT = 0;

  // Textura do aço (pontinhos e manchas), desenhada uma vez e repetida.
  const tex = document.createElement('canvas');
  tex.width = 256; tex.height = 64;
  const tc = tex.getContext('2d');
  if (tc) {
    let sem = 3;
    const r = () => (sem = (sem * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 520; i++) {
      tc.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.08})` : `rgba(0,0,0,${0.08 + r() * 0.12})`;
      tc.fillRect(r() * 256, r() * 64, 1 + r() * 2, 1);
    }
    for (let i = 0; i < 14; i++) {
      tc.fillStyle = `rgba(120,70,40,${0.05 + r() * 0.06})`;
      tc.beginPath(); tc.ellipse(r() * 256, r() * 64, 6 + r() * 14, 2 + r() * 4, 0, 0, 6.283); tc.fill();
    }
  }
  let padrao: CanvasPattern | null = null;

  /** Cor da solda pela idade (s): branco, amarelo, laranja, vermelho, e então some (fica o aço). */
  const calor = (idade: number): { c: RGB; a: number } => {
    if (idade < 0) return { c: [255, 255, 255], a: 0 };
    const pontos: [number, RGB][] = [[0, [255, 255, 245]], [0.35, [255, 236, 170]], [1.4, [255, 170, 70]], [3.2, [232, 84, 28]], [6.5, [150, 30, 14]], [11, [90, 20, 10]]];
    for (let i = 0; i < pontos.length - 1; i++) {
      const [t0, c0] = pontos[i], [t1, c1] = pontos[i + 1];
      if (idade <= t1) return { c: misturar(c0, c1, (idade - t0) / (t1 - t0)), a: 1 - suave(6.5, 11, idade) * 0.999 };
    }
    return { c: [90, 20, 10], a: 0 };
  };


  const controle = laco(cv, 2, () => { pal = paletaAbertura(caixa); padrao = null; }, (ctx, W, H, t, dt) => {
    const escuro = pal.estrelas > 0;
    const xc = W / 2;
    // Escala de verdade: a máquina (2,6 m de altura) ocupa cerca de 30% da altura da tela; o soldador tem 1,75 m.
    // O perfil (TR68, 186 mm) sai só um pouco maior que o real (23 cm), para continuar lendo como trilho.
    // No celular a máquina fica menor e embaixo de tudo (a tela inicial e o login reservam esse espaço no CSS).
    const M = W < 600 ? Math.max(34, Math.min(50, W / 9)) : Math.max(40, Math.min(H * 0.115, W / 11)); // um metro
    const R = 0.23 * M; // altura do perfil
    const L = 12 * M; // uma barra de 12 m
    const piso = H * 0.95;
    const topo = piso - 0.85 * M; // o trilho corre a 85 cm do chão, sobre os roletes
    const rr = 0.1 * M; // rolete de 20 cm

    // Schlatter à direita no computador (fora dos cartões); no celular, mais para a direita também.
    const xm = W >= 900 ? W * 0.74 : W * 0.58;

    // ---------- movimento do trilho e ciclo da solda ----------
    if (parado) {
      u = L * 0.35; vel = 0;
    } else if (t < CHEGA) {
      // abertura: o trilho entra pela direita e freia com a emenda 0 dentro da máquina
      const D = completa ? W * 0.95 : W * 0.35;
      const e = 1 - Math.pow(1 - t / CHEGA, 3);
      u = -D * (1 - e);
      vel = 0;
      if (!ciclo) ciclo = { k: 0, inicio: SOLDA - (F.garra + 0.15) };
    } else if (ciclo && t - ciclo.inicio < F.solta) {
      vel = 0;
      u = ciclo.k * L;
    } else {
      if (ciclo) { proxima = ciclo.k + 1; ciclo = null; }
      vel = mix(vel, 1.1 * M, 1 - Math.pow(0.05, dt)); // cerca de 1 m/s
      const antes = u;
      u += vel * dt;
      const alvo = proxima * L;
      if (antes < alvo && u >= alvo) { u = alvo; vel = 0; ciclo = { k: proxima, inicio: t }; }
    }
    if (ciclo) ultimoInicio = ciclo.inicio;
    const fase = ciclo ? t - ciclo.inicio : 99;
    if (ciclo && fase >= F.centelha && !soldada.has(ciclo.k)) soldada.set(ciclo.k, ciclo.inicio + F.centelha);
    // centelhamento: chuva de faíscas saindo da fresta para os dois lados
    const centelhando = !parado && ciclo !== null && fase > F.garra && fase < F.centelha;
    const forcaCentelha = centelhando ? suave(F.garra, F.garra + 0.3, fase) * (0.75 + 0.25 * Math.sin(t * 40)) : 0;
    if (centelhando) {
      // a porta está fechada: as faíscas só escapam pelas frestas de baixo e da borda esquerda
      const n = Math.round(70 * dt * forcaCentelha + Math.random() * 0.6);
      const mWL = xm - 0.6 * M, mWB = topo + R + 0.2 * M, mWT = topo - 0.45 * M;
      for (let i = 0; i < n; i++) {
        if (Math.random() < 0.6) {
          faiscas.push({ x: mWL + Math.random() * 1.2 * M, y: mWB, vx: (Math.random() - 0.5) * 160, vy: 30 + Math.random() * 80, v: 0.25 + Math.random() * 0.35 });
        } else {
          faiscas.push({ x: mWL - 1, y: mWT + Math.random() * (mWB - mWT), vx: -(80 + Math.random() * 260), vy: -(20 + Math.random() * 160), v: 0.25 + Math.random() * 0.4 });
        }
      }
    }
    // garras: 0 em cima, 1 apertando o trilho
    const garra = !ciclo ? 0 : fase < F.garra ? suave(F.garraIni, F.garra, fase) : fase < F.rebarba ? 1 : 1 - suave(F.rebarba, F.sobe, fase);
    ultimoT = t;

    // ---------- galpão ao fundo ----------
    const fundo = ctx.createLinearGradient(0, 0, 0, H);
    fundo.addColorStop(0, cor(pal.ceuTopo));
    fundo.addColorStop(0.75, cor(pal.ceuHorizonte));
    fundo.addColorStop(1, cor(pal.ceuTopo));
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, W, H);

    // colunas e tesouras do telhado (andam devagar, parallax)
    const par = (u * 0.12) % (W / 5);
    const corColuna = escuro ? misturar(pal.neblina, pal.ceuTopo, 0.3) : misturar(pal.poste, pal.ceuHorizonte, 0.55);
    for (let x = -par - W / 5; x < W + W / 5; x += W / 5) {
      const perto = Math.min(1, Math.abs(x - xc) / (W * 0.36)); // mais apagado atrás dos cartões
      const a = (escuro ? 0.55 : 0.4) * perto;
      ctx.fillStyle = cor(corColuna, a);
      ctx.fillRect(x - 7, H * 0.06, 14, piso - H * 0.06);
      ctx.strokeStyle = cor(corColuna, a * 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, H * 0.06); ctx.lineTo(x + W / 10, H * 0.015); ctx.lineTo(x + W / 5, H * 0.06);
      ctx.moveTo(x, H * 0.06); ctx.lineTo(x + W / 5, H * 0.06);
      ctx.stroke();
    }

    // luminárias do galpão: acendem uma a uma na abertura, com fachos de luz
    const nLamp = W < 640 ? 4 : 6;
    for (let i = 0; i < nLamp; i++) {
      const lx = (W / nLamp) * (i + 0.5);
      const ly = H * 0.085;
      const liga = parado ? 1 : suave(0.15 + i * 0.12, 0.35 + i * 0.12, t * (completa ? 1 : 3));
      const tremula = 0.94 + 0.06 * Math.sin(t * 7 + i * 2.1);
      const a = liga * tremula;
      ctx.strokeStyle = cor(corColuna, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly - 6); ctx.stroke();
      ctx.fillStyle = cor(corColuna, 0.9);
      ctx.beginPath(); ctx.moveTo(lx - 14, ly); ctx.lineTo(lx - 6, ly - 7); ctx.lineTo(lx + 6, ly - 7); ctx.lineTo(lx + 14, ly); ctx.closePath(); ctx.fill();
      // facho
      const facho = ctx.createLinearGradient(0, ly, 0, piso);
      facho.addColorStop(0, cor(pal.farol, (escuro ? 0.1 : 0.07) * a));
      facho.addColorStop(1, cor(pal.farol, 0));
      ctx.fillStyle = facho;
      ctx.beginPath(); ctx.moveTo(lx - 13, ly); ctx.lineTo(lx + 13, ly); ctx.lineTo(lx + W * 0.11, piso); ctx.lineTo(lx - W * 0.11, piso); ctx.closePath(); ctx.fill();
      const g = ctx.createRadialGradient(lx, ly + 2, 0, lx, ly + 2, 40);
      g.addColorStop(0, cor(pal.farol, 0.9 * a)); g.addColorStop(1, cor(pal.farol, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly + 2, 40, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(255,250,235,${0.95 * a})`;
      ctx.fillRect(lx - 9, ly - 1, 18, 2.5);
    }

    // telha translúcida no telhado: deixa entrar a luz do dia conforme a hora de verdade
    const agora = new Date();
    const hora = agora.getHours() + agora.getMinutes() / 60;
    const dia = Math.max(0, Math.sin(((hora - 6) / 12.5) * Math.PI));
    {
      const yT = H * 0.028, hT = Math.max(5, H * 0.014);
      ctx.fillStyle = cor(misturar(pal.ceuTopo, [255, 246, 220], 0.15 + 0.6 * dia), 0.55 + 0.35 * dia);
      ctx.fillRect(0, yT, W, hT);
      if (dia > 0.05) {
        for (let i = 0; i < 5; i++) {
          const x0 = W * (0.08 + i * 0.21) + Math.sin(i * 1.7) * W * 0.03;
          const raio = ctx.createLinearGradient(0, yT, 0, piso);
          raio.addColorStop(0, `rgba(255,246,220,${0.07 * dia})`);
          raio.addColorStop(1, 'rgba(255,246,220,0)');
          ctx.fillStyle = raio;
          ctx.beginPath(); ctx.moveTo(x0, yT + hT); ctx.lineTo(x0 + W * 0.05, yT + hT); ctx.lineTo(x0 + W * 0.13, piso); ctx.lineTo(x0 + W * 0.06, piso); ctx.closePath(); ctx.fill();
        }
      }
    }
    // pilha de barras novas esperando no fundo, à esquerda, separadas por calços de madeira
    {
      const camadas = W < 600 ? 3 : 4;
      const pL = W * 0.02, pR = W < 600 ? W * 0.36 : W * 0.3;
      const hb = Math.max(4, 0.16 * M), calco = Math.max(2, 0.06 * M);
      const corBarra = misturar(pal.acoLado, pal.ceuHorizonte, 0.45), corCalco = misturar([120, 80, 50], pal.ceuHorizonte, 0.5);
      for (let i = 0; i < camadas; i++) {
        const yb = piso - (i + 1) * (hb + calco);
        ctx.fillStyle = cor(corCalco, 0.8);
        for (let x = pL + 0.3 * M; x < pR; x += 1.6 * M) ctx.fillRect(x, yb + hb, 0.12 * M, calco);
        const gb = ctx.createLinearGradient(0, yb, 0, yb + hb);
        gb.addColorStop(0, cor(misturar(corBarra, [255, 255, 255], 0.25), 0.85));
        gb.addColorStop(1, cor(misturar(corBarra, pal.ceuTopo, 0.35), 0.85));
        ctx.fillStyle = gb;
        ctx.fillRect(pL + i * 0.08 * M, yb, pR - pL - i * 0.16 * M, hb);
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        for (let x = pL + 0.9 * M; x < pR - 0.5 * M; x += 2.3 * M) ctx.fillRect(x, yb, 1, hb);
      }
    }

    // outra estação soldando lá no fundo: um clarão que pisca de vez em quando
    const pisca = Math.max(0, Math.sin(t * 13) * Math.sin(t * 2.3) * Math.sin(t * 0.7 + 1));
    if (!parado && pisca > 0.2) {
      const fx = W * 0.16, fy = piso - R * 0.9;
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, R * 1.6);
      g.addColorStop(0, `rgba(255,190,110,${0.28 * pisca})`); g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, R * 1.6, 0, 6.283); ctx.fill();
    }

    // piso do estaleiro
    const chao = ctx.createLinearGradient(0, piso, 0, H);
    chao.addColorStop(0, cor(misturar(pal.brita, pal.ceuTopo, 0.25)));
    chao.addColorStop(1, cor(pal.ceuTopo));
    ctx.fillStyle = chao;
    ctx.fillRect(0, piso, W, H - piso);
    ctx.fillStyle = cor(pal.aco, escuro ? 0.06 : 0.25);
    ctx.fillRect(0, piso, W, 1);
    {
      const escMaq = (c: RGB): RGB => (escuro ? misturar(c, pal.ceuTopo, 0.35) : c);
      const cL = Math.max(0, xm - 2.2 * M), cR = Math.min(W, xm + 3.0 * M), hc = H - piso;
      ctx.fillStyle = cor(escMaq([150, 48, 40]));
      ctx.fillRect(cL, piso, cR - cL, hc);
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const passo = Math.max(5, 0.09 * M);
      for (let y = piso + passo / 2, i = 0; y < H; y += passo, i++) {
        for (let x = cL + (i % 2) * passo / 2; x < cR; x += passo) { ctx.moveTo(x - passo * 0.18, y + passo * 0.1); ctx.lineTo(x + passo * 0.18, y - passo * 0.1); }
      }
      ctx.stroke();
      ctx.fillStyle = cor(escMaq([235, 190, 40]));
      ctx.fillRect(cL, piso, cR - cL, Math.max(2, 0.04 * M));
      ctx.fillRect(cR - Math.max(2, 0.04 * M), piso, Math.max(2, 0.04 * M), hc);
      ctx.fillStyle = cor(escMaq([40, 120, 80]), 0.85);
      ctx.fillRect(Math.max(0, cL - 3.2 * M), piso + hc * 0.35, Math.min(cL, 3.0 * M), hc * 0.65);
    }

    // ---------- Schlatter: medidas e o interior escuro que aparece pela janela ----------
    const mq = (c: RGB): RGB => (escuro ? misturar(c, pal.ceuTopo, 0.3) : c);
    const mL = xm - 1.8 * M, mR = xm + 1.8 * M, mT = piso - 2.6 * M; // a máquina tem 3,6 m de largura e 2,6 m de altura
    const wL = xm - 0.6 * M, wR = xm + 0.6 * M, wT = topo - 0.45 * M, wB = topo + R + 0.2 * M;
    ctx.fillStyle = 'rgb(22,24,28)';
    ctx.fillRect(wL, wT, wR - wL, wB - wT);
    if (forcaCentelha > 0) {
      const g = ctx.createRadialGradient(xm, topo + R * 0.4, 0, xm, topo + R * 0.4, 0.9 * M);
      g.addColorStop(0, `rgba(255,200,120,${0.55 * forcaCentelha})`); g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g; ctx.fillRect(wL, wT, wR - wL, wB - wT);
    }

    // ---------- roletes ----------
    const esp = 2.5 * M; // roletes a cada 2,5 m
    const yRol = topo + R + rr;
    for (let x = (xc % esp) - esp; x < W + esp; x += esp) {
      // pé do rolete
      ctx.fillStyle = cor(misturar(pal.acoLado, pal.ceuTopo, 0.55));
      ctx.beginPath(); ctx.moveTo(x - rr * 0.5, yRol); ctx.lineTo(x + rr * 0.5, yRol); ctx.lineTo(x + rr * 1.3, piso); ctx.lineTo(x - rr * 1.3, piso); ctx.closePath(); ctx.fill();
      // rolete com reflexo e marcas que giram
      const g = ctx.createRadialGradient(x - rr * 0.3, yRol - rr * 0.4, rr * 0.1, x, yRol, rr);
      g.addColorStop(0, cor(pal.aco)); g.addColorStop(1, cor(misturar(pal.acoLado, pal.ceuTopo, 0.3)));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, yRol, rr, 0, 6.283); ctx.fill();
      const ang = -u / rr;
      ctx.strokeStyle = cor(misturar(pal.acoLado, [0, 0, 0], 0.55), 0.7);
      ctx.lineWidth = Math.max(1, rr * 0.12);
      for (let k = 0; k < 3; k++) {
        const a = ang + (k * 2 * Math.PI) / 3;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * rr * 0.25, yRol + Math.sin(a) * rr * 0.25); ctx.lineTo(x + Math.cos(a) * rr * 0.8, yRol + Math.sin(a) * rr * 0.8); ctx.stroke();
      }
      ctx.fillStyle = cor(misturar(pal.acoLado, [0, 0, 0], 0.6), 0.8);
      ctx.beginPath(); ctx.arc(x, yRol, rr * 0.18, 0, 6.283); ctx.fill();
    }

    // ---------- o trilho (perfil de lado, um pouco visto de cima) ----------
    const escuroAco = misturar(pal.acoLado, pal.ceuTopo, 0.62);
    const faixas: { y0: number; y1: number; topo: RGB; base: RGB }[] = [
      { y0: -0.06, y1: 0.0, topo: misturar(pal.aco, pal.acoLado, 0.15), base: pal.aco }, // superfície de rolamento, polida
      { y0: 0.0, y1: 0.25, topo: misturar(pal.aco, pal.acoLado, 0.45), base: misturar(pal.acoLado, pal.ceuTopo, 0.2) }, // lateral do boleto
      { y0: 0.25, y1: 0.31, topo: misturar(pal.acoLado, pal.ceuTopo, 0.3), base: escuroAco }, // concordância, entrando na sombra
      { y0: 0.31, y1: 0.76, topo: escuroAco, base: misturar(pal.acoLado, pal.ceuTopo, 0.42) }, // alma, recuada na sombra do boleto
      { y0: 0.76, y1: 0.85, topo: misturar(pal.acoLado, pal.ceuTopo, 0.3), base: misturar(pal.aco, pal.acoLado, 0.45) }, // rampa do patim, pegando a luz
      { y0: 0.85, y1: 1.0, topo: misturar(pal.acoLado, pal.ceuTopo, 0.15), base: misturar(pal.acoLado, pal.ceuTopo, 0.55) }, // borda do patim
    ];
    // sombra no piso
    const sombra = ctx.createLinearGradient(0, piso, 0, piso + R * 0.5);
    sombra.addColorStop(0, 'rgba(0,0,0,.35)'); sombra.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sombra; ctx.fillRect(0, piso, W, R * 0.5);
    for (const f of faixas) {
      const y0 = topo + f.y0 * R, y1 = topo + f.y1 * R;
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, cor(f.topo)); g.addColorStop(1, cor(f.base));
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, W, y1 - y0 + 0.5);
    }
    // fios de luz nas arestas (boleto e patim) e a sombra do boleto caindo na alma
    ctx.fillStyle = `rgba(255,255,255,${escuro ? 0.55 : 0.8})`;
    ctx.fillRect(0, topo - R * 0.06, W, 1.2);
    ctx.fillStyle = `rgba(255,255,255,${escuro ? 0.22 : 0.4})`;
    ctx.fillRect(0, topo + R * 0.765, W, 1);
    const somb = ctx.createLinearGradient(0, topo + R * 0.29, 0, topo + R * 0.42);
    somb.addColorStop(0, 'rgba(0,0,0,.35)'); somb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = somb; ctx.fillRect(0, topo + R * 0.29, W, R * 0.13);
    // textura do aço andando com o trilho
    if (!padrao) padrao = ctx.createPattern(tex, 'repeat');
    if (padrao) {
      ctx.save();
      ctx.translate(-(u % 256), topo - R * 0.07);
      ctx.fillStyle = padrao;
      ctx.globalAlpha = escuro ? 0.9 : 0.55;
      ctx.fillRect(0, 0, W + 256, R * 1.07);
      ctx.restore();
    }
    // brilho que corre na lateral do boleto
    const pos = ((t * 0.05) % 1.6) - 0.3;
    const brilho = ctx.createLinearGradient(0, 0, W, 0);
    brilho.addColorStop(0, 'rgba(255,255,255,0)');
    brilho.addColorStop(Math.min(1, Math.max(0, pos)), 'rgba(255,255,255,0)');
    brilho.addColorStop(Math.min(1, Math.max(0, pos + 0.12)), `rgba(255,255,255,${escuro ? 0.22 : 0.35})`);
    brilho.addColorStop(Math.min(1, Math.max(0, pos + 0.24)), 'rgba(255,255,255,0)');
    brilho.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = brilho;
    ctx.fillRect(0, topo + R * 0.04, W, R * 0.05);
    ctx.fillRect(0, topo + R * 0.79, W, R * 0.03);

    // emendas e marcas de giz
    const kMin = Math.floor((u - xm) / L) - 1, kMax = Math.ceil((u + W - xm) / L) + 1;
    ctx.font = `600 ${Math.round(Math.max(9, R * 0.42))}px ${fonte('--font-barlow-cond', '"Barlow Condensed", "Arial Narrow", sans-serif')}`;
    ctx.textBaseline = 'middle';
    for (let k = kMin; k <= kMax; k++) {
      const x = xm + k * L - u;
      // giz no meio da barra
      const xg = x + L / 2;
      if (xg > -100 && xg < W + 100) {
        ctx.fillStyle = `rgba(255,255,255,${escuro ? 0.32 : 0.6})`;
        ctx.fillText(`TLS ${212 + Math.floor(k / 13)} · B${(((k % 13) + 13) % 13) + 1}`, xg - R * 1.2, topo + R * 0.55);
      }
      if (x < -R || x > W + R) continue;
      const quando = soldada.get(k);
      const naMaquina = ciclo !== null && ciclo.k === k;
      if (quando === undefined) {
        if (naMaquina && fase > F.garra) {
          // centelhamento: as pontas em brasa se aproximando, com a fresta brilhando
          const fecha = suave(F.garra, F.centelha, fase);
          const larg = mix(4, 1, fecha);
          const brilho = Math.min(1, forcaCentelha + 0.2);
          const g = ctx.createLinearGradient(x - 0.1 * M, 0, x + 0.1 * M, 0);
          g.addColorStop(0, 'rgba(255,120,40,0)');
          g.addColorStop(0.5, `rgba(255,200,110,${0.85 * brilho})`);
          g.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 0.1 * M, topo - R * 0.06, 0.2 * M, R * 1.06);
          ctx.fillStyle = `rgba(255,250,230,${brilho})`;
          ctx.fillRect(x - larg / 2, topo - R * 0.06, larg, R * 1.06);
        } else {
          // ainda não soldada: fresta entre as barras
          ctx.fillStyle = cor(pal.ceuTopo, 0.95);
          ctx.fillRect(x - 1.5, topo - R * 0.06, 3, R * 1.06);
        }
        continue;
      }
      const idade = ultimoT - quando;
      // rebordo do recalque: aparece na hora e a lâmina da rebarbação tira
      const rebordo = idade < F.recalque - F.centelha ? 1 : 1 - suave(F.recalque - F.centelha, F.rebarba - F.centelha, idade);
      // marca fina da emenda depois de rebarbada e esmerilhada
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.fillRect(x - 0.03 * M, topo - R * 0.06, 0.06 * M, R * 0.06);
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.fillRect(x - 0.75, topo, 1.5, R);
      const h = calor(idade);
      if (h.a > 0.01) {
        // zona quente espalhando pelo trilho dos dois lados da emenda
        const hw = M * (0.08 + 0.17 * Math.min(1, idade / 5)); // a zona quente vai se espalhando
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, topo + R * 0.45, 0, x, topo + R * 0.45, 0.7 * M);
        g.addColorStop(0, cor(h.c, 0.45 * h.a)); g.addColorStop(0.4, cor(h.c, 0.14 * h.a)); g.addColorStop(1, cor(h.c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, topo + R * 0.45, 0.7 * M, 0, 6.283); ctx.fill();
        const gp = ctx.createRadialGradient(x, piso + 2, 0, x, piso + 2, 0.5 * M);
        gp.addColorStop(0, cor(h.c, 0.3 * h.a)); gp.addColorStop(1, cor(h.c, 0));
        ctx.fillStyle = gp; ctx.fillRect(x - 0.5 * M, piso, M, 0.2 * M);
        ctx.restore();
        const zona = ctx.createLinearGradient(x - hw, 0, x + hw, 0);
        zona.addColorStop(0, cor(h.c, 0));
        zona.addColorStop(0.5, cor(misturar(h.c, [255, 255, 240], 0.25), 0.95 * h.a));
        zona.addColorStop(1, cor(h.c, 0));
        ctx.fillStyle = zona;
        ctx.fillRect(x - hw, topo - R * 0.06, hw * 2, R * 1.06);
        if (rebordo > 0.01) {
          ctx.fillStyle = cor(misturar(h.c, [255, 255, 235], 0.4), h.a);
          ctx.beginPath();
          ctx.roundRect(x - 0.03 * M, topo - R * 0.06 - 0.02 * M * rebordo, 0.06 * M, R * 1.06 + 0.04 * M * rebordo, 0.01 * M);
          ctx.fill();
        }
        // brasas subindo da solda quente
        if (!parado && h.a > 0.35 && Math.random() < dt * 14 * h.a) {
          brasas.push({ x: x + (Math.random() - 0.5) * R * 0.4, y: topo, vy: -(20 + Math.random() * 40), vx: (Math.random() - 0.5) * 14, v: 1 });
        }
      }
    }
    // brasas
    if (brasas.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of brasas) {
        b.x += (b.vx + Math.sin(b.y * 0.05) * 6 - vel) * dt; b.y += b.vy * dt; b.v -= dt * 0.45;
        ctx.fillStyle = `rgba(255,${(120 + 100 * b.v) | 0},60,${Math.max(0, b.v) * 0.9})`;
        ctx.beginPath(); ctx.arc(b.x, b.y, 1.4, 0, 6.283); ctx.fill();
      }
      ctx.restore();
      for (let i = brasas.length - 1; i >= 0; i--) if (brasas[i].v <= 0) brasas.splice(i, 1);
    }

    // ---------- Schlatter: garras, lâmina e a frente da máquina com a janela ----------
    {
      const aco = (c: number) => `rgb(${c},${c + 4},${c + 10})`;
      // garras de baixo (fixas, sob o patim) e de cima (descem até o boleto), com a ponta de cobre
      for (const [x0, x1] of [[xm - 0.5 * M, xm - 0.1 * M], [xm + 0.1 * M, xm + 0.5 * M]]) {
        ctx.fillStyle = aco(58);
        ctx.fillRect(x0, topo + R, x1 - x0, wB - topo - R);
        const fundoGarra = mix(topo - 0.3 * M, topo - M * 0.06, garra);
        ctx.fillStyle = aco(64);
        ctx.fillRect(x0, fundoGarra - 0.3 * M, x1 - x0, 0.3 * M);
        ctx.fillStyle = 'rgb(196,120,62)';
        ctx.fillRect(x0 + 1, fundoGarra - 0.035 * M, x1 - x0 - 2, 0.035 * M);
      }
      // lâmina da rebarbação passando pela emenda
      if (ciclo && fase > F.recalque && fase < F.rebarba) {
        const y = mix(topo - 0.3 * M, topo + M * 1.05, suave(F.recalque, F.rebarba, fase));
        ctx.fillStyle = aco(150);
        ctx.fillRect(xm - 0.1 * M, y - 0.05 * M, 0.2 * M, 0.05 * M);
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.fillRect(xm - 0.1 * M, y - 1, 0.2 * M, 1);
      }
      // frente da máquina: desenhada uma vez numa tela à parte (refeita se mudar o tamanho ou o tema)
      const estreito = W < 900;
      const geo: GeoMaquina = { M, mL, mR, mT, wL, wR, wT, wB, piso, estreito, mq };
      const dpr = cv.width / Math.max(1, W);
      const ox = mL - 0.3 * M, oy = mT - 1.75 * M, ow = mR - mL + 1.9 * M, oh = piso - oy + 2;
      const chave = `${Math.round(M * 10)}|${escuro}|${estreito}|${dpr}|${pal.ceuTopo.join(',')}`;
      if (!frente || chave !== chaveFrente) {
        frente = frente ?? document.createElement('canvas');
        frente.width = Math.ceil(ow * dpr);
        frente.height = Math.ceil(oh * dpr);
        const fc = frente.getContext('2d');
        if (fc) {
          fc.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr);
          fc.clearRect(ox, oy, ow, oh);
          desenharFrenteSchlatter(fc, geo);
        }
        chaveFrente = chave;
      }
      ctx.drawImage(frente, ox, oy, ow, oh);

      // posições do ciclo: grade (0 em cima, 1 embaixo), porta (0 aberta, 1 fechada) e o soldador
      const fu = parado ? 99 : t - ultimoInicio;
      const gradeDesce = suave(0.1, F.grade, fu) - suave(F.volta + 0.05, F.sobeGrade, fu);
      const portaFecha = suave(F.botao, F.fecha, fu) - suave(F.sobe, F.abre, fu);
      const soldando = fu >= F.botao && fu < F.sobe;

      // porta laranja: anda da direita (aberta) para a esquerda (fechada, sobre a janela), puxada pelo hidráulico
      const portaW = wR - wL, portaH = wB - mT;
      const chavePorta = `${chave}|porta`;
      if (!portaCache || chavePorta !== chavePortaCache) {
        portaCache = portaCache ?? document.createElement('canvas');
        portaCache.width = Math.ceil(portaW * dpr);
        portaCache.height = Math.ceil(portaH * dpr);
        const pc = portaCache.getContext('2d');
        if (pc) { pc.setTransform(dpr, 0, 0, dpr, 0, 0); pc.clearRect(0, 0, portaW, portaH); desenharPortaSchlatter(pc, M, portaW, portaH, mq); }
        chavePortaCache = chavePorta;
      }
      const portaX = mix(wR, wL, portaFecha);
      // haste cromada do hidráulico, do cilindro até a borda esquerda da porta
      ctx.fillStyle = 'rgb(210,214,220)';
      ctx.fillRect(wL - 0.02 * M, mT - 0.16 * M, portaX - wL + 0.04 * M, 0.04 * M);
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.fillRect(wL - 0.02 * M, mT - 0.16 * M, portaX - wL + 0.04 * M, 1);
      ctx.fillStyle = 'rgb(70,74,80)';
      ctx.fillRect(portaX - 0.02 * M, mT - 0.18 * M, 0.06 * M, 0.2 * M);
      ctx.drawImage(portaCache, portaX, mT, portaW, portaH);
      // com a porta fechada, a luz do centelhamento vaza pelas frestas
      if (forcaCentelha > 0 && portaFecha > 0.9) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,190,100,${0.85 * forcaCentelha})`;
        ctx.fillRect(portaX - 1.5, mT + 0.1 * M, 2, portaH - 0.15 * M);
        ctx.fillRect(portaX, wB - 1.5, portaW, 2.5);
        ctx.fillRect(portaX + portaW - 1, mT + 0.1 * M, 1.5, portaH - 0.15 * M);
        ctx.restore();
      }

      // grade de barras da janelinha: presa por dobradiça em cima. Fechada (gradeDesce = 1) fica na vertical e tampa tudo;
      // aberta (0) o soldador gira para cima e ela fica na horizontal, saindo da porta, vista de baixo como uma faixa fina
      const jn = JANELINHA(M);
      const abX = portaX + jn.abX, abY = mT + jn.y;
      // com a grade fechada e a máquina soldando, a luz laranja aparece entre as barras
      if (forcaCentelha > 0 && portaFecha > 0.9) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,170,80,${0.7 * forcaCentelha})`;
        ctx.fillRect(abX, abY, jn.abW, jn.h);
        ctx.restore();
      }
      // A grade é uma peça rígida: só muda o ângulo. Cada ponto dela (u de lado a lado, v da dobradiça até a beirada de baixo)
      // vai para fora conforme gira; vista de frente e um pouco de baixo, a beirada que vem para fora fica mais larga e mais baixa.
      // As barras e a moldura mantêm a espessura (não "esmaga" como sanfona).
      const giro = (1 - gradeDesce) * Math.PI / 2; // 0 em pé (fechada), 90° deitada para fora (aberta)
      const cg = Math.cos(giro), sg = Math.sin(giro);
      const pt = (u: number, v: number): [number, number] => {
        const larg = jn.abW * (1 + 0.16 * v * sg);
        return [abX + jn.abW / 2 + (u - 0.5) * larg, abY + v * jn.h * (cg + 0.24 * sg)];
      };
      const faixa = (v0: number, v1: number, u0 = 0, u1 = 1) => {
        const a1 = pt(u0, v0), a2 = pt(u1, v0), a3 = pt(u1, v1), a4 = pt(u0, v1);
        ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.lineTo(a3[0], a3[1]); ctx.lineTo(a4[0], a4[1]); ctx.closePath(); ctx.fill();
      };
      const espV = (e: number) => e / Math.max(0.0001, jn.h * (cg + 0.24 * sg)); // espessura fixa em pixels, convertida para v
      const sombra = 0.25 * sg; // deitada, a grade fica um pouco mais na sombra
      const creme = (rgb: RGB) => cor(mq(misturar(rgb, [60, 56, 48], sombra)));
      // sombra da grade aberta na porta, logo embaixo da janelinha
      if (sg > 0.02) {
        ctx.fillStyle = `rgba(0,0,0,${0.28 * sg})`;
        const b1 = pt(0, 1), b2 = pt(1, 1);
        ctx.beginPath(); ctx.moveTo(abX, abY); ctx.lineTo(abX + jn.abW, abY);
        ctx.lineTo(b2[0] - 0.02 * M, b2[1] + 0.1 * M * sg); ctx.lineTo(b1[0] + 0.02 * M, b1[1] + 0.1 * M * sg); ctx.closePath(); ctx.fill();
      }
      // barras horizontais (espessura fixa)
      const ladoU = Math.max(2, 0.025 * M) / jn.abW;
      for (let i = 1; i <= 5; i++) {
        const v = i / 6, e = espV(0.032 * M);
        ctx.fillStyle = creme([206, 196, 170]);
        faixa(v - e / 2, v + e / 2, ladoU, 1 - ladoU);
        ctx.fillStyle = creme([150, 142, 120]);
        faixa(v + e / 2, Math.min(1, v + e / 2 + espV(Math.max(1, 0.006 * M))), ladoU, 1 - ladoU);
      }
      // moldura: laterais, travessa da dobradiça e a beirada de baixo (mais grossa, com o puxador)
      ctx.fillStyle = creme([222, 212, 186]);
      faixa(0, 1, 0, ladoU);
      faixa(0, 1, 1 - ladoU, 1);
      faixa(0, espV(Math.max(2, 0.03 * M)));
      faixa(1 - espV(Math.max(2, 0.03 * M)), 1);
      // de baixo, com a grade deitada, aparece a espessura da beirada
      const espessura = Math.max(2, 0.05 * M) * sg;
      if (espessura > 0.5) {
        const b1 = pt(0, 1), b2 = pt(1, 1);
        ctx.fillStyle = creme([176, 166, 140]);
        ctx.fillRect(b1[0], b1[1], b2[0] - b1[0], espessura);
      }
      const pux0 = pt(0.32, 1), pux1 = pt(0.68, 1);
      ctx.fillStyle = creme([206, 196, 170]);
      ctx.fillRect(pux0[0], pux0[1] + espessura, pux1[0] - pux0[0], 0.04 * M);
      // pinos da dobradiça
      ctx.fillStyle = 'rgb(40,42,46)';
      ctx.fillRect(abX + jn.abW * 0.1, abY - 0.02 * M, jn.abW * 0.18, 0.035 * M);
      ctx.fillRect(abX + jn.abW * 0.72, abY - 0.02 * M, jn.abW * 0.18, 0.035 * M);
      const puxador: [number, number] = [(pux0[0] + pux1[0]) / 2, pux0[1] + espessura + 0.02 * M];

      // painel de comando no pedestal, ao lado da máquina: verde pronta, âmbar piscando soldando, vermelha apagada
      const pedX = mR + (W < 600 ? 0.5 : 0.75) * M;
      const pedTopo = piso - 1.15 * M;
      ctx.fillStyle = cor(mq([60, 64, 72]));
      ctx.fillRect(pedX - 0.03 * M, pedTopo, 0.06 * M, piso - pedTopo);
      ctx.fillRect(pedX - 0.12 * M, piso - 0.04 * M, 0.24 * M, 0.04 * M);
      const cx0 = pedX - 0.16 * M, cy0 = pedTopo - 0.4 * M;
      const caixaG = ctx.createLinearGradient(cx0, cy0, cx0 + 0.32 * M, cy0 + 0.4 * M);
      caixaG.addColorStop(0, cor(mq([96, 102, 110]))); caixaG.addColorStop(1, cor(mq([58, 62, 70])));
      ctx.fillStyle = caixaG;
      ctx.beginPath(); ctx.roundRect(cx0, cy0, 0.32 * M, 0.4 * M, 0.03 * M); ctx.fill();
      const lampadas: [RGB, boolean][] = [[[90, 230, 140], !soldando], [[255, 190, 60], soldando && Math.sin(t * 12) > 0], [[230, 60, 50], false]];
      lampadas.forEach(([c, acesa], i) => {
        const lx = cx0 + 0.07 * M + i * 0.09 * M, ly = cy0 + 0.09 * M;
        if (acesa) {
          const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 0.12 * M);
          g.addColorStop(0, cor(c, 0.6)); g.addColorStop(1, cor(c, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 0.12 * M, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = cor(acesa ? c : misturar(c, [0, 0, 0], 0.65));
        ctx.beginPath(); ctx.arc(lx, ly, 0.03 * M, 0, 6.283); ctx.fill();
      });
      const botao: [number, number] = [cx0 + 0.16 * M, cy0 + 0.25 * M];
      const apertando = suave(F.vai, F.vai + 0.12, fu) * (1 - suave(F.botao + 0.05, F.botao + 0.3, fu));
      ctx.fillStyle = apertando > 0.6 ? 'rgb(140,255,170)' : 'rgb(40,170,90)';
      ctx.beginPath(); ctx.arc(botao[0], botao[1], 0.06 * M, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.arc(botao[0] - 0.015 * M, botao[1] - 0.015 * M, 0.02 * M, 0, 6.283); ctx.fill();

      // tubo de exaustão azul saindo da saia de lona
      ctx.lineCap = 'round';
      const tubo = (largura: number, c: string) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = largura;
        ctx.beginPath();
        ctx.moveTo(mL + M * 0.55, mT - M * 0.5);
        if (estreito) {
          // tablet e celular: o tubo faz a curva logo acima da máquina e sai pela direita
          ctx.quadraticCurveTo(mL + M * 0.55, mT - M * 0.68, mL + M * 0.8, mT - M * 0.68);
          ctx.lineTo(W + M, mT - M * 0.68);
        } else {
          ctx.lineTo(mL + M * 0.55, mT - M * 1.05);
          ctx.quadraticCurveTo(mL + M * 0.55, mT - M * 1.45, mL + M * 1.0, mT - M * 1.45);
          ctx.lineTo(mR + M * 0.55, mT - M * 1.45);
          ctx.quadraticCurveTo(mR + M * 0.95, mT - M * 1.45, mR + M * 0.95, mT - M * 1.85);
          ctx.lineTo(mR + M * 0.95, -M);
        }
        ctx.stroke();
      };
      tubo(M * 0.3, cor(mq(SCH.TUBO)));
      tubo(M * 0.1, cor(mq(misturar(SCH.TUBO, [255, 255, 255], 0.4)), 0.65));
      tubo(M * 0.02, 'rgba(255,255,255,.5)');

      // fumaça da solda subindo e sendo puxada pelo tubo de exaustão
      if (!parado && ciclo && fase > F.garra && fase < F.rebarba + 0.6 && Math.random() < dt * 9) {
        fumaca.push({ x: xm + (Math.random() - 0.5) * 0.3 * M, y: wT + 0.15 * M, r: 0.06 * M, v: 1 });
      }
      for (const f of fumaca) {
        const alvoX = mL + 0.55 * M;
        f.x += (alvoX - f.x) * dt * 0.8;
        f.y -= dt * 0.35 * M;
        f.r += dt * 0.18 * M;
        f.v -= dt * 0.35;
      }
      for (let i = fumaca.length - 1; i >= 0; i--) if (fumaca[i].v <= 0 || fumaca[i].y < mT - 0.6 * M) fumaca.splice(i, 1);
      for (const f of fumaca) {
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, `rgba(170,170,165,${0.22 * f.v})`); g.addColorStop(1, 'rgba(170,170,165,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      }

      // o soldador: perto da grade quando a máquina está parada, no painel enquanto ela solda
      const Hs = 1.75 * M;
      const perto = wR + 0.38 * M;
      const longe = pedX + 0.36 * M;
      if (longe + Hs * 0.12 < W) {
        const ida = suave(F.grade, F.vai, fu), volta = suave(F.abre, F.volta, fu);
        const sxS = perto + (longe - perto) * (ida - volta);
        const anda = (fu > F.grade && fu < F.vai) || (fu > F.abre && fu < F.volta) ? 1 : 0;
        const naGrade = suave(0, 0.12, fu) * (1 - suave(F.grade - 0.1, F.grade + 0.1, fu)) + suave(F.volta - 0.1, F.volta + 0.1, fu) * (1 - suave(F.sobeGrade, F.sobeGrade + 0.2, fu));
        const noBotao = suave(F.vai - 0.15, F.vai + 0.1, fu) * (1 - suave(F.botao + 0.05, F.botao + 0.35, fu));
        const alvo: [number, number] | null = naGrade > 0.01 ? puxador : noBotao > 0.01 ? botao : null;
        desenharSoldador(ctx, {
          sx: sxS, piso, Hs, t, mq, parado,
          anda: parado ? 0 : anda, passo: (sxS - perto) / (Hs * 0.13),
          alvo, alcance: Math.max(naGrade, noBotao),
          protege: parado ? 0 : 0.6 * suave(F.garra, F.garra + 0.25, fu) * (1 - suave(F.centelha - 0.2, F.centelha + 0.2, fu)),
          confere: parado ? 0 : suave(F.sobeGrade, F.sobeGrade + 0.35, fu) * (1 - suave(F.confere - 0.4, F.confere + 0.2, fu)),
        });
      }

      // a luz da solda vaza pela janela e ilumina o chão, a porta e o soldador
      if (forcaCentelha > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(xm, topo + R, 0, xm, topo + R, 2.4 * M);
        g.addColorStop(0, `rgba(255,170,80,${0.14 * forcaCentelha})`);
        g.addColorStop(0.5, `rgba(255,140,60,${0.05 * forcaCentelha})`);
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(xm - 2.4 * M, topo - 1.6 * M, 4.8 * M, piso - topo + 2.4 * M);
        ctx.restore();
      }
    }

    // solda do logo (junto com a primeira emenda do trilho)
    if (!parado && !soldouLogo && t >= SOLDA) { soldouLogo = true; soldarLogo(cv, faiscas); }
    if (faiscas.length) desenharFaiscas(ctx, faiscas, dt, H);

    // vinheta suave e saída do escuro
    const v = ctx.createRadialGradient(xc, H * 0.45, Math.min(W, H) * 0.3, xc, H * 0.5, Math.max(W, H) * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, escuro ? 'rgba(0,0,0,.45)' : 'rgba(40,50,70,.12)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    const cortina = parado ? 0 : 1 - suave(0, completa ? 0.7 : 0.3, t);
    if (cortina > 0) { ctx.fillStyle = cor(pal.ceuTopo, cortina); ctx.fillRect(0, 0, W, H); }
  });
  return typeof controle === 'function' ? controle : controle.parar;
}
