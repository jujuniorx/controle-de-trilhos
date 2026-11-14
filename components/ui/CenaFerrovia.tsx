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
        ctx.font = `700 ${Math.round(alto * 0.2)}px var(--font-barlow), "Barlow", Arial, sans-serif`;
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
  const F = { garra: 0.35, centelha: 1.75, recalque: 1.95, rebarba: 2.4, sobe: 2.75 };
  let ciclo: { k: number; inicio: number } | null = null;
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
    const xm = W >= 900 ? W * 0.8 : W * 0.58;

    // ---------- movimento do trilho e ciclo da solda ----------
    if (parado) {
      u = L * 0.35; vel = 0;
    } else if (t < CHEGA) {
      // abertura: o trilho entra pela direita e freia com a emenda 0 dentro da máquina
      const D = completa ? W * 0.95 : W * 0.35;
      const e = 1 - Math.pow(1 - t / CHEGA, 3);
      u = -D * (1 - e);
      vel = 0;
      if (!ciclo) ciclo = { k: 0, inicio: CHEGA };
    } else if (ciclo && t - ciclo.inicio < F.sobe) {
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
    const fase = ciclo ? t - ciclo.inicio : 99;
    if (ciclo && fase >= F.centelha && !soldada.has(ciclo.k)) soldada.set(ciclo.k, ciclo.inicio + F.centelha);
    // centelhamento: chuva de faíscas saindo da fresta para os dois lados
    const centelhando = !parado && ciclo !== null && fase > F.garra && fase < F.centelha;
    const forcaCentelha = centelhando ? suave(F.garra, F.garra + 0.4, fase) * (0.75 + 0.25 * Math.sin(t * 40)) : 0;
    if (centelhando) {
      const n = Math.round(320 * dt * forcaCentelha + Math.random());
      for (let i = 0; i < n; i++) {
        const lado = Math.random() < 0.5 ? -1 : 1;
        faiscas.push({
          x: xm + lado * 2,
          y: topo + R * (Math.random() < 0.6 ? Math.random() * 0.3 : Math.random()),
          vx: lado * (120 + Math.random() * 420),
          vy: -(40 + Math.random() * 280),
          v: 0.3 + Math.random() * 0.45,
        });
      }
    }
    // garras: 0 em cima, 1 apertando o trilho
    const garra = !ciclo ? 0 : fase < F.garra ? suave(0, F.garra, fase) : fase < F.rebarba ? 1 : 1 - suave(F.rebarba, F.sobe, fase);
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

    // ---------- Schlatter: medidas e o interior escuro que aparece pela janela ----------
    const mq = (c: RGB): RGB => (escuro ? misturar(c, pal.ceuTopo, 0.3) : c);
    const LARANJA: RGB = [235, 161, 58], CREME: RGB = [216, 204, 176], AZUL: RGB = [44, 90, 147], TUBO: RGB = [120, 166, 214], CINZA: RGB = [70, 74, 80];
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
    ctx.font = `600 ${Math.round(Math.max(9, R * 0.42))}px var(--font-barlow-cond), "Barlow Condensed", "Arial Narrow", sans-serif`;
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
      // painéis: creme à esquerda, laranja à direita (porta), faixa de cima e base azul
      const painel = (x: number, y: number, w: number, h: number, c: RGB) => {
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, cor(misturar(mq(c), [255, 255, 255], 0.08)));
        g.addColorStop(1, cor(misturar(mq(c), [0, 0, 0], 0.12)));
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
      };
      painel(mL, mT, wL - mL, wB - mT, CREME);
      painel(wR, mT, mR - wR, wB - mT, LARANJA);
      painel(wL, mT, wR - wL, wT - mT, CREME);
      painel(mL, wB, mR - mL, piso - wB, AZUL);
      painel(mL - M * 0.08, mT - M * 0.12, mR - mL + M * 0.16, M * 0.12, AZUL);
      // detalhes: grade de ventilação no creme, caixa de comando com luz, puxador da porta
      ctx.strokeStyle = cor(mq(misturar(CREME, [0, 0, 0], 0.35)), 0.6);
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const y = mT + M * 0.35 + i * M * 0.12;
        ctx.beginPath(); ctx.moveTo(mL + M * 0.2, y); ctx.lineTo(wL - M * 0.25, y); ctx.stroke();
      }
      ctx.fillStyle = cor(mq(CINZA));
      ctx.fillRect(wR + M * 0.2, mT + M * 0.35, M * 0.42, M * 0.55);
      const luz = ciclo && fase < F.sobe ? (Math.sin(t * 12) > 0 ? [255, 190, 60] : [120, 80, 30]) : [90, 220, 140];
      ctx.fillStyle = cor(luz as RGB);
      ctx.beginPath(); ctx.arc(wR + M * 0.41, mT + M * 0.52, M * 0.06, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgb(230,60,50)';
      ctx.beginPath(); ctx.arc(wR + M * 0.41, mT + M * 0.74, M * 0.05, 0, 6.283); ctx.fill();
      ctx.fillStyle = cor(mq(misturar(LARANJA, [0, 0, 0], 0.4)));
      ctx.fillRect(mR - M * 0.22, piso - M * 1.4, M * 0.06, M * 0.55); // puxador a uns 1,1 m do chão
      // moldura da janela
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(wL, wT, wR - wL, wB - wT);
      // tubo de exaustão azul saindo de cima e subindo para o telhado
      ctx.lineCap = 'round';
      const tubo = (largura: number, c: string) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = largura;
        ctx.beginPath();
        ctx.moveTo(mL + M * 0.55, mT - M * 0.1);
        if (W < 600) {
          // no celular o tubo fica baixo e some à direita, sem passar por cima do texto
          ctx.lineTo(mL + M * 0.55, mT - M * 0.3);
          ctx.quadraticCurveTo(mL + M * 0.55, mT - M * 0.55, mL + M * 0.9, mT - M * 0.55);
          ctx.lineTo(W + M, mT - M * 0.55);
        } else {
          ctx.lineTo(mL + M * 0.55, mT - M * 0.7);
          ctx.quadraticCurveTo(mL + M * 0.55, mT - M * 1.15, mL + M * 1.1, mT - M * 1.15);
          ctx.lineTo(mR + M * 0.4, mT - M * 1.15);
          ctx.quadraticCurveTo(mR + M * 1.0, mT - M * 1.15, mR + M * 1.0, mT - M * 1.8);
          ctx.lineTo(mR + M * 1.0, mT - M * 3.2);
        }
        ctx.stroke();
      };
      tubo(M * 0.3, cor(mq(TUBO)));
      tubo(M * 0.08, cor(mq(misturar(TUBO, [255, 255, 255], 0.45)), 0.7));
      // grade de proteção à esquerda da máquina
      const gL = mL - M * 0.75, gR = mL - M * 0.1, gT = mT + M * 0.5;
      ctx.strokeStyle = cor(mq(CINZA), 0.9);
      ctx.lineWidth = 2;
      ctx.strokeRect(gL, gT, gR - gL, piso - gT);
      ctx.strokeStyle = cor(mq(CINZA), 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = gL; x < gR; x += M * 0.08) { ctx.moveTo(x, gT); ctx.lineTo(x, piso); }
      for (let y = gT; y < piso; y += M * 0.08) { ctx.moveTo(gL, y); ctx.lineTo(gR, y); }
      ctx.stroke();

      // o soldador ao lado da máquina, de capacete e uniforme com faixas refletivas
      const Hs = 1.75 * M; // o soldador tem 1,75 m
      const sx = mR + 0.62 * M;
      if (sx + Hs * 0.3 < W) {
        const respira = parado ? 0 : Math.sin(t * 1.6) * Hs * 0.004;
        const azulUni = cor(mq([34, 44, 92]));
        const faixa = cor(mq([200, 226, 74]));
        const prata = 'rgba(220,225,230,.95)';
        const y0 = piso;
        // pernas e botas
        ctx.fillStyle = azulUni;
        ctx.fillRect(sx - Hs * 0.1, y0 - Hs * 0.46, Hs * 0.09, Hs * 0.44);
        ctx.fillRect(sx + Hs * 0.01, y0 - Hs * 0.46, Hs * 0.09, Hs * 0.44);
        ctx.fillStyle = 'rgb(30,30,32)';
        ctx.fillRect(sx - Hs * 0.13, y0 - Hs * 0.04, Hs * 0.13, Hs * 0.04);
        ctx.fillRect(sx + Hs * 0.0, y0 - Hs * 0.04, Hs * 0.13, Hs * 0.04);
        ctx.fillStyle = faixa;
        ctx.fillRect(sx - Hs * 0.1, y0 - Hs * 0.16, Hs * 0.2, Hs * 0.025);
        ctx.fillStyle = prata;
        ctx.fillRect(sx - Hs * 0.1, y0 - Hs * 0.15, Hs * 0.2, Hs * 0.008);
        // tronco com as faixas
        ctx.fillStyle = azulUni;
        ctx.beginPath();
        ctx.roundRect(sx - Hs * 0.14, y0 - Hs * 0.8 + respira, Hs * 0.28, Hs * 0.36, Hs * 0.05);
        ctx.fill();
        ctx.fillStyle = faixa;
        ctx.fillRect(sx - Hs * 0.14, y0 - Hs * 0.58 + respira, Hs * 0.28, Hs * 0.03);
        ctx.fillStyle = prata;
        ctx.fillRect(sx - Hs * 0.14, y0 - Hs * 0.57 + respira, Hs * 0.28, Hs * 0.01);
        // braço indo até a porta da máquina
        ctx.strokeStyle = azulUni;
        ctx.lineWidth = Hs * 0.07;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx - Hs * 0.06, y0 - Hs * 0.74 + respira);
        ctx.lineTo(sx - Hs * 0.2, y0 - Hs * 0.6 + respira);
        ctx.lineTo(mR - 0.19 * M, piso - 1.12 * M);
        ctx.stroke();
        ctx.fillStyle = 'rgb(40,40,44)'; // luva no puxador da porta
        ctx.beginPath(); ctx.arc(mR - 0.19 * M, piso - 1.12 * M, Hs * 0.035, 0, 6.283); ctx.fill();
        // cabeça, capacete branco e abafador
        ctx.fillStyle = 'rgb(176,128,98)';
        ctx.beginPath(); ctx.arc(sx, y0 - Hs * 0.87 + respira, Hs * 0.065, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgb(240,242,244)';
        ctx.beginPath(); ctx.ellipse(sx, y0 - Hs * 0.9 + respira, Hs * 0.085, Hs * 0.06, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(sx - Hs * 0.1, y0 - Hs * 0.905 + respira, Hs * 0.2, Hs * 0.015);
        // aba do capacete para a frente (ele olha para a máquina) e o abafador atrás da orelha
        ctx.fillStyle = 'rgb(240,242,244)';
        ctx.fillRect(sx - Hs * 0.13, y0 - Hs * 0.9 + respira, Hs * 0.06, Hs * 0.014);
        ctx.fillStyle = 'rgb(60,62,66)';
        ctx.beginPath(); ctx.ellipse(sx + Hs * 0.03, y0 - Hs * 0.86 + respira, Hs * 0.022, Hs * 0.03, 0, 0, 6.283); ctx.fill();
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
