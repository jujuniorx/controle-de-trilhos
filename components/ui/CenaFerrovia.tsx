'use client';

import { useEffect, useRef } from 'react';

/**
 * Cena da ferrovia em canvas, usada no fundo das telas.
 *
 * inicio (tela inicial, logins e abertura do app): o TLS saindo do estaleiro. O trilho longo corre sobre roletes
 *   na parte de baixo e só anda quando o soldador segura o joystick do painel Siemens. Na Schlatter ele fecha a
 *   portinhola, aperta a solda (a emenda centelha e recalca), abre a portinhola e raspa a borra com a espátula.
 *   Logo depois da máquina, o segundo operário deita a régua sobre a emenda e confere o alinhamento. Os dois
 *   aparecem de costas, com a logo da Rumo no uniforme. Atrás, o galpão com as luminárias.
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
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 0.018, s.y - s.vy * 0.018);
    ctx.strokeStyle = `rgba(255,${Math.round(g * 0.7)},40,${a * 0.25})`; // brilho em volta
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,${g},${b},${a})`;
    ctx.lineWidth = 1.5;
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

/** Hora decimal de Brasília (o mesmo fuso da saudação), para a cena bater com o cartão. */
function horaDeBrasilia(): number {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const h = Number(partes.find((x) => x.type === 'hour')?.value ?? 12), m = Number(partes.find((x) => x.type === 'minute')?.value ?? 0);
  return (h % 24) + m / 60;
}
/** Lido pelo desenho da locomotiva: de dia o farol e as janelas ficam apagados. */
let modoDiaSaudacao = true;

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
    const hora = horaDeBrasilia();
    const dia = hora >= 6 && hora < 18;
    modoDiaSaudacao = dia;
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
        // janelas da cabine com luz (apagadas de dia)
        ctx.fillStyle = `rgba(255,214,150,${(modoDiaSaudacao ? 0.12 : 0.85) * a})`;
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
        // farol aceso na frente (só de noite)
        if (!modoDiaSaudacao) {
          const g = ctx.createRadialGradient(X(0), Y(0.48), 0, X(0), Y(0.48), alto * 1.6);
          g.addColorStop(0, `rgba(255,226,170,${0.75 * entra})`); g.addColorStop(1, 'rgba(255,226,170,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(0), Y(0.48), alto * 1.6, 0, 6.283); ctx.fill();
        }
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
  // plaqueta da máquina (na porta da esquerda, embaixo das venezianas; a da direita leva o painel de comando)
  const plL = mL + 0.1 * M, plW = PAINEL(M, wL, mT).px - 0.08 * M - plL, plY = mT + 0.86 * M;
  c.fillStyle = 'rgb(200,204,210)';
  c.fillRect(plL, plY, plW, 0.13 * M);
  c.fillStyle = 'rgb(40,44,52)';
  let tam = 0.075 * M;
  c.font = `700 ${tam}px ${fonte('--font-barlow-cond', '"Barlow Condensed", "Arial Narrow", sans-serif')}`;
  const largTexto = c.measureText('SCHLATTER').width;
  if (largTexto > plW * 0.86) { tam *= (plW * 0.86) / largTexto; c.font = `700 ${tam}px ${fonte('--font-barlow-cond', '"Barlow Condensed", "Arial Narrow", sans-serif')}`; }
  c.textBaseline = 'middle';
  c.textAlign = 'center';
  c.fillText('SCHLATTER', plL + plW / 2, plY + 0.066 * M);
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

  // painel de comando Siemens preso na lateral, à esquerda da porta (como na foto): caixa bege com as duas telas,
  // botão de emergência em cima, fileira de alavancas embaixo e o controle amarelo pendurado no suporte azul
  {
    const pn = PAINEL(M, wL, mT);
    // braço articulado que segura o painel, subindo até a viga azul
    c.fillStyle = cor(mq([176, 150, 104]));
    c.fillRect(pn.x0 + (pn.x1 - pn.x0) * 0.55, mT - 0.02 * M, 0.07 * M, pn.y0 - mT + 0.02 * M);
    c.fillStyle = cor(mq([120, 100, 70]));
    c.beginPath(); c.ellipse(pn.x0 + (pn.x1 - pn.x0) * 0.55 + 0.035 * M, pn.y0, 0.07 * M, 0.025 * M, 0, 0, 6.283); c.fill();
    // cabo preto do controle
    c.strokeStyle = 'rgb(24,24,28)'; c.lineWidth = Math.max(1.2, 0.018 * M);
    c.beginPath(); c.moveTo(pn.px + pn.pw / 2, pn.py0); c.quadraticCurveTo(pn.px + pn.pw * 0.6, pn.y0 - 0.12 * M, pn.x0 + (pn.x1 - pn.x0) * 0.5, pn.y0 - 0.05 * M); c.stroke();
    // caixa
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.fillRect(pn.x0 + 0.02 * M, pn.y0 + 0.02 * M, pn.x1 - pn.x0, pn.y1 - pn.y0);
    painel(pn.x0, pn.y0, pn.x1 - pn.x0, pn.y1 - pn.y0, [214, 206, 186], 0.12, 0.12);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
    c.strokeRect(pn.x0, pn.y0, pn.x1 - pn.x0, pn.y1 - pn.y0);
    const pw = pn.x1 - pn.x0, ph = pn.y1 - pn.y0;
    // tela de texto (verde) com teclado e o painel de teclas
    c.fillStyle = cor(mq([196, 200, 204]));
    c.fillRect(pn.x0 + pw * 0.1, pn.y0 + ph * 0.24, pw * 0.34, ph * 0.5);
    c.fillStyle = 'rgb(150,196,110)';
    c.fillRect(pn.x0 + pw * 0.14, pn.y0 + ph * 0.28, pw * 0.26, ph * 0.13);
    c.fillStyle = 'rgba(40,60,40,.6)';
    for (let i = 0; i < 2; i++) c.fillRect(pn.x0 + pw * 0.16, pn.y0 + ph * (0.31 + i * 0.05), pw * 0.2, Math.max(0.6, ph * 0.012));
    c.fillStyle = 'rgba(60,64,70,.55)';
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) c.fillRect(pn.x0 + pw * (0.14 + k * 0.065), pn.y0 + ph * (0.46 + r * 0.065), pw * 0.04, ph * 0.04);
    c.fillStyle = cor(mq([228, 230, 228]));
    c.fillRect(pn.x0 + pw * 0.5, pn.y0 + ph * 0.24, pw * 0.4, ph * 0.5);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) {
      const verde = (r * 7 + k * 3) % 5 === 0;
      c.fillStyle = verde ? 'rgb(150,230,60)' : 'rgba(80,84,90,.45)';
      c.fillRect(pn.x0 + pw * (0.53 + k * 0.058), pn.y0 + ph * (0.29 + r * 0.085), pw * 0.04, ph * 0.05);
    }
    // botão de emergência (cogumelo vermelho na base amarela)
    c.fillStyle = cor(SCH.AMARELO);
    c.beginPath(); c.arc(pn.x0 + pw * 0.4, pn.y0 + ph * 0.12, ph * 0.075, 0, 6.283); c.fill();
    c.fillStyle = 'rgb(205,40,36)';
    c.beginPath(); c.arc(pn.x0 + pw * 0.4, pn.y0 + ph * 0.12, ph * 0.055, 0, 6.283); c.fill();
    // fileira de alavanquinhas embaixo (a primeira, maior, é o joystick que faz a barra andar: desenhada à parte)
    for (let k = 1; k < 8; k++) {
      const ax = pn.jx + k * pw * 0.1, ay = pn.jy;
      c.fillStyle = 'rgb(30,32,36)';
      c.fillRect(ax - pw * 0.025, ay - ph * 0.04, pw * 0.05, ph * 0.08);
      c.strokeStyle = 'rgb(20,20,24)'; c.lineWidth = Math.max(1, pw * 0.018);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + pw * 0.03, ay + ph * 0.07); c.stroke();
    }
    c.fillStyle = 'rgb(40,42,46)';
    c.beginPath(); c.arc(pn.jx, pn.jy, pw * 0.04, 0, 6.283); c.fill();
    // alça cromada embaixo
    c.strokeStyle = 'rgb(196,200,206)'; c.lineWidth = Math.max(1.2, 0.014 * M);
    c.beginPath(); c.moveTo(pn.x0 + pw * 0.75, pn.y1); c.quadraticCurveTo(pn.x0 + pw * 0.95, pn.y1 + ph * 0.18, pn.x1, pn.y1 - ph * 0.08); c.stroke();
    // controle amarelo (botoeira pendente) no suporte azul, do lado esquerdo do painel
    c.fillStyle = cor(mq([44, 84, 170]));
    c.fillRect(pn.px - pn.pw * 0.18, pn.py0 - ph * 0.04, pn.pw * 1.36, Math.max(2, ph * 0.035));
    c.fillRect(pn.px - pn.pw * 0.18, pn.py1, pn.pw * 1.36, Math.max(2, ph * 0.035));
    c.fillRect(pn.px - pn.pw * 0.18, pn.py0 - ph * 0.04, Math.max(1.5, pn.pw * 0.12), pn.py1 - pn.py0 + ph * 0.07);
    painel(pn.px, pn.py0, pn.pw, pn.py1 - pn.py0, SCH.AMARELO, 0.18, 0.08);
    c.fillStyle = 'rgb(205,40,36)';
    c.beginPath(); c.arc(pn.px + pn.pw / 2, pn.py0 + (pn.py1 - pn.py0) * 0.16, pn.pw * 0.26, 0, 6.283); c.fill();
    c.fillStyle = 'rgb(26,26,30)';
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(pn.px + pn.pw / 2, pn.py0 + (pn.py1 - pn.py0) * (0.36 + k * 0.16), pn.pw * 0.2, 0, 6.283); c.fill(); }
  }

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
  // abertura (escura) com a moldura creme
  c.fillStyle = 'rgb(20,22,26)';
  c.fillRect(j.abX, j.y, j.abW, j.h);
  c.strokeStyle = cor(mq([214, 204, 176])); c.lineWidth = Math.max(2, 0.03 * M);
  c.strokeRect(j.abX, j.y, j.abW, j.h);
}

/** Painel de comando Siemens à esquerda da porta: caixa, joystick (jx, jy), botão de solda, lâmpadas e o controle amarelo. */
function PAINEL(M: number, wL: number, mT: number) {
  const x0 = wL - 0.6 * M, x1 = wL - 0.1 * M, y0 = mT + 0.8 * M, y1 = mT + 1.38 * M;
  const pw = 0.13 * M;
  return {
    x0, x1, y0, y1,
    jx: x0 + (x1 - x0) * 0.12, jy: y1 - (y1 - y0) * 0.1,
    botao: [x0 + (x1 - x0) * 0.62, y0 + (y1 - y0) * 0.45] as [number, number],
    lampLaranja: [x0 + (x1 - x0) * 0.16, y0 - 0.045 * M] as [number, number],
    lampVerde: [x0 + (x1 - x0) * 0.86, y0 - 0.045 * M] as [number, number],
    px: x0 - pw - 0.04 * M, pw, py0: y0 + 0.06 * M, py1: y0 + 0.5 * M,
  };
}

/** Posição da janelinha de visita na porta (em relação ao canto da porta). */
function JANELINHA(M: number) {
  return { caixaX: 0.2 * M, caixaW: 0.24 * M, abX: 0.48 * M, abW: 0.32 * M, y: 0.95 * M, h: 0.48 * M };
}

// ---------- marcação de caneta de tinta nos trilhos ("S-01", "S-02"...) ----------
// Cada letra é um traço único, como a mão faz, em uma caixa de altura 1 (x de 0 a ~0,6, y para baixo).
// Na hora de desenhar, os pontos tremem um pouco (cada barra com seu sorteio fixo), o traço afina e engrossa,
// falha onde a superfície é áspera e a tinta junta numa bolinha onde a caneta para.
type Traco = [number, number][];
const GLIFOS: Record<string, Traco[]> = {
  S: [[[0.56, 0.1], [0.32, 0], [0.06, 0.12], [0.1, 0.38], [0.34, 0.5], [0.56, 0.64], [0.54, 0.88], [0.3, 1], [0.04, 0.92]]],
  '-': [[[0.02, 0.56], [0.24, 0.55]]],
  '0': [[[0.32, 0.02], [0.08, 0.2], [0.04, 0.6], [0.2, 0.96], [0.44, 0.94], [0.58, 0.55], [0.5, 0.12], [0.3, 0.02]]],
  '1': [[[0.14, 0.22], [0.34, 0.02], [0.34, 1]]],
  '2': [[[0.06, 0.2], [0.3, 0.01], [0.54, 0.16], [0.46, 0.48], [0.02, 0.98], [0.6, 0.98]]],
  '3': [[[0.06, 0.1], [0.32, 0.01], [0.55, 0.16], [0.44, 0.4], [0.24, 0.48], [0.5, 0.58], [0.58, 0.82], [0.34, 1], [0.02, 0.9]]],
  '4': [[[0.46, 1], [0.46, 0.02], [0.02, 0.68], [0.6, 0.68]]],
  '5': [[[0.56, 0.02], [0.12, 0.02], [0.06, 0.44], [0.34, 0.38], [0.58, 0.6], [0.52, 0.9], [0.26, 1], [0.02, 0.9]]],
  '6': [[[0.5, 0.02], [0.2, 0.24], [0.03, 0.64], [0.16, 0.97], [0.46, 0.94], [0.56, 0.68], [0.34, 0.5], [0.08, 0.64]]],
  '7': [[[0.02, 0.03], [0.58, 0.02], [0.24, 1]], [[0.12, 0.54], [0.48, 0.5]]],
  '8': [[[0.52, 0.14], [0.3, 0.01], [0.08, 0.16], [0.16, 0.4], [0.44, 0.58], [0.56, 0.82], [0.3, 1], [0.04, 0.84], [0.16, 0.58], [0.44, 0.38], [0.52, 0.14]]],
  '9': [[[0.56, 0.3], [0.3, 0.46], [0.06, 0.3], [0.16, 0.03], [0.46, 0.04], [0.56, 0.3], [0.46, 1]]],
};
function sorteio(semente: number) {
  let a = (semente * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Curva suave passando pelos pontos (Catmull-Rom). */
function suavizarTraco(pts: Traco, n = 7): Traco {
  if (pts.length < 3) return pts;
  const out: Traco = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
interface MarcaCaneta { tracos: Traco[]; falhas: number[]; largura: number }
const marcasCaneta = new Map<string, MarcaCaneta>();
/** Monta a marcação (em unidades da altura da letra), tremida de um jeito fixo para cada texto. */
function marcaCaneta(texto: string, semente: number): MarcaCaneta {
  const chave = `${texto}|${semente}`;
  const pronta = marcasCaneta.get(chave);
  if (pronta) return pronta;
  const r = sorteio(semente);
  const tracos: Traco[] = [];
  let x = 0;
  for (const ch of texto) {
    const g = GLIFOS[ch];
    if (!g) { x += 0.4; continue; }
    const escala = 0.92 + r() * 0.16, base = (r() - 0.5) * 0.1, inclina = -0.12 + (r() - 0.5) * 0.08;
    let larg = 0;
    for (const tr of g) {
      const pts: Traco = tr.map(([px, py]) => {
        larg = Math.max(larg, px);
        const jx = (r() - 0.5) * 0.06, jy = (r() - 0.5) * 0.06;
        const yy = py * escala + base + jy;
        return [x + (px + jx) * escala + inclina * (yy - 0.5), yy];
      });
      tracos.push(suavizarTraco(pts));
    }
    x += larg * escala + (ch === '-' ? 0.16 : 0.2) + r() * 0.06;
  }
  const falhas = Array.from({ length: 6 }, () => 0.6 + r() * 3);
  const marca = { tracos, falhas, largura: x };
  marcasCaneta.set(chave, marca);
  return marca;
}
/** Desenha a marcação com o canto de cima à esquerda em (x, y) e altura h. */
function desenharMarcaCaneta(ctx: CanvasRenderingContext2D, m: MarcaCaneta, x: number, y: number, h: number, alfa: number) {
  const w = Math.max(1, h * 0.1);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // falhas pequenas no traço, onde a ferrugem não pega tinta
  ctx.setLineDash(m.falhas.flatMap((f, i) => [h * f, i % 2 ? w * 0.9 : w * 0.5]));
  for (const tr of m.tracos) {
    ctx.beginPath();
    ctx.moveTo(x + tr[0][0] * h, y + tr[0][1] * h);
    for (let i = 1; i < tr.length; i++) ctx.lineTo(x + tr[i][0] * h, y + tr[i][1] * h);
    ctx.strokeStyle = `rgba(30,40,46,${0.25 * alfa})`; // leve sombra da tinta em relevo
    ctx.lineWidth = w * 1.5;
    ctx.stroke();
    ctx.strokeStyle = `rgba(232,242,246,${alfa})`;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // bolinha de tinta onde a caneta parou (começo e fim de cada traço)
  ctx.fillStyle = `rgba(240,248,250,${alfa})`;
  for (const tr of m.tracos) {
    for (const [px, py] of [tr[0], tr[tr.length - 1]]) {
      ctx.beginPath(); ctx.arc(x + px * h, y + py * h, w * 0.85, 0, 6.283); ctx.fill();
    }
  }
  ctx.restore();
}

interface PoseOperario {
  sx: number; piso: number; Hs: number; t: number; mq: (c: RGB) => RGB; parado: boolean;
  /** andando (0 parado, 1 andando) e a fase do passo */
  anda: number; passo: number;
  /** aonde vai cada mão (esquerda e direita dele; de costas, a esquerda fica à esquerda da tela) e quanto (0 a 1) */
  maoE: [number, number] | null; alcE: number;
  maoD: [number, number] | null; alcD: number;
  /** mão direita na frente do peito (segurando a espátula): o braço fica escondido atrás das costas */
  dPeito: number;
  /** curva o tronco para a frente (0 a 1), dobra os joelhos (0 a 1), desloca os ombros para o lado (-1 a 1) */
  curva: number; agacha: number; inclina: number;
  capacete: RGB;
  /** para os dois não respirarem no mesmo compasso */
  fase: number;
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
 * Logo da Rumo como vai nas costas do uniforme: "rum" e o "o" com a seta, em branco, e a frase embaixo.
 * (cx, base) é o meio da linha de base; larg é a largura do "rumo"; sy achata quando o corpo se curva.
 */
function desenharLogoRumo(ctx: CanvasRenderingContext2D, cx: number, base: number, larg: number, sy: number, tinta: string) {
  const tam = larg * 0.4;
  ctx.save();
  ctx.translate(cx, base);
  ctx.scale(1, sy);
  ctx.fillStyle = tinta; ctx.strokeStyle = tinta;
  ctx.font = `600 ${tam}px ${fonte('--font-barlow', 'Arial, Helvetica, sans-serif')}`;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const wRum = ctx.measureText('rum').width;
  const r = tam * 0.27;
  const x0 = -(wRum + tam * 0.05 + r * 2) / 2;
  ctx.fillText('rum', x0, 0);
  // o "o" da marca: um anel aberto em cima à direita, com a seta curva saindo de dentro
  const ox = x0 + wRum + tam * 0.05 + r, oy = -r;
  ctx.lineWidth = tam * 0.105; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(ox, oy, r - tam * 0.05, -0.15, Math.PI * 1.72); ctx.stroke();
  ctx.lineWidth = tam * 0.085;
  ctx.beginPath(); ctx.moveTo(ox - r * 0.35, oy + r * 0.3); ctx.quadraticCurveTo(ox + r * 0.25, oy + r * 0.05, ox + r * 0.72, oy - r * 0.62); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox + r * 0.3, oy - r * 0.62); ctx.lineTo(ox + r * 0.78, oy - r * 0.7); ctx.lineTo(ox + r * 0.74, oy - r * 0.2); ctx.stroke();
  // "Somos o Brasil em movimento": só escreve quando dá para ler; menor que isso vira um fio
  const tf = tam * 0.21;
  if (tf >= 4.5) {
    ctx.font = `500 ${tf}px ${fonte('--font-barlow', 'Arial, Helvetica, sans-serif')}`;
    ctx.textAlign = 'center';
    ctx.globalAlpha *= 0.9;
    ctx.fillText('Somos o Brasil em movimento', 0, tam * 0.36);
  } else {
    ctx.globalAlpha *= 0.45;
    ctx.fillRect(-larg * 0.42, tam * 0.2, larg * 0.84, Math.max(0.6, tam * 0.06));
  }
  ctx.restore();
}

/**
 * Operário da Rumo visto de costas (como nas fotos do estaleiro): capacete com abafador 3M creme dos dois lados,
 * uniforme azul-marinho de manga comprida com a logo "rumo" e a frase nas costas, faixa refletiva na cintura e nos
 * antebraços, duas faixas em cada canela, luvas e botinas pretas. Cada mão pode ir até um alvo; o tronco curva para
 * a frente (para dentro da tela), os joelhos dobram e os ombros pendem para o lado do alvo.
 */
function desenharOperario(ctx: CanvasRenderingContext2D, p: PoseOperario) {
  const { sx, piso, Hs, t, mq } = p;
  const azul = cor(mq([30, 40, 80])), azulLuz = cor(mq([50, 64, 116])), azulSombra = cor(mq([18, 25, 54]));
  const contorno = cor(mq([10, 13, 28]));
  const faixa = cor(mq([206, 236, 74])), prata = cor(mq([210, 216, 222]));
  const pele = cor(mq([176, 126, 94])), peleSombra = cor(mq([134, 92, 66])), cabelo = cor(mq([36, 28, 24]));
  const capL = misturar(p.capacete, [255, 255, 255], 0.3), capS = misturar(p.capacete, [0, 0, 0], 0.32);
  const concha = cor(mq([222, 208, 160])), conchaS = cor(mq([160, 146, 104])), conchaArco = cor(mq([60, 62, 68]));
  const preto = cor(mq([20, 20, 24])), pretoLuz = cor(mq([62, 62, 70]));
  const branco = cor(mq([240, 242, 246]));

  const vivo = p.parado ? 0 : 1;
  const peso = Math.sin(t * 0.42 + p.fase) * vivo * (1 - p.anda);
  const respira = Math.sin(t * 1.7 + p.fase) * Hs * 0.003 * vivo;
  const sobe = Math.abs(Math.cos(p.passo)) * p.anda * Hs * 0.01;
  // de costas, o passo aparece como um pé subindo de cada vez
  const peE: [number, number] = [sx - Hs * 0.058 - p.agacha * Hs * 0.03, piso - Math.max(0, Math.sin(p.passo)) * p.anda * Hs * 0.035];
  const peD: [number, number] = [sx + Hs * 0.058 + p.agacha * Hs * 0.03, piso - Math.max(0, -Math.sin(p.passo)) * p.anda * Hs * 0.035];
  const qx = sx + peso * Hs * 0.012 + p.inclina * Hs * 0.015;
  const qy = piso - Hs * 0.5 + p.agacha * Hs * 0.15 + Math.abs(peso) * Hs * 0.003 - sobe;
  const hT = Hs * 0.3 * (1 - 0.45 * p.curva); // o tronco encurta quando se curva para dentro da tela
  const ox = qx + p.inclina * Hs * 0.06, oy = qy - hT + respira;
  const cab: [number, number] = [ox + p.inclina * Hs * 0.02, oy - Hs * 0.1 * (1 - 0.7 * p.curva)];

  const linha = (pts: [number, number][], largura: number, c: string) => {
    ctx.strokeStyle = c; ctx.lineWidth = largura; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };
  const membro = (pts: [number, number][], largura: number, c: string, luz?: string) => {
    linha(pts, largura + Math.max(1, Hs * 0.008), contorno);
    linha(pts, largura, c);
    if (luz) {
      ctx.save(); ctx.translate(-largura * 0.22, 0);
      linha(pts, largura * 0.2, luz);
      ctx.restore();
    }
  };
  const faixaEm = (a: [number, number], b: [number, number], f: number, largura: number, alt = Hs * 0.022) => {
    const x = mix(a[0], b[0], f), y = mix(a[1], b[1], f);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
    const dx = Math.cos(ang) * largura * 0.47, dy = Math.sin(ang) * largura * 0.47;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = faixa; ctx.lineWidth = alt;
    ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
    ctx.strokeStyle = prata; ctx.lineWidth = Math.max(1, alt * 0.3);
    ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
    ctx.lineCap = 'round';
  };

  // pernas: calça azul-marinho com duas faixas na canela e botina preta (vista pelo calcanhar)
  const perna = Hs * 0.226;
  for (const [lado, pe] of [[-1, peE], [1, peD]] as [number, [number, number]][]) {
    const q: [number, number] = [qx + lado * Hs * 0.05, qy];
    const tor: [number, number] = [pe[0], pe[1] - Hs * 0.055];
    const jo = cotovelo(q[0], q[1], tor[0], tor[1], perna, perna, lado < 0 ? 1 : -1);
    membro([q, jo, tor], Hs * 0.088, lado < 0 ? azul : azulSombra, lado < 0 ? azulLuz : undefined);
    faixaEm(jo, tor, 0.42, Hs * 0.088);
    faixaEm(jo, tor, 0.66, Hs * 0.088);
    ctx.fillStyle = preto;
    ctx.beginPath(); ctx.roundRect(pe[0] - Hs * 0.04, pe[1] - Hs * 0.075, Hs * 0.08, Hs * 0.075, [Hs * 0.03, Hs * 0.03, Hs * 0.012, Hs * 0.012]); ctx.fill();
    ctx.fillStyle = pretoLuz;
    ctx.fillRect(pe[0] - Hs * 0.042, pe[1] - Hs * 0.014, Hs * 0.084, Hs * 0.014);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.beginPath(); ctx.ellipse(pe[0] - Hs * 0.012, pe[1] - Hs * 0.05, Hs * 0.012, Hs * 0.018, 0, 0, 6.283); ctx.fill();
  }

  // braços: cada mão vai até o alvo; o cotovelo dobra para fora e para baixo
  const L1 = Hs * 0.165, L2 = Hs * 0.165;
  const braco = (lado: number, alvo: [number, number] | null, alc: number) => {
    const om: [number, number] = [ox + lado * Hs * 0.108, oy + Hs * 0.028];
    const livre: [number, number] = [om[0] + lado * Hs * 0.018, om[1] + Hs * 0.31 - p.anda * Math.abs(Math.sin(p.passo)) * Hs * 0.012];
    const a = alvo ?? livre;
    const mao: [number, number] = [mix(livre[0], a[0], alc), mix(livre[1], a[1], alc)];
    const c1 = cotovelo(om[0], om[1], mao[0], mao[1], L1, L2, 1), c2 = cotovelo(om[0], om[1], mao[0], mao[1], L1, L2, -1);
    const nota = (c: [number, number]) => c[1] + lado * (c[0] - om[0]) * 0.25;
    const cot = nota(c1) >= nota(c2) ? c1 : c2;
    membro([om, cot, mao], Hs * 0.062, lado < 0 ? azul : azulSombra, lado < 0 ? azulLuz : undefined);
    faixaEm(cot, mao, 0.22, Hs * 0.062);
    // luva preta com punho
    const ang = Math.atan2(mao[1] - cot[1], mao[0] - cot[0]);
    ctx.save(); ctx.translate(mao[0], mao[1]); ctx.rotate(ang);
    ctx.fillStyle = preto;
    ctx.beginPath(); ctx.roundRect(-Hs * 0.034, -Hs * 0.025, Hs * 0.03, Hs * 0.05, Hs * 0.006); ctx.fill();
    ctx.beginPath(); ctx.ellipse(Hs * 0.01, 0, Hs * 0.029, Hs * 0.023, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = pretoLuz;
    ctx.beginPath(); ctx.ellipse(Hs * 0.012, -Hs * 0.009, Hs * 0.015, Hs * 0.006, 0, 0, 6.283); ctx.fill();
    ctx.restore();
  };
  // mão direita no peito (espátula): o braço passa por trás das costas, então vem antes do tronco
  if (p.dPeito > 0.5) braco(1, p.maoD, p.alcD);

  // tronco: jaqueta vista de costas, mais larga nos ombros, com pala, faixa refletiva na cintura e a logo
  const lo = Hs * 0.125, lq = Hs * 0.1, barra = qy + Hs * 0.065;
  const corpo = new Path2D();
  corpo.moveTo(ox - lo * 0.62, oy - Hs * 0.014);
  corpo.quadraticCurveTo(ox - lo * 1.02, oy - Hs * 0.012, ox - lo, oy + Hs * 0.045);
  corpo.lineTo(qx - lq * 1.04, barra);
  corpo.quadraticCurveTo(qx, barra + Hs * 0.012, qx + lq * 1.04, barra);
  corpo.lineTo(ox + lo, oy + Hs * 0.045);
  corpo.quadraticCurveTo(ox + lo * 1.02, oy - Hs * 0.012, ox + lo * 0.62, oy - Hs * 0.014);
  corpo.closePath();
  ctx.lineWidth = Math.max(1, Hs * 0.008); ctx.strokeStyle = contorno; ctx.stroke(corpo);
  const gC = ctx.createLinearGradient(ox - lo, 0, ox + lo, 0);
  gC.addColorStop(0, azulLuz); gC.addColorStop(0.4, azul); gC.addColorStop(1, azulSombra);
  ctx.fillStyle = gC; ctx.fill(corpo);
  ctx.save(); ctx.clip(corpo);
  const yTronco = (f: number) => mix(oy, barra, f);
  ctx.strokeStyle = azulSombra; ctx.lineWidth = Math.max(1, Hs * 0.004);
  ctx.beginPath(); ctx.moveTo(ox - lo, yTronco(0.14)); ctx.quadraticCurveTo(ox, yTronco(0.17), ox + lo, yTronco(0.14)); ctx.stroke(); // pala
  ctx.beginPath(); ctx.moveTo(qx - lq * 0.5, yTronco(0.62)); ctx.lineTo(qx - lq * 0.5, barra); ctx.moveTo(qx + lq * 0.5, yTronco(0.62)); ctx.lineTo(qx + lq * 0.5, barra); ctx.stroke(); // pences
  const yf = yTronco(0.8), hf = Hs * 0.026 * (1 - 0.3 * p.curva);
  ctx.fillStyle = faixa; ctx.fillRect(ox - lo * 1.2, yf, lo * 2.4, hf);
  ctx.fillStyle = prata; ctx.fillRect(ox - lo * 1.2, yf + hf * 0.36, lo * 2.4, Math.max(1, hf * 0.28));
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(qx - lq * 1.2, barra - Hs * 0.012, lq * 2.4, Hs * 0.012); // barra da jaqueta
  desenharLogoRumo(ctx, (ox + qx) / 2 + (ox - qx) * 0.35, yTronco(0.37), lo * 1.25, 1 - 0.45 * p.curva, branco);
  ctx.restore();
  // gola
  ctx.fillStyle = azulSombra;
  ctx.beginPath(); ctx.ellipse(ox, oy - Hs * 0.008, Hs * 0.05, Hs * 0.017, 0, 0, 6.283); ctx.fill();

  // cabeça vista de trás: nuca, cabelo curto, abafador creme dos dois lados e o capacete com aba
  const cx = cab[0], cy = cab[1];
  // nuca e pescoço (pele), o cabelo curto só logo abaixo da aba
  ctx.fillStyle = peleSombra;
  ctx.beginPath(); ctx.roundRect(cx - Hs * 0.028, cy + Hs * 0.01, Hs * 0.056, Math.max(Hs * 0.02, oy - cy), Hs * 0.012); ctx.fill();
  ctx.fillStyle = pele;
  ctx.beginPath(); ctx.ellipse(cx, cy + Hs * 0.014, Hs * 0.046, Hs * 0.044, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(cx, cy + Hs * 0.05, Hs * 0.03, Hs * 0.01, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = cabelo;
  ctx.beginPath(); ctx.ellipse(cx, cy - Hs * 0.004, Hs * 0.047, Hs * 0.028, 0, 0, 6.283); ctx.fill();
  for (const lado of [-1, 1]) {
    const kx = cx + lado * Hs * 0.054, ky = cy + Hs * 0.012;
    ctx.strokeStyle = conchaArco; ctx.lineWidth = Math.max(1.5, Hs * 0.01);
    ctx.beginPath(); ctx.moveTo(kx, ky - Hs * 0.028); ctx.lineTo(kx - lado * Hs * 0.004, cy - Hs * 0.024); ctx.stroke();
    ctx.fillStyle = conchaS;
    ctx.beginPath(); ctx.ellipse(kx, ky, Hs * 0.022, Hs * 0.033, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = concha;
    ctx.beginPath(); ctx.ellipse(kx + lado * Hs * 0.004, ky - Hs * 0.002, Hs * 0.018, Hs * 0.029, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = conchaArco;
    ctx.fillRect(kx - Hs * 0.008, ky + Hs * 0.018, Hs * 0.016, Math.max(1, Hs * 0.005));
  }
  const casco = ctx.createLinearGradient(cx - Hs * 0.07, cy - Hs * 0.1, cx + Hs * 0.07, cy - Hs * 0.01);
  casco.addColorStop(0, cor(mq(capL))); casco.addColorStop(0.55, cor(mq(p.capacete))); casco.addColorStop(1, cor(mq(capS)));
  ctx.fillStyle = cor(mq(capS)); // aba que contorna o casco
  ctx.beginPath(); ctx.ellipse(cx, cy - Hs * 0.012, Hs * 0.084, Hs * 0.019, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = casco;
  ctx.beginPath(); ctx.ellipse(cx, cy - Hs * 0.016, Hs * 0.073, Hs * 0.07, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = cor(mq(capL)); ctx.lineWidth = Math.max(1, Hs * 0.01); // nervura do casco
  ctx.beginPath(); ctx.moveTo(cx, cy - Hs * 0.082); ctx.quadraticCurveTo(cx + Hs * 0.004, cy - Hs * 0.05, cx, cy - Hs * 0.02); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.beginPath(); ctx.ellipse(cx - Hs * 0.03, cy - Hs * 0.055, Hs * 0.018, Hs * 0.01, -0.5, 0, 6.283); ctx.fill();

  // braço esquerdo e, se não estiver no peito, o direito: por cima das costas
  braco(-1, p.maoE, p.alcE);
  if (p.dPeito <= 0.5) braco(1, p.maoD, p.alcD);
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
  // Abertura em plano contínuo: na primeira visita da sessão à tela inicial, o script do <head> marca o <html> com
  // data-intro. A "câmera" começa perto da Schlatter com o galpão escuro, as luzes acendem, o trilho chega com o
  // soldador no joystick e a solda acende o logo (data-cena="solda"); depois a câmera se afasta enquanto o logo sobe
  // para o lugar e o resto da tela entra (data-cena="recua"). Um toque pula para o fim.
  const raizHtml = document.documentElement;
  const cinema = completa && !reduzirMovimento() && raizHtml.hasAttribute('data-intro');
  // A primeira emenda chega na Schlatter em CHEGA; o centelhamento passa por SOLDA, junto com a emenda do logo.
  const CHEGA = cinema ? 1.6 : 0.55, SOLDA = CHEGA + 0.7;
  const CENA = { solda: SOLDA - 1.15, recua0: SOLDA + 1.1, recua1: SOLDA + 2.5, fim: SOLDA + 3.3 };
  let estagio = '';
  let pulo = 0;
  const encerrarIntro = () => { raizHtml.removeAttribute('data-intro'); raizHtml.removeAttribute('data-cena'); };
  const pular = () => { if (estagio !== 'fim') pulo = Math.max(pulo, CENA.recua1 - ultimoTCena); };
  let ultimoTCena = 0;
  if (cinema) {
    // posição do logo na tela inicial: o logo começa no meio da tela, maior, e sobe até ali
    const logo = (cv.closest('main') ?? document).querySelector('.logo-animada');
    if (logo) {
      const r = logo.getBoundingClientRect();
      const ty = new DOMMatrix(getComputedStyle(logo).transform === 'none' ? undefined : getComputedStyle(logo).transform).m42;
      const centro = r.top + r.height / 2 - ty;
      raizHtml.style.setProperty('--intro-dy', `${Math.round(window.innerHeight * 0.3 - centro)}px`);
    }
    window.addEventListener('pointerdown', pular, { once: true });
    window.addEventListener('keydown', pular, { once: true });
  }
  // Ciclo de cada emenda (s desde que ela parou dentro da Schlatter), como no estaleiro:
  // o soldador solta o joystick, vai até a portinhola e fecha a grade com a mão direita, volta ao painel e aperta a
  // solda; as garras descem, centelha, recalca, sobem; ele volta, abre a grade, pega a espátula no gancho e raspa a
  // borra (a casca em volta da solda) pela janelinha. Guarda a espátula, volta ao painel e empurra o joystick para a
  // esquerda: a barra anda até a régua, onde o segundo operário confere o alinhamento; depois mais um empurrão leva a
  // próxima emenda para dentro da máquina.
  // A cada duas soldas (emendas ímpares) entra a limpeza depois da raspagem: a porta amarela abre sozinha, ele pega a
  // pá no guarda-corpo, puxa a borra com a espátula para dentro da pá, despeja na caçamba amarela, devolve a pá e a
  // porta fecha. Os tempos são relativos ao fim da raspagem; o que vem depois anda DL segundos.
  // (os passos do soldador na limpeza estão junto do desenho dele; aqui, só a porta)
  const PORTA = { abre0: 0.3, abre1: 1.1, fecha0: 6.6, fecha1: 7.4 };
  const DL = 6.5;
  const limpaNa = (k: number) => k % 2 === 1;
  const FB = {
    solta: 0.15, vaiJan: 0.25, chegaJan: 0.75, gradeFecha0: 0.8, gradeFecha1: 1.35,
    voltaCtrl0: 1.4, voltaCtrl1: 1.9, botao0: 1.95, botao1: 2.25,
    garraIni: 2.3, garra: 2.6, centelha: 4.0, recalque: 4.2, rebarba: 4.5, sobe: 4.8,
    vaiJan2: 4.9, chegaJan2: 5.4, gradeAbre0: 5.45, gradeAbre1: 6.0,
    pega0: 6.05, pega1: 6.55, raspa0: 6.6, raspa1: 9.3, guarda0: 9.35, guarda1: 9.85,
    voltaCtrl2: 9.9, chegaCtrl2: 10.4,
    moveA0: 10.55, moveA1: 12.0,
    regua0: 12.15, regua1: 15.5,
    moveB0: 15.7, moveB1: 18.4, fim: 18.6,
  };
  // F é o ciclo da emenda atual (com a limpeza, guardar a espátula e tudo depois anda DL segundos)
  const F = { ...FB };
  const DEPOIS = ['guarda0', 'guarda1', 'voltaCtrl2', 'chegaCtrl2', 'moveA0', 'moveA1', 'regua0', 'regua1', 'moveB0', 'moveB1', 'fim'] as const;
  const ajustarCiclo = (k: number) => { const d = limpaNa(k) ? DL : 0; for (const c of DEPOIS) F[c] = FB[c] + d; };
  const fimDe = (k: number) => FB.fim + (limpaNa(k) ? DL : 0);
  let cacamba = 0.35; // quanto de borra já tem na caçamba (0 a 1)
  let cicloK = 0;
  let cicloInicio = CHEGA - FB.voltaCtrl1; // na abertura ele já fechou a grade e está chegando no painel
  let ciclo: { k: number; inicio: number } | null = null;
  const fumaca: { x: number; y: number; r: number; v: number }[] = [];
  let frente: HTMLCanvasElement | null = null; // frente da máquina desenhada uma vez e reaproveitada
  let chaveFrente = '';
  let portaCache: HTMLCanvasElement | null = null;
  let chavePortaCache = '';
  const faiscas: Faisca[] = [];
  const brasas: { x: number; y: number; vy: number; vx: number; v: number }[] = [];
  // pedaços da borra que a espátula solta e caem pela janelinha
  // (chao: onde o pedaço para; os da pá param no monte da caçamba e somem dentro dela)
  const cascas: { x: number; y: number; vx: number; vy: number; r: number; v: number; giro: number; quente: number; chao?: number }[] = [];
  let soldouLogo = false;
  let camera: { Z: number; ax: number; ay: number; fx: number; fy: number } | null = null;
  let roloApertado = false;
  const sopros: { x: number; y: number; vx: number; vy: number; r: number; v: number }[] = [];
  // borda esquerda dos cartões da tela inicial (em px do canvas), medida de vez em quando
  let cartoesX: number | null = null, cartoesEm = -9, cartoesW = 0;
  const medirCartoes = (): number | null => {
    const el = cv.closest('main')?.querySelector('.home-grade, .home-conteudo');
    if (!el) return null;
    const r = el.getBoundingClientRect(), c = cv.getBoundingClientRect();
    return r.width ? r.left - c.left - 12 : null;
  };

  // Emendas: k = 0 é a que chega no meio na abertura. Guarda quando cada uma foi soldada (s).
  const soldada = new Map<number, number>();
  if (!completa) for (let k = -6; k < 0; k++) soldada.set(k, -60);
  if (reduzirMovimento()) for (let k = -6; k <= 6; k++) soldada.set(k, -60);
  let u = 0; // quanto o trilho andou desde que a emenda 0 ficou no meio (px)
  let uAntes: number | null = null;
  let vel = 0;
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


  const controle = laco(cv, 2, () => { pal = paletaAbertura(caixa); padrao = null; }, (ctx, W, H, tReal, dt) => {
    const t = tReal + pulo;
    ultimoTCena = tReal;
    if (cinema) {
      const novo = t >= CENA.fim ? 'fim' : t >= CENA.recua0 ? 'recua' : t >= CENA.solda ? 'solda' : '';
      if (novo !== estagio) {
        estagio = novo;
        if (novo === 'fim') encerrarIntro();
        else if (novo) raizHtml.setAttribute('data-cena', novo);
      }
    }
    const escuro = pal.estrelas > 0;
    const xc = W / 2;
    // Escala de verdade: a máquina (2,6 m de altura) ocupa cerca de 30% da altura da tela; o soldador tem 1,75 m.
    // O perfil (TR68, 186 mm) sai só um pouco maior que o real (23 cm), para continuar lendo como trilho.
    // No celular a máquina fica menor e embaixo de tudo (a tela inicial e o login reservam esse espaço no CSS).
    const M = W < 600 ? Math.max(34, Math.min(50, W / 9)) : Math.max(40, Math.min(H * 0.115, W / 11)); // um metro
    const R = 0.23 * M; // altura do perfil
    const L = 12 * M; // uma barra de 12 m
    const piso = H * 0.95;
    const topo = piso - 1.05 * M; // o trilho corre a cerca de 1,05 m do chão (altura da cintura), sobre os roletes
    const rr = 0.1 * M; // rolete de 20 cm

    // Schlatter à direita no computador (fora dos cartões); no celular, mais para a direita também.
    // máquina à direita, com espaço para a caçamba amarela do lado direito dela
    const xm = Math.min(W >= 900 ? W * 0.79 : W * 0.58, W - 3.35 * M);
    // estação da régua depois da máquina (o trilho anda para a esquerda). Na tela inicial do computador ela vai para o
    // espaço livre à esquerda dos cartões; no resto, a 2,8 m da máquina.
    if (t - cartoesEm > 0.5 || cartoesW !== W) { cartoesEm = t; cartoesW = W; cartoesX = medirCartoes(); }
    let xR = xm - 2.8 * M;
    if (W >= 900 && cartoesX !== null) xR = Math.max(1.6 * M, Math.min(xm - 2.8 * M, cartoesX / 2));
    const d1 = xm - xR;

    // ---------- movimento do trilho e ciclo da solda ----------
    // O trilho só anda enquanto o soldador segura o joystick do painel: um empurrão leva a emenda soldada até a
    // régua (d1), outro leva a próxima emenda para dentro da máquina (o resto da barra de 12 m).
    if (!parado) while (t - cicloInicio >= fimDe(cicloK)) { cicloInicio += fimDe(cicloK); cicloK++; }
    const fase = parado ? 7.6 : t - cicloInicio;
    const kAtual = parado ? 0 : cicloK;
    ajustarCiclo(kAtual);
    const limpa = !parado && limpaNa(kAtual);
    const lf = fase - FB.raspa1; // tempo dentro da limpeza
    if (!parado && t < CHEGA) {
      // abertura: o trilho entra pela direita e freia com a emenda 0 dentro da máquina
      const D = completa ? W * 0.95 : W * 0.35;
      const e = 1 - Math.pow(1 - t / CHEGA, 3);
      u = -D * (1 - e);
    } else {
      u = kAtual * L + d1 * suave(F.moveA0, F.moveA1, fase) + (L - d1) * suave(F.moveB0, F.moveB1, fase);
    }
    vel = uAntes === null || dt <= 0 ? 0 : (u - uAntes) / dt;
    uAntes = u;
    ciclo = { k: kAtual, inicio: cicloInicio };
    if (fase >= F.centelha && !soldada.has(kAtual)) soldada.set(kAtual, cicloInicio + F.centelha);
    // centelhamento: chuva de faíscas saindo da fresta para os dois lados
    const centelhando = !parado && ciclo !== null && fase > F.garra && fase < F.centelha;
    const forcaCentelha = centelhando ? suave(F.garra, F.garra + 0.3, fase) * (0.75 + 0.25 * Math.sin(t * 40)) : 0;
    if (centelhando) {
      // a porta está fechada: as faíscas escapam pelas frestas de baixo e da borda esquerda
      const n = Math.round(170 * dt * forcaCentelha + Math.random() * 0.6);
      const mWL = xm - 0.6 * M, mWB = topo + R + 0.2 * M, mWT = topo - 0.45 * M;
      for (let i = 0; i < n; i++) {
        if (Math.random() < 0.6) {
          faiscas.push({ x: mWL + Math.random() * 1.2 * M, y: mWB, vx: (Math.random() - 0.5) * 160, vy: 30 + Math.random() * 80, v: 0.25 + Math.random() * 0.35 });
        } else {
          faiscas.push({ x: mWL - 1, y: mWT + Math.random() * (mWB - mWT), vx: -(80 + Math.random() * 260), vy: -(20 + Math.random() * 160), v: 0.25 + Math.random() * 0.4 });
        }
      }
      // a Schlatter é aberta dos lados, onde o trilho entra e sai: ali vaza bastante faísca, em leque, para fora
      const nLado = Math.round(420 * dt * forcaCentelha + Math.random() * 0.6);
      for (let i = 0; i < nLado; i++) {
        const esq = Math.random() < 0.5;
        const x0 = esq ? xm - 1.8 * M + 2 : xm + 1.8 * M - 2;
        const y0 = topo - 0.25 * M + Math.random() * (R + 0.45 * M);
        const vx = (esq ? -1 : 1) * (140 + Math.random() * 420);
        faiscas.push({ x: x0, y: y0, vx, vy: -(Math.random() * 300) + 40, v: 0.35 + Math.random() * 0.5 });
      }
      // e um pouco pela grade da janelinha, entre as barras
      const jg = JANELINHA(M);
      const gx = xm - 0.6 * M + jg.abX, gy = piso - 2.6 * M + jg.y;
      const nGrade = Math.round(45 * dt * forcaCentelha + Math.random() * 0.3);
      for (let i = 0; i < nGrade; i++) {
        faiscas.push({ x: gx + Math.random() * jg.abW, y: gy + Math.random() * jg.h, vx: (Math.random() - 0.3) * 160, vy: -(Math.random() * 120), v: 0.2 + Math.random() * 0.3 });
      }
    }
    // garras: 0 em cima, 1 apertando o trilho
    const garra = !ciclo ? 0 : fase < F.garra ? suave(F.garraIni, F.garra, fase) : fase < F.rebarba ? 1 : 1 - suave(F.rebarba, F.sobe, fase);
    ultimoT = t;

    // ---------- câmera da abertura: começa perto da máquina e se afasta até o quadro normal ----------
    const kCam = cinema ? suave(CENA.recua0, CENA.recua1, t) : 1;
    if (kCam < 1) {
      const Z = mix(W < 600 ? 1.75 : 1.9, 1, kCam);
      const fx = xm, fy = piso - 1.2 * M;
      // no celular a página é mais alta que a tela: mira a parte do canvas que está visível
      const Hv = Math.max(H * 0.3, Math.min(H, window.innerHeight - cv.getBoundingClientRect().top));
      const axZ = Math.min(Math.max(W * 0.5, W - Z * (W - fx)), Z * fx);
      const ayZ = Math.max(Hv * 0.74, Hv - Z * (H - fy));
      const ax = mix(axZ, fx, kCam), ay = mix(ayZ, fy, kCam);
      ctx.fillStyle = cor(pal.ceuTopo);
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(ax, ay); ctx.scale(Z, Z); ctx.translate(-fx, -fy);
      camera = { Z, ax, ay, fx, fy };
    } else camera = null;

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
      // começa depois da estação da régua e para antes da máquina (no celular, onde não cabe, não aparece)
      const pL = xR + 1.55 * M, pR = Math.min(pL + 3.6 * M, xm - 2.1 * M);
      const hb = Math.max(4, 0.16 * M), calco = Math.max(2, 0.06 * M);
      const corBarra = misturar(pal.acoLado, pal.ceuHorizonte, 0.45), corCalco = misturar([120, 80, 50], pal.ceuHorizonte, 0.5);
      if (pR - pL > 1.5 * M)
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

    // ---------- estação da régua (atrás do trilho): tela de arame, pés de trás dos portais e o bloco amarelo "01" ----------
    const amarelo = (c: RGB): string => cor(escuro ? misturar(c, pal.ceuTopo, 0.3) : c);
    const AM: RGB = [236, 186, 36], AM_S: RGB = [176, 132, 18], AM_L: RGB = [252, 214, 90];
    const portais = [xR - 0.85 * M, xR + 0.78 * M];
    const x01 = xR - 2.15 * M, w01 = 0.8 * M; // rolo opressor "01", antes da régua: é ele que dá tração ao trilho
    // Rolo opressor: só tem o rolo de baixo (motriz). Quando o soldador empurra o joystick, os cilindros descem a
    // sapata contra o boleto (sopro de ar na válvula), o motor gira o rolo de baixo e o trilho anda; soltou, o motor
    // para e os cilindros sobem com outro sopro.
    const apertoEm = (a: number, b: number) => suave(a - 0.4, a - 0.1, fase) * (1 - suave(b + 0.05, b + 0.35, fase));
    const aperto = parado ? 0 : Math.max(1 - suave(CHEGA + 0.05, CHEGA + 0.35, t), apertoEm(F.moveA0, F.moveA1), apertoEm(F.moveB0, F.moveB1));
    if (!parado && (aperto > 0.5) !== roloApertado) {
      roloApertado = aperto > 0.5;
      for (let i = 0; i < 7; i++) sopros.push({ x: x01 + w01 * (0.25 + Math.random() * 0.5), y: topo - 0.72 * M, vx: (Math.random() - 0.5) * 0.6 * M, vy: -(0.1 + Math.random() * 0.3) * M, r: 0.03 * M, v: 1 });
    }
    const xRolo = x01 + w01 / 2, rRolo = 0.12 * M, girou = u / rRolo;
    {
      // tela de arame de proteção ao fundo
      const tL = xR - 1.5 * M, tR = xR + 1.45 * M, tT = piso - 1.7 * M;
      ctx.strokeStyle = cor(misturar(pal.acoLado, pal.ceuTopo, 0.5), 0.35); ctx.lineWidth = 1;
      ctx.beginPath();
      const pt = Math.max(4, 0.07 * M);
      for (let x = tL; x <= tR; x += pt) { ctx.moveTo(x, tT); ctx.lineTo(x, piso); }
      for (let y = tT; y <= piso; y += pt) { ctx.moveTo(tL, y); ctx.lineTo(tR, y); }
      ctx.stroke();
      ctx.fillStyle = cor(misturar(pal.acoLado, pal.ceuTopo, 0.55));
      for (const x of [tL, (tL + tR) / 2, tR]) ctx.fillRect(x - 0.02 * M, tT, 0.04 * M, piso - tT);
      ctx.fillRect(tL, tT, tR - tL, 0.03 * M);
      // pés de trás dos portais (do outro lado do trilho)
      for (const px of portais) {
        ctx.fillStyle = amarelo(AM_S);
        ctx.fillRect(px + 0.12 * M, piso - 1.5 * M, 0.06 * M, 1.5 * M - 0.06 * M);
      }
      // bloco amarelo da "01", embaixo do trilho
      if (x01 + w01 > 0) {
        const gb = ctx.createLinearGradient(x01, 0, x01 + w01, 0);
        gb.addColorStop(0, amarelo(AM_L)); gb.addColorStop(1, amarelo(AM_S));
        ctx.fillStyle = gb;
        ctx.fillRect(x01, topo + R, w01, piso - topo - R);
        ctx.fillStyle = amarelo(AM_S);
        ctx.fillRect(x01 - 0.05 * M, piso - 0.12 * M, w01 + 0.1 * M, 0.12 * M);
        ctx.fillStyle = 'rgba(20,20,20,.85)';
        ctx.font = `700 ${0.26 * M}px ${fonte('--font-barlow-cond', '"Barlow Condensed", "Arial Narrow", sans-serif')}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('01', x01 + w01 * 0.5, (topo + R + piso) / 2);
        ctx.textAlign = 'left';
        // rolo de baixo (motriz), logo embaixo do patim, girando com o trilho
        const yRb = topo + R + rRolo * 0.92;
        ctx.fillStyle = 'rgb(56,58,64)';
        ctx.beginPath(); ctx.arc(xRolo, yRb, rRolo, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgb(150,154,162)'; ctx.lineWidth = Math.max(1, 0.018 * M);
        for (let k = 0; k < 4; k++) {
          const a = -girou + (k * Math.PI) / 2;
          ctx.beginPath(); ctx.moveTo(xRolo + Math.cos(a) * rRolo * 0.25, yRb + Math.sin(a) * rRolo * 0.25); ctx.lineTo(xRolo + Math.cos(a) * rRolo * 0.85, yRb + Math.sin(a) * rRolo * 0.85); ctx.stroke();
        }
        ctx.fillStyle = 'rgb(200,204,210)';
        ctx.beginPath(); ctx.arc(xRolo, yRb, rRolo * 0.2, 0, 6.283); ctx.fill();
        // motor e redutor ao lado
        ctx.fillStyle = cor(misturar([120, 124, 130], pal.ceuTopo, escuro ? 0.3 : 0));
        ctx.beginPath(); ctx.ellipse(x01 - 0.18 * M, piso - 0.42 * M, 0.2 * M, 0.17 * M, 0, 0, 6.283); ctx.fill();
        // tampa da ventoinha do motor: as aletas giram enquanto ele puxa
        ctx.strokeStyle = 'rgba(40,42,46,.7)'; ctx.lineWidth = Math.max(1, 0.012 * M);
        for (let k = 0; k < 6; k++) {
          const a = -girou * 3 + (k * Math.PI) / 3;
          ctx.beginPath(); ctx.moveTo(x01 - 0.3 * M, piso - 0.42 * M); ctx.lineTo(x01 - 0.3 * M + Math.cos(a) * 0.07 * M, piso - 0.42 * M + Math.sin(a) * 0.12 * M); ctx.stroke();
        }
        // lâmpada verde do "01": acesa enquanto o rolo está apertado
        const lx01 = x01 + w01 * 0.85, ly01 = topo + R + 0.12 * M;
        if (aperto > 0.5) {
          const gl = ctx.createRadialGradient(lx01, ly01, 0, lx01, ly01, 0.12 * M);
          gl.addColorStop(0, 'rgba(90,230,120,.55)'); gl.addColorStop(1, 'rgba(90,230,120,0)');
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx01, ly01, 0.12 * M, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = aperto > 0.5 ? 'rgb(110,240,140)' : 'rgb(40,90,56)';
        ctx.beginPath(); ctx.arc(lx01, ly01, 0.03 * M, 0, 6.283); ctx.fill();
        ctx.fillStyle = amarelo(AM);
        ctx.fillRect(x01 - 0.06 * M, piso - 0.6 * M, 0.1 * M, 0.36 * M);
      }
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

    // emendas e a marcação de caneta de tinta na alma de cada barra: S-01, S-02... (a S-01 é a que já está
    // passando pela máquina na abertura; as barras de antes ficam sem número)
    const kMin = Math.floor((u - xm) / L) - 1, kMax = Math.ceil((u + W - xm) / L) + 1;
    const hMarca = Math.max(7, R * 0.52);
    for (let k = kMin; k <= kMax; k++) {
      const x = xm + k * L - u;
      const nBarra = k + 2;
      const xg = x + L * 0.42;
      if (nBarra >= 1 && xg > -100 && xg < W + 100) {
        const marca = marcaCaneta(`S-${String(nBarra).padStart(2, '0')}`, nBarra);
        desenharMarcaCaneta(ctx, marca, xg - (marca.largura * hMarca) / 2, topo + R * 0.55 - hMarca / 2, hMarca, escuro ? 0.62 : 0.9);
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
      // rebordo do recalque (a borra): aparece na hora e sai com a espátula do soldador
      const rebordo = idade < F.recalque - F.centelha ? 1 : 1 - suave(F.raspa0 - F.centelha, F.raspa1 - F.centelha, idade);
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

    // ---------- estação da régua (na frente do trilho): portais de tubo amarelo, cilindros da "01" e faixa zebrada ----------
    {
      // faixa zebrada no chão entre os portais
      const zL = portais[0] - 0.1 * M, zR = portais[1] + 0.25 * M, zY = piso + 2, zH = Math.max(4, 0.11 * M);
      ctx.save();
      ctx.beginPath(); ctx.rect(zL, zY, zR - zL, zH); ctx.clip();
      ctx.fillStyle = amarelo(AM); ctx.fillRect(zL, zY, zR - zL, zH);
      ctx.fillStyle = 'rgba(18,18,20,.9)';
      for (let x = zL - zH; x < zR + zH; x += zH * 1.6) {
        ctx.beginPath(); ctx.moveTo(x, zY + zH); ctx.lineTo(x + zH * 0.8, zY + zH); ctx.lineTo(x + zH * 1.6, zY); ctx.lineTo(x + zH * 0.8, zY); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // portais: o pé da frente, a travessa de cima indo para trás e a base
      for (const px of portais) {
        const tw = 0.065 * M, alto = piso - 1.45 * M;
        ctx.fillStyle = amarelo(AM_S);
        ctx.beginPath(); ctx.moveTo(px, alto); ctx.lineTo(px + 0.18 * M, alto - 0.05 * M); ctx.lineTo(px + 0.18 * M, alto - 0.05 * M + tw); ctx.lineTo(px + tw, alto + tw); ctx.closePath(); ctx.fill();
        const gp = ctx.createLinearGradient(px, 0, px + tw, 0);
        gp.addColorStop(0, amarelo(AM_L)); gp.addColorStop(1, amarelo(AM_S));
        ctx.fillStyle = gp;
        ctx.fillRect(px, alto, tw, piso - alto);
        ctx.fillStyle = amarelo(AM);
        ctx.fillRect(px - 0.04 * M, piso - 0.03 * M, tw + 0.08 * M, 0.03 * M);
        // chapa preta inclinada (calha) presa no portal, como na foto
        ctx.fillStyle = 'rgba(22,22,26,.92)';
        const lado = px < xR ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(px + tw / 2, topo - 0.42 * M); ctx.lineTo(px + tw / 2 + lado * 0.05 * M, topo - 0.46 * M);
        ctx.lineTo(px + tw / 2 + lado * 0.42 * M, piso - 0.45 * M); ctx.lineTo(px + tw / 2 + lado * 0.36 * M, piso - 0.42 * M);
        ctx.closePath(); ctx.fill();
      }
      // "01": travessa de cima com os dois cilindros pneumáticos descendo até o boleto
      if (x01 + w01 > 0) {
        const yb = topo - 0.62 * M;
        ctx.fillStyle = amarelo(AM_S);
        ctx.fillRect(x01 - 0.02 * M, yb, 0.08 * M, topo - yb);
        ctx.fillStyle = amarelo(AM);
        ctx.fillRect(x01 - 0.05 * M, yb - 0.1 * M, w01 + 0.1 * M, 0.12 * M);
        // sapata de pressão (sem rolo em cima): encosta no boleto quando aperta, 8 cm acima quando solta. Ela segura
        // o trilho contra o rolo de baixo, que é o que dá a tração.
        const ySap = topo - R * 0.06 - 0.05 * M - 0.08 * M * (1 - aperto);
        for (const cx of [x01 + w01 * 0.18, x01 + w01 * 0.82]) {
          const gc = ctx.createLinearGradient(cx - 0.06 * M, 0, cx + 0.06 * M, 0);
          gc.addColorStop(0, 'rgb(150,154,160)'); gc.addColorStop(0.45, 'rgb(232,234,238)'); gc.addColorStop(1, 'rgb(120,124,130)');
          ctx.fillStyle = gc;
          ctx.fillRect(cx - 0.06 * M, yb + 0.02 * M, 0.12 * M, 0.26 * M);
          ctx.fillStyle = 'rgb(196,200,206)'; // haste, que estica quando o cilindro desce
          ctx.fillRect(cx - 0.018 * M, yb + 0.28 * M, 0.036 * M, Math.max(0, ySap - yb - 0.28 * M));
        }
        ctx.fillStyle = amarelo(AM);
        ctx.fillRect(x01 + w01 * 0.1, ySap - 0.02 * M, w01 * 0.8, 0.05 * M);
        ctx.fillStyle = 'rgb(44,46,52)'; // face de borracha que encosta no boleto
        ctx.fillRect(x01 + w01 * 0.14, ySap + 0.03 * M, w01 * 0.72, 0.02 * M);
        // válvula com o sopro de ar quando os cilindros mexem
        ctx.fillStyle = 'rgb(60,64,72)';
        ctx.fillRect(x01 + w01 * 0.45, yb - 0.16 * M, 0.1 * M, 0.07 * M);
      }
      for (const b of sopros) { b.x += b.vx * dt; b.y += b.vy * dt; b.r += dt * 0.25 * M; b.v -= dt * 1.6; }
      for (let i = sopros.length - 1; i >= 0; i--) if (sopros[i].v <= 0) sopros.splice(i, 1);
      for (const b of sopros) {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(235,240,245,${0.35 * b.v})`); g.addColorStop(1, 'rgba(235,240,245,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
      }
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
      // borra raspada no fundo da máquina, embaixo da emenda: aparece quando a porta abre e vai para a pá
      const wB0 = topo + R + 0.2 * M;
      const resta = limpa && lf > 0 ? 1 - suave(2.9, 4.2, lf) : 0;
      if (resta > 0.02) {
        ctx.fillStyle = 'rgb(54,46,40)';
        const n = Math.ceil(16 * resta);
        for (let i = 0; i < n; i++) {
          const f = i / 16;
          const x = xm - 0.45 * M + f * 0.55 * M + Math.sin(i * 7.1) * 0.03 * M;
          ctx.beginPath(); ctx.ellipse(x, wB0 - 0.03 * M - Math.abs(Math.sin(i * 3.3)) * 0.035 * M, 0.035 * M, 0.022 * M, i, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,140,60,.5)';
        for (let i = 0; i < n; i += 4) { ctx.beginPath(); ctx.arc(xm - 0.42 * M + (i / 16) * 0.55 * M, wB0 - 0.04 * M, 0.01 * M, 0, 6.283); ctx.fill(); }
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

      // posições do ciclo: grade da portinhola (0 aberta, 1 fechada). A porta grande fica fechada: o soldador
      // trabalha pela portinhola.
      const gradeDesce = parado ? 0 : t < CHEGA ? 1 : suave(F.gradeFecha0, F.gradeFecha1, fase) - suave(F.gradeAbre0, F.gradeAbre1, fase);
      const portaFecha = limpa ? 1 - (suave(PORTA.abre0, PORTA.abre1, lf) - suave(PORTA.fecha0, PORTA.fecha1, lf)) : 1;
      const soldando = !parado && fase >= F.botao1 && fase < F.sobe;

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
      // a máquina é aberta dos lados (por onde o trilho passa): o clarão da solda sai por ali
      if (forcaCentelha > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const lx of [mL, mR]) {
          const ly = topo + R * 0.5;
          const gl = ctx.createRadialGradient(lx, ly, 0, lx, ly, 0.9 * M);
          gl.addColorStop(0, `rgba(255,200,120,${0.55 * forcaCentelha})`);
          gl.addColorStop(0.4, `rgba(255,140,50,${0.22 * forcaCentelha})`);
          gl.addColorStop(1, 'rgba(255,110,30,0)');
          ctx.fillStyle = gl;
          ctx.fillRect(lx - 0.9 * M, ly - 0.9 * M, 1.8 * M, 1.8 * M);
        }
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
      // Grade da janelinha como persiana: a moldura fica parada e as barras ("facas") giram juntas, cada uma no próprio
      // eixo. Fechada, a parte larga fica de frente e as barras se encostam, tampando a janelinha; aberta, ficam de lado
      // (vistas pelo fio) e dá para olhar a solda entre elas. O soldador vira as barras pela alavanca da lateral direita.
      const giro = (1 - gradeDesce) * Math.PI / 2; // 0 de frente (fechada), 90° de lado (aberta)
      const cg = Math.cos(giro), sg = Math.sin(giro);
      const nBarras = 6, passoB = jn.h / nBarras;
      const fio = Math.max(1.5, 0.014 * M); // espessura da barra, vista quando ela está de lado
      for (let i = 0; i < nBarras; i++) {
        const yc = abY + (i + 0.5) * passoB;
        const meia = (passoB / 2) * 1.04 * cg; // face larga encurtando conforme gira
        const tom = misturar([222, 212, 186], [120, 112, 92], 0.55 * sg);
        if (meia > 0.4) {
          const face = ctx.createLinearGradient(0, yc - meia, 0, yc + meia);
          face.addColorStop(0, cor(mq(misturar(tom, [255, 250, 236], 0.25))));
          face.addColorStop(1, cor(mq(misturar(tom, [90, 84, 70], 0.25))));
          ctx.fillStyle = face;
          ctx.fillRect(abX, yc - meia, jn.abW, meia * 2);
        }
        // o fio da barra (a borda) aparece embaixo quando ela vira
        const borda = Math.max(sg * fio, 0.6);
        ctx.fillStyle = cor(mq([176, 166, 140]));
        ctx.fillRect(abX, yc + meia - borda * 0.5, jn.abW, borda);
      }
      // laterais da moldura com os pinos das barras
      const lateral = Math.max(2, 0.03 * M);
      ctx.fillStyle = cor(mq([214, 204, 176]));
      ctx.fillRect(abX - lateral * 0.6, abY - 0.01 * M, lateral, jn.h + 0.02 * M);
      ctx.fillRect(abX + jn.abW - lateral * 0.4, abY - 0.01 * M, lateral, jn.h + 0.02 * M);
      ctx.fillStyle = 'rgb(60,62,66)';
      for (let i = 0; i < nBarras; i++) {
        const yc = abY + (i + 0.5) * passoB;
        ctx.beginPath(); ctx.arc(abX - lateral * 0.1, yc, Math.max(1, 0.008 * M), 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(abX + jn.abW + lateral * 0.1, yc, Math.max(1, 0.008 * M), 0, 6.283); ctx.fill();
      }
      // alavanca na lateral direita: para baixo com a grade fechada, deitada para a direita com ela aberta
      const piv: [number, number] = [abX + jn.abW + lateral * 0.6, abY + jn.h * 0.5];
      const angAl = (Math.PI / 2) * gradeDesce;
      const compAl = 0.17 * M;
      const ponta: [number, number] = [piv[0] + Math.cos(angAl) * compAl, piv[1] + Math.sin(angAl) * compAl];
      ctx.strokeStyle = 'rgb(28,30,34)'; ctx.lineWidth = Math.max(2, 0.022 * M); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(piv[0], piv[1]); ctx.lineTo(ponta[0], ponta[1]); ctx.stroke();
      ctx.fillStyle = 'rgb(200,50,40)';
      ctx.beginPath(); ctx.arc(ponta[0], ponta[1], Math.max(2, 0.022 * M), 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgb(40,42,46)';
      ctx.beginPath(); ctx.arc(piv[0], piv[1], Math.max(1.5, 0.016 * M), 0, 6.283); ctx.fill();
      const puxador: [number, number] = ponta;

      // painel de comando: lâmpada verde (pronta), laranja piscando enquanto solda, e o joystick que faz a barra andar
      const pn = PAINEL(M, wL, mT);
      for (const [[lx, ly], c, acesa] of [[pn.lampLaranja, [255, 150, 40], soldando && Math.sin(t * 12) > 0], [pn.lampVerde, [90, 230, 120], !soldando]] as [[number, number], RGB, boolean][]) {
        ctx.fillStyle = 'rgb(50,52,58)';
        ctx.fillRect(lx - 0.035 * M, ly + 0.02 * M, 0.07 * M, 0.025 * M);
        if (acesa) {
          const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 0.14 * M);
          g.addColorStop(0, cor(c, 0.55)); g.addColorStop(1, cor(c, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 0.14 * M, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = cor(acesa ? c : misturar(c, [0, 0, 0], 0.55));
        ctx.beginPath(); ctx.arc(lx, ly + 0.02 * M, 0.035 * M, Math.PI, 0); ctx.fill();
        ctx.fillRect(lx - 0.035 * M, ly + 0.02 * M, 0.07 * M, 0.004 * M + 1);
      }
      // segura o joystick para a esquerda enquanto a barra anda (na abertura também)
      const tira = (a: number, b: number) => suave(a - 0.15, a + 0.05, fase) * (1 - suave(b, b + 0.2, fase));
      const empurra = parado ? 0 : Math.max(1 - suave(CHEGA - 0.05, CHEGA + 0.1, t),
        suave(F.moveA0 - 0.1, F.moveA0 + 0.04, fase) * (1 - suave(F.moveA1 - 0.08, F.moveA1 + 0.06, fase)),
        suave(F.moveB0 - 0.1, F.moveB0 + 0.04, fase) * (1 - suave(F.moveB1 - 0.08, F.moveB1 + 0.06, fase)));
      const segura = parado ? 0 : Math.max(1 - suave(CHEGA, CHEGA + 0.3, t), tira(F.moveA0 - 0.1, F.moveA1), tira(F.moveB0 - 0.1, F.moveB1), 1 - suave(0, F.solta + 0.1, fase));
      const angJ = -0.55 * empurra, compJ = 0.11 * M;
      const manopla: [number, number] = [pn.jx + Math.sin(angJ) * compJ, pn.jy - Math.cos(angJ) * compJ];
      ctx.strokeStyle = 'rgb(24,24,28)'; ctx.lineWidth = Math.max(2, 0.022 * M); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pn.jx, pn.jy); ctx.lineTo(manopla[0], manopla[1]); ctx.stroke();
      ctx.fillStyle = 'rgb(20,20,24)';
      ctx.beginPath(); ctx.arc(manopla[0], manopla[1], Math.max(2.5, 0.03 * M), 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.arc(manopla[0] - 0.01 * M, manopla[1] - 0.01 * M, Math.max(1, 0.01 * M), 0, 6.283); ctx.fill();
      // a tecla da solda acende quando ele aperta
      const noBotao = parado ? 0 : tira(F.botao0, F.botao1);
      if (noBotao > 0.6) {
        ctx.fillStyle = 'rgba(170,255,120,.9)';
        ctx.fillRect(pn.botao[0] - 0.02 * M, pn.botao[1] - 0.015 * M, 0.04 * M, 0.03 * M);
      }

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

      // ---------- o soldador: painel, portinhola, espátula ----------
      const Hs = 1.75 * M;
      const posCtrl = wL + 0.12 * M, posJan = wL + 1.38 * M;
      const ombroY = piso - 0.82 * Hs;
      const vai = (a: number, b: number) => suave(a, b, fase);
      const naJanela = parado ? 1 : t < CHEGA ? 0 : vai(F.vaiJan, F.chegaJan) - vai(F.voltaCtrl0, F.voltaCtrl1) + vai(F.vaiJan2, F.chegaJan2) - vai(F.voltaCtrl2, F.chegaCtrl2);
      const andaS = !parado && t >= CHEGA && [[F.vaiJan, F.chegaJan], [F.voltaCtrl0, F.voltaCtrl1], [F.vaiJan2, F.chegaJan2], [F.voltaCtrl2, F.chegaCtrl2]].some(([a, b]) => fase > a && fase < b) ? 1 : 0;
      // espátula: 0 no gancho da porta, 1 nas mãos, enfiada pela janelinha
      const comVara = parado ? 1 : vai(F.pega0, F.pega1) * (1 - vai(F.guarda0, F.guarda1));
      const entra = parado ? 1 : vai(F.pega1 - 0.1, F.raspa0 + 0.15) * (1 - vai(F.raspa1 - 0.05, limpa ? F.raspa1 + 0.3 : F.guarda0 + 0.15));
      const raspando = parado ? 1 : vai(F.raspa0, F.raspa0 + 0.25) * (1 - vai(F.raspa1 - 0.3, F.raspa1));
      const curso = parado ? 0.03 * M : 0.1 * M * Math.sin((fase - F.raspa0) * Math.PI * 2 * 1.4) * raspando;

      // ---------- limpeza (a cada duas soldas): caçamba, guarda-corpo e pá ----------
      const cacX0 = mR + 0.45 * M, cacW = 1.0 * M, cacTopo = piso - 0.78 * M, cacCx = cacX0 + cacW / 2;
      const hookPa: [number, number] = [mR + 0.27 * M, piso - 1.05 * M];
      const posPa = mR + 0.45 * M, posRake = xm + 0.85 * M, posCac = cacX0 - 0.05 * M;
      const hxAberta = wR + JANELINHA(M).abX + JANELINHA(M).abW + 0.3 * M; // gancho da espátula com a porta aberta
      const posGancho = hxAberta - 0.22 * M;
      const emLimpeza = limpa && lf >= 0 && lf < 7.7;
      const lv = (a: number, b: number) => suave(a, b, lf);
      // guarda-corpo amarelo ao lado da Schlatter (atrás da caçamba), com a pá pendurada no primeiro pé
      {
        const g0 = mR + 0.22 * M, g1 = Math.min(W - 0.05 * M, mR + 1.6 * M);
        ctx.fillStyle = amarelo(AM_S);
        ctx.fillRect(g0, piso - 1.1 * M, g1 - g0, 0.05 * M);
        ctx.fillRect(g0, piso - 0.58 * M, g1 - g0, 0.045 * M);
        for (const gx of [g0, (g0 + g1) / 2, g1 - 0.05 * M]) {
          const gp = ctx.createLinearGradient(gx, 0, gx + 0.06 * M, 0);
          gp.addColorStop(0, amarelo(AM_L)); gp.addColorStop(1, amarelo(AM_S));
          ctx.fillStyle = gp; ctx.fillRect(gx, piso - 1.12 * M, 0.06 * M, 1.12 * M);
        }
      }
      // caçamba quadrada amarela cheia de borra; o monte cresce um pouco a cada despejo
      {
        const monte = (0.05 + 0.2 * cacamba) * M;
        ctx.fillStyle = 'rgb(46,40,36)';
        ctx.beginPath(); ctx.moveTo(cacX0 + 0.06 * M, cacTopo + 0.02 * M);
        for (let i = 0; i <= 10; i++) {
          const f = i / 10, x = cacX0 + 0.06 * M + f * (cacW - 0.12 * M);
          ctx.lineTo(x, cacTopo - monte * Math.sin(f * Math.PI) * (0.85 + 0.15 * Math.sin(i * 2.7)));
        }
        ctx.lineTo(cacX0 + cacW - 0.06 * M, cacTopo + 0.02 * M); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(cacX0 + (0.2 + i * 0.12) * cacW, cacTopo - monte * 0.5 * Math.sin((0.2 + i * 0.12) * Math.PI), 0.025 * M, 0, 6.283); ctx.fill(); }
        const gc = ctx.createLinearGradient(cacX0, 0, cacX0 + cacW, 0);
        gc.addColorStop(0, amarelo(AM_L)); gc.addColorStop(0.5, amarelo(AM)); gc.addColorStop(1, amarelo(AM_S));
        ctx.fillStyle = gc;
        ctx.beginPath(); ctx.moveTo(cacX0, cacTopo); ctx.lineTo(cacX0 + cacW, cacTopo); ctx.lineTo(cacX0 + cacW - 0.07 * M, piso - 0.05 * M); ctx.lineTo(cacX0 + 0.07 * M, piso - 0.05 * M); ctx.closePath(); ctx.fill();
        ctx.fillStyle = amarelo(AM_S);
        ctx.fillRect(cacX0 - 0.03 * M, cacTopo - 0.03 * M, cacW + 0.06 * M, 0.06 * M); // borda reforçada
        for (const f of [0.3, 0.7]) ctx.fillRect(cacX0 + f * cacW - 0.025 * M, cacTopo + 0.03 * M, 0.05 * M, piso - cacTopo - 0.1 * M); // nervuras
        ctx.fillStyle = 'rgb(40,40,44)';
        ctx.fillRect(cacX0 + 0.04 * M, piso - 0.06 * M, cacW - 0.08 * M, 0.06 * M); // sapatas
        for (const x of [cacX0 - 0.05 * M, cacX0 + cacW + 0.01 * M]) ctx.fillRect(x, cacTopo + 0.12 * M, 0.04 * M, 0.1 * M); // olhais
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        ctx.fillRect(cacX0 + 0.1 * M, cacTopo + 0.3 * M, cacW - 0.2 * M, 0.02 * M);
      }

      // posição do soldador: no ciclo normal, entre o painel e a portinhola; na limpeza, os passos da pá
      let sxS = mix(posCtrl, posJan, naJanela) + curso * 0.25 * comVara;
      let andaL = 0;
      if (emLimpeza) {
        const trechos: [number, number, number][] = [[1.1, 1.6, posPa], [1.9, 2.4, posRake], [4.6, 5.1, posGancho], [5.4, 5.8, posCac], [6.4, 6.8, posPa], [6.8, 7.6, posCtrl]];
        let x = posJan;
        for (const [a, b, alvo] of trechos) { x = mix(x, alvo, lv(a, b)); if (lf > a && lf < b) andaL = 1; }
        sxS = x;
      }
      const curvaL = emLimpeza ? (0.55 * (lv(2.35, 2.7) - lv(4.3, 4.6)) + 0.12 * (lv(5.8, 6.1) - lv(6.3, 6.5))) : 0;
      const agachaL = emLimpeza ? 0.3 * (lv(2.35, 2.7) - lv(4.3, 4.6)) : 0;
      const ombroYL = ombroY + agachaL * 0.15 * Hs + curvaL * 0.13 * Hs;

      const hx = abX + jn.abW + 0.3 * M, hy0 = abY - 0.12 * M; // gancho na porta, à direita da janelinha
      const rH: [number, number] = [sxS + 0.04 * Hs, ombroY + 0.14 * Hs];
      const pontaJan: [number, number] = [abX + jn.abW * 0.2, abY + jn.h * 0.6];
      let angMao = Math.atan2(pontaJan[1] - rH[1], pontaJan[0] - rH[0]);
      const avanco = curso - 0.25 * M * (1 - entra);
      let pegaMao: [number, number] = [rH[0] + Math.cos(angMao) * avanco, rH[1] + Math.sin(angMao) * avanco];
      let atrasM = 0.08 * M, frenteM = 1.27 * M;
      // na limpeza: a espátula sai da janelinha, vai na mão do lado do corpo e depois puxa a borra para a pá
      const puxando = emLimpeza ? lv(2.4, 2.7) * (1 - lv(4.3, 4.6)) : 0;
      const pontaBorra: [number, number] = [xm - 0.32 * M + 0.42 * M * (0.5 - 0.5 * Math.cos((lf - 2.7) * Math.PI * 2 / 0.53)) * lv(2.7, 2.8), wB - 0.05 * M];
      if (emLimpeza && lf > 0.3) {
        const lado = lv(0.3, 0.7);
        const Gc: [number, number] = [sxS + 0.13 * Hs, piso - 0.48 * Hs];
        const Gr: [number, number] = [sxS + 0.1 * Hs, ombroYL + 0.3 * Hs];
        const angR = Math.atan2(pontaBorra[1] - Gr[1], pontaBorra[0] - Gr[0]);
        const angC = Math.PI / 2 + 0.28;
        pegaMao = [mix(mix(pegaMao[0], Gc[0], lado), Gr[0], puxando), mix(mix(pegaMao[1], Gc[1], lado), Gr[1], puxando)];
        angMao = mix(mix(angMao, angC, lado), angR, puxando);
        atrasM = mix(mix(atrasM, 0.25 * M, lado), 0.12 * M, puxando);
        frenteM = mix(mix(frenteM, 1.0 * M, lado), Math.hypot(pontaBorra[0] - Gr[0], pontaBorra[1] - Gr[1]), puxando);
      }
      const kv = emLimpeza ? 1 - lv(5.1, 5.4) : comVara;
      const ang = mix(Math.PI / 2, angMao, kv);
      const dir: [number, number] = [Math.cos(ang), Math.sin(ang)];
      const pegaGancho: [number, number] = [hx, hy0 + 0.35 * M];
      const G: [number, number] = [mix(pegaGancho[0], pegaMao[0], kv), mix(pegaGancho[1], pegaMao[1], kv)];
      const atras = mix(0.35 * M, atrasM, kv), frenteV = mix(1.0 * M, frenteM, kv);
      const v0: [number, number] = [G[0] - dir[0] * atras, G[1] - dir[1] * atras];
      const v1: [number, number] = [G[0] + dir[0] * frenteV, G[1] + dir[1] * frenteV];
      // a parte que entra pela janelinha aparece só dentro dela (o resto fica atrás da porta); com a porta aberta, tudo
      ctx.save();
      if (portaFecha > 0.98) {
        const vista = new Path2D();
        vista.rect(abX, abY, jn.abW, jn.h);
        vista.rect(abX + jn.abW, 0, W, H);
        ctx.clip(vista);
      }
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgb(20,22,26)'; ctx.lineWidth = Math.max(2.5, 0.042 * M);
      ctx.beginPath(); ctx.moveTo(v0[0], v0[1]); ctx.lineTo(v1[0], v1[1]); ctx.stroke();
      ctx.strokeStyle = 'rgb(150,156,166)'; ctx.lineWidth = Math.max(1, 0.014 * M);
      ctx.beginPath(); ctx.moveTo(v0[0], v0[1] - 0.006 * M); ctx.lineTo(v1[0], v1[1] - 0.006 * M); ctx.stroke();
      ctx.restore();
      if (kv < 0.5) {
        // gancho
        ctx.strokeStyle = 'rgb(40,42,46)'; ctx.lineWidth = Math.max(1.5, 0.018 * M);
        ctx.beginPath(); ctx.arc(hx, hy0 + 0.02 * M, 0.03 * M, Math.PI, Math.PI * 2.2); ctx.stroke();
      }

      // a pá de ferro: no gancho do guarda-corpo, pendurada na mão, deitada junto da borra, carregada e despejando
      type PosePa = { h: [number, number]; b: [number, number]; vira: number };
      const paGancho: PosePa = { h: hookPa, b: [hookPa[0], hookPa[1] + 0.62 * M], vira: 0 };
      const paMao: PosePa = { h: [sxS - 0.125 * Hs, piso - 0.48 * Hs], b: [sxS - 0.125 * Hs - 0.04 * M, piso - 0.48 * Hs + 0.62 * M], vira: 0 };
      const paBorra: PosePa = { h: [xm + 0.72 * M, wB - 0.34 * M], b: [xm + 0.16 * M, wB - 0.07 * M], vira: 0 };
      const paLeva: PosePa = { h: [sxS - 0.1 * Hs, piso - 0.5 * Hs], b: [sxS + 0.5 * M, piso - 0.56 * Hs], vira: 0 };
      const paDespeja: PosePa = { h: [cacCx - 0.62 * M, cacTopo - 0.32 * M], b: [cacCx, cacTopo - 0.42 * M], vira: 1.2 };
      const mixPa = (a: PosePa, b: PosePa, k: number): PosePa => ({
        h: [mix(a.h[0], b.h[0], k), mix(a.h[1], b.h[1], k)], b: [mix(a.b[0], b.b[0], k), mix(a.b[1], b.b[1], k)], vira: mix(a.vira, b.vira, k),
      });
      let pa = paGancho, comPa = 0;
      if (emLimpeza) {
        comPa = lv(1.6, 1.8) * (1 - lv(6.6, 6.8));
        pa = mixPa(paGancho, paMao, lv(1.6, 1.9));
        pa = mixPa(pa, paBorra, lv(2.4, 2.7));
        pa = mixPa(pa, paMao, lv(4.3, 4.6));
        pa = mixPa(pa, paLeva, lv(5.4, 5.8));
        pa = mixPa(pa, paDespeja, lv(5.8, 6.15));
        pa = mixPa(pa, paGancho, lv(6.4, 6.8));
      }
      const cargaPa = emLimpeza ? lv(2.9, 4.2) * (1 - lv(6.1, 6.35)) : 0;
      {
        const dx = pa.b[0] - pa.h[0], dy = pa.b[1] - pa.h[1], comp = Math.hypot(dx, dy) || 1;
        const a = Math.atan2(dy, dx);
        ctx.strokeStyle = 'rgb(70,58,44)'; ctx.lineWidth = Math.max(2, 0.032 * M); ctx.lineCap = 'round'; // cabo
        ctx.beginPath(); ctx.moveTo(pa.h[0], pa.h[1]); ctx.lineTo(pa.h[0] + dx * (1 - 0.18 * M / comp), pa.h[1] + dy * (1 - 0.18 * M / comp)); ctx.stroke();
        ctx.save(); ctx.translate(pa.b[0], pa.b[1]); ctx.rotate(a - Math.PI / 2 + pa.vira);
        // pá quadrada de chapa: o cabo entra no alvado e a lâmina segue reta, com a borda da frente arredondada
        const lb = 0.1 * M, hb = 0.24 * M;
        ctx.fillStyle = 'rgb(70,74,80)';
        ctx.fillRect(-0.025 * M, -hb * 0.62, 0.05 * M, hb * 0.2); // alvado
        const gpa = ctx.createLinearGradient(-lb, 0, lb, 0);
        gpa.addColorStop(0, 'rgb(150,154,160)'); gpa.addColorStop(1, 'rgb(84,88,96)');
        ctx.fillStyle = gpa;
        ctx.beginPath(); ctx.moveTo(-lb, -hb * 0.45); ctx.lineTo(lb, -hb * 0.45); ctx.lineTo(lb, hb * 0.4); ctx.quadraticCurveTo(0, hb * 0.6, -lb, hb * 0.4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
        if (cargaPa > 0.02) { // borra em cima da pá
          ctx.fillStyle = 'rgb(48,42,38)';
          for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-lb * 0.6 + i * lb * 0.3, hb * (0.05 - 0.08 * Math.sin(i * 2.1)), lb * 0.32 * cargaPa + 0.5, hb * 0.16 * cargaPa + 0.5, i, 0, 6.283); ctx.fill(); }
        }
        ctx.restore();
        if (comPa < 0.5) { // gancho no guarda-corpo
          ctx.strokeStyle = 'rgb(40,42,46)'; ctx.lineWidth = Math.max(1.5, 0.018 * M);
          ctx.beginPath(); ctx.arc(hookPa[0], hookPa[1] - 0.01 * M, 0.03 * M, Math.PI, Math.PI * 2.2); ctx.stroke();
        }
      }
      // despejo: a borra cai da pá dentro da caçamba
      if (emLimpeza && lf > 6.1 && lf < 6.4 && Math.random() < dt * 60) {
        cascas.push({ x: pa.b[0] + (Math.random() - 0.5) * 0.12 * M, y: pa.b[1], vx: (Math.random() - 0.2) * 0.4 * M, vy: -Math.random() * 0.3 * M,
          r: (0.01 + Math.random() * 0.015) * M, v: 1, giro: Math.random() * 6.28, quente: Math.random() < 0.15 ? 0.8 : 0, chao: cacTopo - (0.05 + 0.2 * cacamba) * M * 0.6 });
      }
      // borra raspada: pedaços de casca (alguns ainda em brasa) caindo pela beirada de baixo da janelinha
      if (!parado && raspando > 0.3 && Math.random() < dt * 26 * raspando) {
        cascas.push({
          x: abX + jn.abW * (0.15 + Math.random() * 0.7), y: abY + jn.h, vx: (Math.random() - 0.4) * 0.5 * M, vy: Math.random() * 0.4 * M,
          r: (0.008 + Math.random() * 0.014) * M, v: 1, giro: Math.random() * 6.28, quente: Math.random() < 0.35 ? 1 : 0,
        });
        if (Math.random() < 0.4) faiscas.push({ x: abX + jn.abW * Math.random(), y: abY + jn.h * (0.4 + Math.random() * 0.6), vx: (Math.random() - 0.3) * 120, vy: -(Math.random() * 90), v: 0.2 + Math.random() * 0.25 });
      }
      for (const k of cascas) {
        k.vy += 9.8 * M * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.giro += dt * 6; k.quente = Math.max(0, k.quente - dt * 0.7);
        if (k.chao !== undefined && k.y > k.chao) { k.v = 0; cacamba = Math.min(0.95, cacamba + 0.0025); }
        else if (k.y > piso - k.r) { k.y = piso - k.r; k.vy *= -0.25; k.vx *= 0.5; k.v -= dt * 0.6; }
      }
      for (let i = cascas.length - 1; i >= 0; i--) if (cascas[i].v <= 0) cascas.splice(i, 1);
      for (const k of cascas) {
        ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.giro);
        ctx.globalAlpha = Math.min(1, k.v * 2);
        ctx.fillStyle = k.quente > 0.05 ? cor(misturar([60, 44, 36], [255, 140, 50], k.quente)) : 'rgb(52,44,40)';
        ctx.beginPath(); ctx.moveTo(-k.r, -k.r * 0.4); ctx.lineTo(k.r * 0.3, -k.r * 0.7); ctx.lineTo(k.r, k.r * 0.2); ctx.lineTo(-k.r * 0.2, k.r * 0.6); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // mãos do soldador: a esquerda no joystick, no botão da solda ou na espátula; a direita na alavanca da
      // portinhola (do lado direito da janelinha) ou segurando a espátula junto do peito
      const naGrade = parado ? 0 : tira(F.gradeFecha0, F.gradeFecha1) + tira(F.gradeAbre0, F.gradeAbre1);
      const naVara = parado ? 1 : suave(F.pega0 - 0.1, F.pega0 + 0.15, fase) * (1 - suave(F.guarda1 - 0.1, F.guarda1 + 0.1, fase));
      const esqVara = kv > 0.85 && (!emLimpeza || lf < 0.35) ? 1 : 0;
      const pontoVara: [number, number] = [G[0] + dir[0] * 0.55 * M, G[1] + dir[1] * 0.55 * M];
      let maoE: [number, number] | null = esqVara ? pontoVara : noBotao > 0.01 ? pn.botao : segura > 0.01 ? manopla : null;
      let alcE = esqVara ? 1 : noBotao > 0.01 ? noBotao : segura;
      let maoD: [number, number] | null = naGrade > 0.01 ? puxador : naVara > 0.01 ? G : null;
      let alcD = naGrade > 0.01 ? naGrade : naVara;
      if (emLimpeza && lf >= 0.35) {
        // esquerda na pá; direita na espátula até pendurá-la, depois ajuda a carregar e despejar a pá
        maoE = pa.h; alcE = lv(1.45, 1.65) * (1 - lv(6.6, 6.85));
        if (lf < 5.35) { maoD = G; alcD = 1; }
        else { maoD = [mix(pa.h[0], pa.b[0], 0.5), mix(pa.h[1], pa.b[1], 0.5)]; alcD = lv(5.4, 5.6) * (1 - lv(6.4, 6.6)); }
      }
      // Na solda voa faísca para todo lado: depois de apertar o botão os dois se afastam da máquina e só voltam
      // quando ela termina de recalcar. O soldador dá uns passos para trás (para perto de quem olha a tela, por isso
      // fica um pouco maior e mais embaixo); o da régua sai de perto da boca da máquina, por onde sai o leque de faíscas.
      const afasta = parado ? 0 : suave(F.botao1, F.garra - 0.05, fase) - suave(F.recalque + 0.15, F.recalque + 0.65, fase);
      const andandoLonge = afasta > 0.02 && afasta < 0.98 ? 1 : 0;
      const escAf = 1 + 0.12 * afasta;
      ctx.save();
      ctx.translate(sxS + 0.3 * M * afasta, piso + (H - piso) * 0.55 * afasta);
      ctx.scale(escAf, escAf);
      ctx.translate(-sxS, -piso);
      desenharOperario(ctx, {
        sx: sxS, piso, Hs, t, mq, parado,
        anda: Math.max(andaS, andandoLonge, andaL), passo: (sxS - posCtrl) / (Hs * 0.13) + afasta * 5,
        maoE, alcE, maoD, alcD, dPeito: kv > 0.6 && !(emLimpeza && lf > 0.4) ? 1 : 0,
        curva: emLimpeza ? curvaL : 0.12 * kv, agacha: agachaL,
        inclina: emLimpeza ? -0.3 * (lv(2.4, 2.7) - lv(4.3, 4.6)) + 0.3 * (lv(5.8, 6.1) - lv(6.3, 6.5)) : -0.35 * Math.max(segura, noBotao) - 0.3 * kv,
        capacete: [150, 156, 162], fase: 0,
      });
      ctx.restore();

      // ---------- o segundo operário: a régua na emenda que acabou de sair da Schlatter ----------
      // só precisa sair de perto quando a estação fica colada na máquina (no celular)
      const recuaR = d1 < 4.5 * M ? 1.6 * M : 0;
      const sxR = xR + 0.04 * M - recuaR * afasta;
      const HsR = 1.55 * M; // o da régua é mais baixo que o soldador
      if (sxR - 0.7 * M > 0) {
        const r = parado ? 1.6 : fase - F.regua0;
        const ergue = suave(0, 0.5, r) * (1 - suave(2.8, 3.3, r)); // 0 em pé do lado dele, 1 deitada sobre o boleto
        const desce = suave(0.45, 0.8, r) * (1 - suave(2.65, 2.95, r));
        const mira = suave(0.9, 1.35, r) * (1 - suave(2.3, 2.7, r)); // inclina um pouco e olha ao longo da régua (sem agachar)
        const yBol = topo - R * 0.06;
        const esp = Math.max(2, 0.035 * M);
        const yDeit = yBol - esp / 2 - 0.25 * M * (1 - desce);
        const ladoX = sxR + 0.17 * HsR;
        const a0: [number, number] = [mix(ladoX, xR - 0.5 * M, ergue), mix(piso - 0.02 * M, yDeit, ergue)];
        const a1: [number, number] = [mix(ladoX, xR + 0.5 * M, ergue), mix(piso - 1.0 * M, yDeit, ergue)];
        ctx.lineCap = 'butt';
        ctx.strokeStyle = 'rgb(46,48,54)'; ctx.lineWidth = esp + 1.5;
        ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
        const gR = ctx.createLinearGradient(a0[0], a0[1] - esp, a0[0], a0[1] + esp);
        gR.addColorStop(0, 'rgb(214,218,224)'); gR.addColorStop(1, 'rgb(118,122,130)');
        ctx.strokeStyle = gR; ctx.lineWidth = esp;
        ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
        ctx.lineCap = 'round';
        const mRegE: [number, number] = [xR - 0.24 * M, yDeit - esp * 0.3];
        const mRegD: [number, number] = [mix(a1[0], xR + 0.26 * M, ergue), mix(a1[1] + 0.03 * M, yDeit - esp * 0.3, ergue)];
        desenharOperario(ctx, {
          sx: sxR, piso, Hs: HsR, t, mq, parado,
          anda: recuaR > 0 ? andandoLonge : 0, passo: afasta * 7,
          maoE: mRegE, alcE: ergue, maoD: mRegD, alcD: 1, dPeito: 0,
          curva: 0.12 * ergue + 0.22 * mira, agacha: 0, inclina: -0.25 * mira,
          capacete: [236, 238, 240], fase: 1.7,
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
    if (!parado && !soldouLogo && t >= SOLDA) {
      soldouLogo = true;
      const n0 = faiscas.length;
      soldarLogo(cv, faiscas);
      // as faíscas do logo vêm em coordenadas da tela: com a câmera aproximada, leva para as da cena
      if (camera) for (let i = n0; i < faiscas.length; i++) {
        const f = faiscas[i];
        f.x = camera.fx + (f.x - camera.ax) / camera.Z; f.y = camera.fy + (f.y - camera.ay) / camera.Z;
        f.vx /= camera.Z; f.vy /= camera.Z;
      }
    }
    if (faiscas.length) desenharFaiscas(ctx, faiscas, dt, H);

    if (camera) ctx.restore();
    // galpão escuro no começo da abertura: clareia conforme as luzes acendem
    if (cinema) {
      const breu = 0.78 * (1 - suave(0.15, 1.4, t));
      if (breu > 0) { ctx.fillStyle = `rgba(0,0,0,${breu})`; ctx.fillRect(0, 0, W, H); }
    }

    // vinheta suave e saída do escuro
    const v = ctx.createRadialGradient(xc, H * 0.45, Math.min(W, H) * 0.3, xc, H * 0.5, Math.max(W, H) * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, escuro ? 'rgba(0,0,0,.45)' : 'rgba(40,50,70,.12)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    const cortina = parado ? 0 : 1 - suave(0, completa ? 0.7 : 0.3, t);
    if (cortina > 0) { ctx.fillStyle = cor(pal.ceuTopo, cortina); ctx.fillRect(0, 0, W, H); }
  });
  const parar = typeof controle === 'function' ? controle : controle.parar;
  return () => {
    parar();
    if (cinema) {
      window.removeEventListener('pointerdown', pular);
      window.removeEventListener('keydown', pular);
      encerrarIntro();
    }
  };
}
