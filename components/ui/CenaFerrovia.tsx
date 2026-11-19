'use client';

import { useEffect, useRef } from 'react';
import { ESTACOES_LINHA } from '@/lib/linhaProducao';

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
  /** trabalho a quente (patim e boleteiras): viseira e avental de raspa */
  quente?: boolean;
  /** visto de frente (operário do outro lado da linha, olhando para o trilho e para quem vê a tela) */
  frente?: boolean;
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

  // avental de raspa visto de costas: o couro é mais largo que o quadril e aparece atrás das pernas, da cintura até
  // os joelhos (as pernas são desenhadas por cima)
  if (p.quente && !p.frente) {
    const yC = qy + Hs * 0.06, yJ = qy + Hs * 0.29, la = Hs * 0.1;
    const g = ctx.createLinearGradient(0, yC, 0, yJ);
    g.addColorStop(0, cor(mq([132, 90, 54]))); g.addColorStop(1, cor(mq([104, 70, 40])));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(qx - la * 1.22, yC); ctx.lineTo(qx + la * 1.22, yC); ctx.lineTo(qx + la * 1.45, yJ);
    ctx.quadraticCurveTo(qx, yJ + Hs * 0.025, qx - la * 1.45, yJ); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = cor(mq([80, 54, 30])); ctx.lineWidth = Math.max(1, Hs * 0.006); ctx.stroke();
  }
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
  if (p.frente) {
    // de frente: zíper no meio e as duas faixas refletivas descendo dos ombros até a cintura
    ctx.strokeStyle = azulSombra; ctx.lineWidth = Math.max(1, Hs * 0.005);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(qx, barra); ctx.stroke();
    for (const lado of [-1, 1]) {
      const x0 = ox + lado * lo * 0.55, x1 = qx + lado * lq * 0.55;
      ctx.strokeStyle = faixa; ctx.lineWidth = Hs * 0.024;
      ctx.beginPath(); ctx.moveTo(x0, oy); ctx.lineTo(x1, yf); ctx.stroke();
      ctx.strokeStyle = prata; ctx.lineWidth = Math.max(1, Hs * 0.007);
      ctx.beginPath(); ctx.moveTo(x0, oy); ctx.lineTo(x1, yf); ctx.stroke();
    }
  } else {
    desenharLogoRumo(ctx, (ox + qx) / 2 + (ox - qx) * 0.35, yTronco(0.37), lo * 1.25, 1 - 0.45 * p.curva, branco);
  }
  if (p.quente) {
    // avental de raspa (couro): de frente cobre do peito aos joelhos; de costas aparecem as tiras cruzadas
    const couro = cor(mq([150, 104, 62])), couroS = cor(mq([112, 76, 44]));
    if (p.frente) {
      ctx.fillStyle = couro;
      ctx.beginPath(); ctx.moveTo(ox - lo * 0.55, yTronco(0.18)); ctx.lineTo(ox + lo * 0.55, yTronco(0.18)); ctx.lineTo(qx + lq * 1.15, barra + Hs * 0.2); ctx.lineTo(qx - lq * 1.15, barra + Hs * 0.2); ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = couroS; ctx.lineWidth = Hs * 0.016; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(ox - lo * 0.75, oy + Hs * 0.01); ctx.lineTo(qx + lq * 0.7, yTronco(0.78)); ctx.moveTo(ox + lo * 0.75, oy + Hs * 0.01); ctx.lineTo(qx - lq * 0.7, yTronco(0.78)); ctx.stroke();
      ctx.lineCap = 'round';
    }
  }
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
  if (p.frente) {
    // rosto de frente: pele, sobrancelhas, óculos de proteção e a boca
    ctx.fillStyle = pele;
    ctx.beginPath(); ctx.ellipse(cx, cy + Hs * 0.014, Hs * 0.046, Hs * 0.05, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(190,225,240,.6)';
    ctx.beginPath(); ctx.roundRect(cx - Hs * 0.038, cy - Hs * 0.004, Hs * 0.076, Hs * 0.022, Hs * 0.008); ctx.fill();
    ctx.strokeStyle = 'rgb(24,24,28)'; ctx.lineWidth = Math.max(1, Hs * 0.005);
    ctx.beginPath(); ctx.roundRect(cx - Hs * 0.038, cy - Hs * 0.004, Hs * 0.076, Hs * 0.022, Hs * 0.008); ctx.stroke();
    ctx.fillStyle = peleSombra;
    ctx.fillRect(cx - Hs * 0.012, cy + Hs * 0.038, Hs * 0.024, Math.max(1, Hs * 0.004));
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
  if (p.quente) {
    // viseira presa no capacete: de frente, a tela transparente na frente do rosto; de costas, só as bordas dos lados
    ctx.fillStyle = 'rgba(200,225,235,.35)'; ctx.strokeStyle = 'rgba(40,44,50,.8)'; ctx.lineWidth = Math.max(1, Hs * 0.005);
    if (p.frente) {
      ctx.beginPath(); ctx.roundRect(cx - Hs * 0.058, cy - Hs * 0.022, Hs * 0.116, Hs * 0.085, Hs * 0.02); ctx.fill(); ctx.stroke();
    } else {
      for (const lado of [-1, 1]) { ctx.beginPath(); ctx.roundRect(cx + lado * Hs * 0.068 - Hs * 0.006, cy - Hs * 0.02, Hs * 0.012, Hs * 0.075, Hs * 0.004); ctx.fill(); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgb(40,42,46)';
    ctx.fillRect(cx - Hs * 0.074, cy - Hs * 0.03, Hs * 0.148, Math.max(1, Hs * 0.012));
  }

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
  // seção do passeio: progresso da rolagem (0 a 1) e a altura da parte de cima da tela inicial
  // entra: quanto a seção já entrou na tela (0 quando o topo dela está embaixo da tela, 1 quando chega no alto);
  // legenda: onde termina o cartão da legenda (px da tela), para a cena ocupar o espaço de baixo no celular
  const passeio = (): { p: number; alturaTopo: number; entra: number; legenda: number } | null => {
    const el = document.querySelector<HTMLElement>('.linha-tour');
    const topo = cv.closest('main');
    if (!el || !topo || el.offsetParent === null) return null;
    const r = el.getBoundingClientRect();
    const total = Math.max(1, r.height - window.innerHeight);
    const leg = el.querySelector<HTMLElement>('.linha-tour-topo')?.getBoundingClientRect();
    return {
      p: Math.min(1, Math.max(0, -r.top / total)),
      alturaTopo: topo.offsetHeight,
      entra: Math.min(1, Math.max(0, 1 - r.top / Math.max(1, window.innerHeight))),
      legenda: leg ? Math.max(0, leg.bottom - Math.max(0, r.top)) : window.innerHeight * 0.3,
    };
  };
  let roloApertado = false;
  let tlsCamadas = 3, tlsCiclo = -1; // pilha do TLS no pátio: cresce a cada içamento das talhas
  const sopros: { x: number; y: number; vx: number; vy: number; r: number; v: number }[] = [];

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
    // Passeio pela linha (tela inicial): o canvas fica fixo atrás da página. Enquanto a parte de cima rola, a cena
    // rola junto (offY), com a altura do "mundo" igual à da parte de cima; quando a seção .linha-tour entra, a câmera
    // anda de lado de estação em estação (camX), conforme a rolagem dela.
    const Htela = H;
    const tour = passeio();
    if (tour) H = Math.max(Htela, tour.alturaTopo);
    const offY = tour ? Math.min(Math.max(0, window.scrollY), Math.max(0, H - Htela)) : 0;
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
    // estação da régua depois da máquina (o trilho anda para a esquerda): a cerca de 2 m da saída da Schlatter; no
    // celular, um pouco mais perto, para o rolo opressor caber na tela
    const d1 = (W < 900 ? 2.8 : 3.8) * M;
    const xR = xm - d1;
    // aproximação do passeio no celular (ver a câmera mais abaixo): a linha até uns 6 m de altura cabe embaixo da
    // legenda. No computador a tela é deitada e já cabe tudo (zt = 1).
    let zt = 1;
    const entra = tour ? tour.entra : 0;
    if (tour && Htela > W * 1.15) {
      const livre = Htela - tour.legenda - 0.02 * Htela;
      const alvo = Math.min(1.9, Math.max(1, livre / (6.2 * M + (H - piso))));
      zt = mix(1, alvo, suave(0.35, 1, entra));
    }
    const Wv = W / zt; // largura do mundo que aparece na tela
    // O trilho anda a cerca de 1,2 m/s, com arrancada e freada: cada empurrão no joystick dura o que a distância pede
    {
      const durA = d1 / M / 1.2 + 0.7, durB = (L - d1) / M / 1.2 + 0.7;
      FB.moveA1 = FB.moveA0 + durA; FB.regua0 = FB.moveA1 + 0.15; FB.regua1 = FB.regua0 + 3.35;
      FB.moveB0 = FB.regua1 + 0.2; FB.moveB1 = FB.moveB0 + durB; FB.fim = FB.moveB1 + 0.2;
    }

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
    } else {
      camera = null;
      ctx.save();
      ctx.translate(0, -offY);
      // no celular (tela em pé) a cena fica pequena embaixo da legenda: no passeio, a câmera aproxima, com o chão
      // preso na beirada de baixo da tela, até a linha encher o espaço entre a legenda e o chão
      if (zt > 1.001) {
        const ancora = offY + Htela;
        ctx.translate(0, ancora); ctx.scale(zt, zt); ctx.translate(0, -ancora);
      }
    }
    // câmera do passeio: centraliza a estação da vez (entre uma e outra, desliza suave)
    let camX = 0;
    if (tour && !parado) {
      // na tela estreita a preparação não cabe inteira: mira o PR 01, com o operador dele e a Geismar ao lado
      const estreita = Wv < 10 * M;
      const foco = (e: (typeof ESTACOES_LINHA)[number]) =>
        (e.id === 'regua' ? xR : e.id === 'rolo' ? xR - 1.75 * M : e.id === 'preparacao' && estreita ? xm + 24 * M - d1 + 1.6 * M : xm + e.metros * M) - Wv * 0.5;
      const marcos: [number, number][] = [[0, 0], ...ESTACOES_LINHA.map((e): [number, number] => [e.p, foco(e)]), [1, foco(ESTACOES_LINHA[ESTACOES_LINHA.length - 1])]];
      for (let i = 0; i < marcos.length - 1; i++) {
        const [p0, c0] = marcos[i], [p1, c1] = marcos[i + 1];
        if (tour.p >= p0 && tour.p <= p1) { camX = mix(c0, c1, suave(p0, p1, tour.p)); break; }
      }
    }
    const vx0 = camX, vx1 = camX + Wv;

    // base: a cor do tema por baixo de tudo (o fundo de verdade é desenhado no mundo, logo abaixo)
    ctx.fillStyle = cor(pal.ceuTopo);
    ctx.fillRect(0, 0, W, H);

    // ---------- fundo (desenhado no mundo): o galpão e o que se vê lá fora ----------
    // Como nas fotos: o galpão não é fechado até o chão. A parede de telha escura fica no alto (com o cano vermelho de
    // incêndio e as eletrocalhas) e embaixo dela é aberto: aparece o pátio de brita, o capim, o barranco, os prédios
    // brancos com a faixa azul, os vagões e o guindaste parados e, lá longe, os galpões velhos de telhado enferrujado.
    // O que está lá fora anda mais devagar que a linha (parallax). Depois do fim do galpão é o pátio, a céu aberto.
    const desenharFundoGalpao = () => {
      const tom = (c: RGB, k = 0.6): RGB => (escuro ? misturar(c, pal.ceuTopo, k) : c);
      const Xm = (m: number) => xm + m * M;
      const fimG = Xm(-80);
      const yAbre = piso - 3.9 * M; // embaixo disso a parede é aberta
      const yParede = piso - 8.6 * M; // topo da parede: começa o telhado
      const yTopo = -2 * H;
      const lf = (xw: number, k: number) => camX + Wv / 2 + (xw - camX - Wv / 2) * k;
      const hash = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
      // céu
      const ceu = ctx.createLinearGradient(0, piso - 12 * M, 0, piso);
      ceu.addColorStop(0, cor(tom([84, 146, 214], 0.72)));
      ceu.addColorStop(0.7, cor(tom([170, 206, 236], 0.72)));
      ceu.addColorStop(1, cor(tom([224, 234, 240], 0.72)));
      ctx.fillStyle = ceu; ctx.fillRect(vx0, yTopo, vx1 - vx0, piso - yTopo);
      // nuvens, bem devagar
      ctx.fillStyle = cor(tom([255, 255, 255], 0.8), escuro ? 0.25 : 0.85);
      {
        const S = 9 * M, k = 0.1, base = camX * (1 - k) - t * 0.15 * M;
        const i0 = Math.floor((vx0 - base) / S) - 1, i1 = Math.ceil((vx1 - base) / S) + 1;
        for (let i = i0; i <= i1; i++) {
          if (hash(i) < 0.35) continue;
          const nx = base + i * S + hash(i + 7) * 3 * M, ny = piso - (6 + hash(i + 3) * 4) * M, r = (0.4 + hash(i + 5) * 0.4) * M;
          for (const [dx, dy, rr] of [[0, 0, 1], [0.9, -0.35, 0.85], [1.8, 0, 0.95], [0.9, 0.2, 1]] as [number, number, number][]) {
            ctx.beginPath(); ctx.ellipse(nx + dx * r * 1.4, ny + dy * r, rr * r * 1.5, rr * r * 0.8, 0, 0, 6.283); ctx.fill();
          }
        }
      }
      // camada de longe (k 0,25): mata e os galpões velhos de telhado enferrujado
      {
        const k = 0.25, S = 5 * M, base = camX * (1 - k) + Wv / 2 * (1 - k) * 0;
        const i0 = Math.floor((vx0 - base) / S) - 2, i1 = Math.ceil((vx1 - base) / S) + 2;
        ctx.fillStyle = cor(tom([82, 128, 74]));
        for (let i = i0; i <= i1; i++) {
          const x = base + i * S;
          for (let j = 0; j < 4; j++) {
            const r = (0.7 + hash(i * 4 + j) * 0.8) * M;
            ctx.beginPath(); ctx.ellipse(x + j * 1.3 * M, piso - (2.9 + hash(i + j * 9) * 1.1) * M, r * 1.3, r, 0, 0, 6.283); ctx.fill();
          }
        }
        for (let i = i0; i <= i1; i++) {
          if (hash(i + 40) < 0.45) continue;
          const x = base + i * S, w = (4 + hash(i + 41) * 5) * M, yR = piso - (2.5 + hash(i + 42) * 0.4) * M;
          ctx.fillStyle = cor(tom([150, 146, 140])); ctx.fillRect(x, yR + 0.35 * M, w, 1.2 * M);
          const gR = ctx.createLinearGradient(0, yR, 0, yR + 0.45 * M);
          gR.addColorStop(0, cor(tom([168, 92, 56]))); gR.addColorStop(1, cor(tom([118, 62, 40])));
          ctx.fillStyle = gR;
          ctx.beginPath(); ctx.moveTo(x - 0.2 * M, yR + 0.45 * M); ctx.lineTo(x + 0.3 * M, yR); ctx.lineTo(x + w - 0.3 * M, yR); ctx.lineTo(x + w + 0.2 * M, yR + 0.45 * M); ctx.closePath(); ctx.fill();
          ctx.fillStyle = cor(tom([90, 50, 34]), 0.5);
          for (let rx = x + 0.4 * M; rx < x + w - 0.3 * M; rx += 0.9 * M) if (hash(rx) > 0.5) ctx.fillRect(rx, yR + 0.05 * M, 0.35 * M, 0.38 * M);
        }
      }
      // camada do meio (k 0,5): barranco de capim, o pátio de brita e o que está parado lá fora
      {
        const k = 0.5;
        const yB = piso - 0.5 * M;
        ctx.fillStyle = cor(tom([104, 152, 72]));
        ctx.beginPath(); ctx.moveTo(vx0 - M, yB);
        for (let x = vx0 - M; x <= vx1 + M; x += 0.4 * M) {
          const q = (x - camX * (1 - k)) / M;
          ctx.lineTo(x, piso - (1.35 + 0.35 * Math.sin(q * 0.21) + 0.15 * Math.sin(q * 0.9)) * M);
        }
        ctx.lineTo(vx1 + M, yB); ctx.closePath(); ctx.fill();
        // capim alto em tufos
        ctx.strokeStyle = cor(tom([132, 176, 88])); ctx.lineWidth = Math.max(1, 0.03 * M);
        ctx.beginPath();
        for (let x = Math.floor((vx0 - camX * (1 - k)) / (0.22 * M)) * 0.22 * M + camX * (1 - k); x <= vx1; x += 0.22 * M) {
          const h = (0.25 + hash(Math.round(x / M * 10)) * 0.45) * M;
          ctx.moveTo(x, yB); ctx.lineTo(x + 0.06 * M, yB - h);
        }
        ctx.stroke();
        // brita
        ctx.fillStyle = cor(tom([170, 164, 154])); ctx.fillRect(vx0, yB, vx1 - vx0, piso - yB);
        ctx.fillStyle = cor(tom([120, 114, 106]), 0.6);
        for (let x = Math.floor(vx0 / 7) * 7; x < vx1; x += 7) ctx.fillRect(x + ((x * 13) % 5), yB + 2 + ((x * 7) % 9) / 9 * (piso - yB - 4), 2, 1.5);
        const sz = 0.85; // o que está lá fora parece um pouco menor
        const pr = (m: number) => lf(Xm(m), k);
        const visL = (a: number, b: number) => b > vx0 - M && a < vx1 + M;
        // prédio branco com a faixa azul embaixo, janelas de grade e o telhado de fibrocimento
        const predio = (x0: number, w: number, h: number, porta: boolean) => {
          if (!visL(x0, x0 + w)) return;
          const yT = piso - 0.45 * M - h;
          ctx.fillStyle = cor(tom([236, 236, 230])); ctx.fillRect(x0, yT, w, h);
          ctx.fillStyle = cor(tom([36, 84, 168])); ctx.fillRect(x0, yT + h * 0.68, w, h * 0.32);
          ctx.fillStyle = cor(tom([196, 196, 190])); ctx.fillRect(x0 - 0.15 * M, yT - 0.18 * M, w + 0.3 * M, 0.2 * M);
          for (let jx = x0 + 0.5 * M; jx < x0 + w - 1.0 * M; jx += 1.7 * M) {
            ctx.fillStyle = cor(tom([90, 100, 110])); ctx.fillRect(jx, yT + h * 0.22, 0.8 * M * sz, 0.6 * M * sz);
            ctx.strokeStyle = cor(tom([235, 235, 232])); ctx.lineWidth = 1;
            ctx.beginPath();
            for (let g = 1; g < 4; g++) { ctx.moveTo(jx + g * 0.2 * M * sz, yT + h * 0.22); ctx.lineTo(jx + g * 0.2 * M * sz, yT + h * 0.22 + 0.6 * M * sz); }
            ctx.moveTo(jx, yT + h * 0.22 + 0.3 * M * sz); ctx.lineTo(jx + 0.8 * M * sz, yT + h * 0.22 + 0.3 * M * sz);
            ctx.stroke();
          }
          if (porta) { ctx.fillStyle = cor(tom([214, 216, 214])); ctx.fillRect(x0 + w - 1.0 * M, yT + h * 0.3, 0.7 * M, h * 0.7); }
        };
        predio(pr(20), 7 * M * sz, 2.7 * M * sz, false);
        predio(pr(-9), 5 * M * sz, 2.6 * M * sz, true);
        predio(pr(-58), 9 * M * sz, 3.0 * M * sz, true);
        // contêineres: o azul da Rumo e o cinza da Agilibox
        const conteiner = (x0: number, c: RGB, texto: string) => {
          const w = 3.6 * M * sz, h = 1.6 * M * sz, yT = piso - 0.45 * M - h;
          if (!visL(x0, x0 + w)) return;
          ctx.fillStyle = cor(tom(c)); ctx.fillRect(x0, yT, w, h);
          ctx.strokeStyle = cor(tom(misturar(c, [0, 0, 0], 0.25))); ctx.lineWidth = 1;
          ctx.beginPath(); for (let x = x0 + 0.12 * M; x < x0 + w; x += 0.12 * M) { ctx.moveTo(x, yT); ctx.lineTo(x, yT + h); } ctx.stroke();
          ctx.fillStyle = cor(tom([245, 245, 245]));
          ctx.font = `700 ${0.36 * M * sz}px ${fonte('--font-barlow', 'Arial, Helvetica, sans-serif')}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(texto, x0 + w / 2, yT + h * 0.35);
          ctx.textAlign = 'left';
        };
        conteiner(pr(28), [44, 104, 184], 'rumo');
        conteiner(pr(-15), [120, 128, 134], 'AGILIBOX');
        // vagão plataforma azul-claro (PDR) com as nervuras, e o guindaste ferroviário amarelo com a lança de treliça
        {
          const x0 = pr(-30), w = 12 * M * sz, yT = piso - 0.45 * M - 1.5 * M * sz;
          if (visL(x0 - 4 * M, x0 + w)) {
            ctx.fillStyle = cor(tom([146, 180, 206])); ctx.fillRect(x0, yT, w, 1.0 * M * sz);
            ctx.strokeStyle = cor(tom([112, 146, 172])); ctx.lineWidth = Math.max(1.5, 0.06 * M);
            ctx.beginPath();
            for (let x = x0 + 0.6 * M; x < x0 + w - M; x += 1.6 * M) { ctx.moveTo(x, yT + 0.95 * M * sz); ctx.lineTo(x + 0.6 * M, yT + 0.05 * M); ctx.moveTo(x + 0.6 * M, yT + 0.05 * M); ctx.lineTo(x + 0.6 * M, yT + 0.95 * M * sz); }
            ctx.stroke();
            ctx.fillStyle = cor(tom([168, 96, 60]), 0.5); ctx.fillRect(x0 + 2 * M, yT + 0.2 * M, 1.4 * M, 0.3 * M);
            ctx.fillStyle = cor(tom([46, 48, 52]));
            for (const bx of [x0 + 1.6 * M, x0 + w - 1.6 * M]) for (const d of [-0.5, 0.5]) { ctx.beginPath(); ctx.arc(bx + d * M, piso - 0.62 * M, 0.26 * M * sz, 0, 6.283); ctx.fill(); }
            // guindaste em cima de outro vagão, à esquerda
            const gx = x0 - 3.2 * M, gy = yT - 1.4 * M * sz;
            ctx.fillStyle = cor(tom([70, 72, 76])); ctx.fillRect(gx - 1.5 * M, yT + 0.6 * M * sz, 4.2 * M, 0.3 * M);
            ctx.fillStyle = cor(tom([214, 168, 70])); ctx.fillRect(gx - 1.0 * M, gy, 2.6 * M * sz, 1.5 * M * sz);
            ctx.fillStyle = cor(tom([70, 80, 90])); ctx.fillRect(gx - 0.8 * M, gy + 0.2 * M, 0.7 * M * sz, 0.5 * M * sz);
            ctx.strokeStyle = cor(tom([206, 164, 72])); ctx.lineWidth = Math.max(1.5, 0.05 * M);
            const b0: [number, number] = [gx + 1.2 * M, gy + 0.4 * M], b1: [number, number] = [gx + 8.5 * M, gy - 3.4 * M];
            ctx.beginPath();
            ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]);
            ctx.moveTo(b0[0], b0[1] + 0.35 * M); ctx.lineTo(b1[0], b1[1] + 0.12 * M);
            for (let f = 0; f < 1; f += 0.08) { ctx.moveTo(mix(b0[0], b1[0], f), mix(b0[1], b1[1], f)); ctx.lineTo(mix(b0[0], b1[0], f + 0.04), mix(b0[1] + 0.35 * M, b1[1] + 0.12 * M, f + 0.04)); }
            ctx.stroke();
          }
        }
        // vagão-tanque branco e a escavadeira amarela, perto do fim do galpão
        {
          const x0 = pr(-74), w = 7 * M * sz, yT = piso - 0.45 * M - 1.9 * M * sz;
          if (visL(x0, x0 + w)) {
            ctx.fillStyle = cor(tom([214, 216, 218]));
            ctx.beginPath(); ctx.roundRect(x0, yT, w, 1.3 * M * sz, 0.6 * M * sz); ctx.fill();
            ctx.fillStyle = cor(tom([176, 178, 182])); ctx.fillRect(x0 + w * 0.45, yT - 0.2 * M, 0.5 * M, 0.25 * M);
            ctx.fillStyle = cor(tom([46, 48, 52]));
            for (const bx of [x0 + M, x0 + w - M]) { ctx.beginPath(); ctx.arc(bx, piso - 0.62 * M, 0.24 * M * sz, 0, 6.283); ctx.fill(); }
          }
          const ex = pr(-40);
          if (visL(ex - 2 * M, ex + 3 * M)) {
            ctx.fillStyle = cor(tom([222, 176, 40]));
            ctx.fillRect(ex, piso - 1.7 * M * sz, 1.5 * M * sz, 0.9 * M * sz);
            ctx.strokeStyle = cor(tom([222, 176, 40])); ctx.lineWidth = Math.max(2, 0.12 * M);
            ctx.beginPath(); ctx.moveTo(ex + 1.3 * M, piso - 1.5 * M); ctx.lineTo(ex + 2.6 * M, piso - 2.6 * M); ctx.lineTo(ex + 3.2 * M, piso - 1.2 * M); ctx.stroke();
            ctx.fillStyle = cor(tom([50, 52, 56])); ctx.fillRect(ex - 0.2 * M, piso - 0.9 * M * sz, 1.9 * M * sz, 0.35 * M);
          }
        }
      }
      // o galpão: parede de telha no alto, telhado, colunas de treliça, luminárias
      const gx0 = Math.max(vx0, fimG), gx1 = vx1;
      if (gx0 < gx1) {
        // parede de telha marrom-escura (ondulada, com as terças)
        const parede = ctx.createLinearGradient(0, yParede, 0, yAbre);
        parede.addColorStop(0, cor(tom([62, 54, 48], 0.5))); parede.addColorStop(1, cor(tom([84, 72, 62], 0.5)));
        ctx.fillStyle = parede; ctx.fillRect(gx0, yParede, gx1 - gx0, yAbre - yParede);
        const onda = Math.max(4, 0.16 * M);
        ctx.fillStyle = cor(tom([40, 34, 30], 0.5), 0.55);
        for (let x = Math.floor(gx0 / onda) * onda; x < gx1; x += onda) ctx.fillRect(x, yParede, Math.max(1, onda * 0.3), yAbre - yParede);
        ctx.fillStyle = cor(tom([120, 106, 92], 0.5), 0.35);
        for (let x = Math.floor(gx0 / onda) * onda + onda * 0.55; x < gx1; x += onda) ctx.fillRect(x, yParede, 1, yAbre - yParede);
        ctx.fillStyle = cor(tom([30, 28, 26], 0.5), 0.8);
        for (const y of [piso - 5.2 * M, piso - 6.9 * M]) ctx.fillRect(gx0, y, gx1 - gx0, Math.max(1.5, 0.05 * M));
        // pontinhos de luz entre as telhas, numa fileira
        ctx.fillStyle = `rgba(255,255,255,${escuro ? 0.12 : 0.5})`;
        for (let x = Math.floor(gx0 / (0.5 * M)) * 0.5 * M; x < gx1; x += 0.5 * M) ctx.fillRect(x, piso - 4.35 * M, 1.5, 1.5);
        // cano vermelho de incêndio
        ctx.fillStyle = cor(tom([196, 40, 40], 0.45)); ctx.fillRect(gx0, piso - 7.6 * M, gx1 - gx0, Math.max(2, 0.09 * M));
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(gx0, piso - 7.6 * M, gx1 - gx0, Math.max(1, 0.02 * M));
        // eletrocalhas cinzas furadas: uma logo acima da abertura, outra no meio da parede
        for (const y of [yAbre - 0.32 * M, piso - 6.0 * M]) {
          ctx.fillStyle = cor(tom([168, 172, 176], 0.5)); ctx.fillRect(gx0, y, gx1 - gx0, Math.max(3, 0.13 * M));
          ctx.fillStyle = cor(tom([90, 94, 98], 0.5));
          for (let x = Math.floor(gx0 / (0.12 * M)) * 0.12 * M; x < gx1; x += 0.12 * M) ctx.fillRect(x, y + 0.04 * M, Math.max(1, 0.04 * M), Math.max(1, 0.04 * M));
        }
        // viga da beirada da abertura
        ctx.fillStyle = cor(tom([52, 52, 54], 0.5)); ctx.fillRect(gx0, yAbre - 0.12 * M, gx1 - gx0, 0.14 * M);
        // telhado (visto por baixo): telha escura e as tesouras de treliça
        ctx.fillStyle = cor(tom([46, 48, 52], 0.5)); ctx.fillRect(gx0, yTopo, gx1 - gx0, yParede - yTopo);
        ctx.fillStyle = cor(tom([70, 72, 76], 0.5), 0.6);
        for (let y = yParede - 1.6 * M; y > yParede - 30 * M; y -= 0.22 * M) ctx.fillRect(gx0, y, gx1 - gx0, 1);
        const vao = 7.5 * M;
        ctx.strokeStyle = cor(tom([96, 100, 106], 0.5)); ctx.lineWidth = Math.max(1, 0.05 * M);
        ctx.beginPath();
        const yt0 = yParede - 0.1 * M, yt1 = yParede - 1.3 * M;
        ctx.moveTo(gx0, yt0); ctx.lineTo(gx1, yt0); ctx.moveTo(gx0, yt1); ctx.lineTo(gx1, yt1);
        for (let x = Math.floor(gx0 / (0.75 * M)) * 0.75 * M; x < gx1; x += 0.75 * M) {
          const par = Math.round(x / (0.75 * M)) % 2 === 0;
          ctx.moveTo(x, par ? yt0 : yt1); ctx.lineTo(x + 0.75 * M, par ? yt1 : yt0);
        }
        ctx.stroke();
        // colunas de treliça, luminárias, extintores e ventiladores
        const c0 = Math.floor((gx0 - xm) / vao) - 1, c1 = Math.ceil((gx1 - xm) / vao) + 1;
        const liga = parado ? 1 : suave(0.15, 0.6, t * (completa ? 1 : 3));
        for (let c = c0; c <= c1; c++) {
          const cx = xm + c * vao + 0.4 * M;
          if (cx < fimG + 0.2 * M) continue;
          const corC = cor(tom([128, 132, 138], 0.5));
          ctx.fillStyle = corC;
          ctx.fillRect(cx - 0.2 * M, yt1, 0.07 * M, piso - yt1);
          ctx.fillRect(cx + 0.13 * M, yt1, 0.07 * M, piso - yt1);
          ctx.strokeStyle = corC; ctx.lineWidth = Math.max(1, 0.025 * M);
          ctx.beginPath();
          for (let y = piso; y > yt1; y -= 0.45 * M) { ctx.moveTo(cx - 0.17 * M, y); ctx.lineTo(cx + 0.17 * M, y - 0.22 * M); ctx.lineTo(cx - 0.17 * M, y - 0.45 * M); }
          ctx.stroke();
          ctx.fillStyle = cor(tom([90, 94, 100], 0.5)); ctx.fillRect(cx - 0.32 * M, piso - 0.06 * M, 0.64 * M, 0.06 * M);
          // luminária de LED embaixo da treliça
          const ly = yt1 + 0.3 * M, lx = cx + vao / 2;
          ctx.fillStyle = cor(tom([60, 62, 66], 0.5)); ctx.fillRect(lx - 0.25 * M, ly - 0.06 * M, 0.5 * M, 0.08 * M);
          if (liga > 0) {
            ctx.fillStyle = `rgba(255,250,235,${0.95 * liga})`; ctx.fillRect(lx - 0.22 * M, ly + 0.02 * M, 0.44 * M, Math.max(1.5, 0.03 * M));
            const facho = ctx.createLinearGradient(0, ly, 0, piso);
            facho.addColorStop(0, cor(pal.farol, (escuro ? 0.1 : 0.05) * liga)); facho.addColorStop(1, cor(pal.farol, 0));
            ctx.fillStyle = facho;
            ctx.beginPath(); ctx.moveTo(lx - 0.22 * M, ly); ctx.lineTo(lx + 0.22 * M, ly); ctx.lineTo(lx + 2.4 * M, piso); ctx.lineTo(lx - 2.4 * M, piso); ctx.closePath(); ctx.fill();
          }
          const h = hash(c + 100);
          if (h < 0.35) {
            // extintor vermelho com a placa
            ctx.fillStyle = cor(tom([200, 36, 36], 0.4));
            ctx.beginPath(); ctx.roundRect(cx + 0.24 * M, piso - 1.5 * M, 0.16 * M, 0.5 * M, 0.06 * M); ctx.fill();
            ctx.fillStyle = cor(tom([40, 40, 44], 0.4)); ctx.fillRect(cx + 0.29 * M, piso - 1.6 * M, 0.06 * M, 0.1 * M);
          } else if (h < 0.6) {
            // ventilador de parede preso na coluna (gira)
            const vx = cx + 0.55 * M, vy = piso - 3.0 * M, r = 0.38 * M;
            ctx.strokeStyle = cor(tom([30, 30, 34], 0.4)); ctx.lineWidth = Math.max(1, 0.02 * M);
            ctx.beginPath(); ctx.arc(vx, vy, r, 0, 6.283); ctx.stroke();
            ctx.fillStyle = cor(tom([30, 30, 34], 0.4), 0.85);
            const g = parado ? 0 : t * 9 + c;
            for (let k = 0; k < 3; k++) { const a = g + (k * 2 * Math.PI) / 3; ctx.beginPath(); ctx.ellipse(vx + Math.cos(a) * r * 0.48, vy + Math.sin(a) * r * 0.48, r * 0.45, r * 0.16, a, 0, 6.283); ctx.fill(); }
            ctx.fillRect(cx + 0.18 * M, vy - 0.03 * M, 0.37 * M - r * 0.1, 0.06 * M);
          }
        }
      }
      // fim do galpão: a última coluna e a beirada do telhado sobre o pátio
      if (fimG > vx0 - M && fimG < vx1 + M) {
        ctx.fillStyle = cor(tom([96, 100, 106], 0.5));
        ctx.fillRect(fimG - 0.16 * M, yParede - 1.3 * M, 0.32 * M, piso - yParede + 1.3 * M);
        ctx.fillRect(fimG - 1.2 * M, yParede - 1.45 * M, 1.4 * M, 0.2 * M);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(fimG + 0.16 * M, yParede - 1.3 * M, 0.08 * M, piso - yParede + 1.3 * M);
      }
      // na parte de cima da tela inicial (antes do passeio) o fundo fica sob uma névoa da cor do tema, para os cartões
      // lerem bem; ela some quando a seção da linha entra
      const nevoa = tour ? 0.78 * (1 - suave(0.1, 0.85, entra)) : 0.78;
      if (nevoa > 0.01) { ctx.fillStyle = cor(pal.ceuTopo, nevoa); ctx.fillRect(vx0, yTopo, vx1 - vx0, piso - yTopo); }
    };

    // daqui em diante, tudo é do mundo: anda de lado com a câmera do passeio
    ctx.save();
    ctx.translate(-camX, 0);
    desenharFundoGalpao();
    // piso do estaleiro
    const chao = ctx.createLinearGradient(0, piso, 0, H);
    chao.addColorStop(0, cor(misturar(pal.brita, pal.ceuTopo, 0.25)));
    chao.addColorStop(1, cor(pal.ceuTopo));
    ctx.fillStyle = chao;
    ctx.fillRect(vx0, piso, W, H - piso);
    ctx.fillStyle = cor(pal.aco, escuro ? 0.06 : 0.25);
    ctx.fillRect(vx0, piso, W, 1);
    // piso pintado do galpão (como nas fotos): a faixa da linha avermelhada, a borda amarela e o corredor
    // cinza-azulado na frente. No pátio, a céu aberto, o chão é outro (desenhado mais adiante).
    {
      const gx0 = Math.max(vx0, xm - 80 * M), hc = H - piso;
      if (gx0 < vx1) {
        const tom = (c: RGB): RGB => (escuro ? misturar(c, pal.ceuTopo, 0.5) : c);
        ctx.fillStyle = cor(tom([158, 78, 54]), 0.85); ctx.fillRect(gx0, piso, vx1 - gx0, hc * 0.42);
        ctx.fillStyle = cor(tom([226, 182, 44]), 0.9); ctx.fillRect(gx0, piso + hc * 0.42, vx1 - gx0, Math.max(2, hc * 0.05));
        ctx.fillStyle = cor(tom([84, 104, 120]), 0.85); ctx.fillRect(gx0, piso + hc * 0.47, vx1 - gx0, hc * 0.53);
      }
    }
    {
      const escMaq = (c: RGB): RGB => (escuro ? misturar(c, pal.ceuTopo, 0.35) : c);
      const cL = Math.max(vx0, xm - 2.2 * M), cR = Math.min(vx1, xm + 3.0 * M), hc = H - piso;
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
    // Rolo opressor: só tem o rolo de baixo (motriz). Os cilindros ficam em cima e seguram, por duas chapas amarelas
    // que descem pelos lados do trilho, o eixo do rolo. Quando o soldador empurra o joystick, os cilindros recolhem
    // (sopro de ar na válvula), as chapas sobem e o rolo encosta firme embaixo do patim; o motor gira e o trilho anda.
    // Soltou, o motor para, os cilindros estendem com outro sopro e o rolo desce, deixando o trilho só apoiado.
    const apertoEm = (a: number, b: number) => suave(a - 0.4, a - 0.1, fase) * (1 - suave(b + 0.05, b + 0.35, fase));
    const aperto = parado ? 0 : Math.max(1 - suave(CHEGA + 0.05, CHEGA + 0.35, t), apertoEm(F.moveA0, F.moveA1), apertoEm(F.moveB0, F.moveB1));
    if (!parado && (aperto > 0.5) !== roloApertado) {
      roloApertado = aperto > 0.5;
      for (let i = 0; i < 7; i++) sopros.push({ x: x01 + w01 * (0.25 + Math.random() * 0.5), y: topo - 0.72 * M, vx: (Math.random() - 0.5) * 0.6 * M, vy: -(0.1 + Math.random() * 0.3) * M, r: 0.03 * M, v: 1 });
    }
    const xRolo = x01 + w01 / 2, rRolo = 0.12 * M, girou = u / rRolo;
    const subida = 0.05 * M * aperto;
    const yRb = topo + R + rRolo + 0.05 * M - subida; // centro do rolo: 5 cm abaixo do patim solto, encostado apertando
    // o desenho de um rolo opressor, em duas partes: atrás do trilho (bloco, rolo, motor) e na frente (cilindros)
    const roloAtras = (x0: number, rotulo: string) => {
      if (x0 + w01 < vx0 - M || x0 > vx1 + M) return;
      const xr = x0 + w01 / 2;
      // bloco amarelo, embaixo do trilho
      {
        const gb = ctx.createLinearGradient(x0, 0, x0 + w01, 0);
        gb.addColorStop(0, amarelo(AM_L)); gb.addColorStop(1, amarelo(AM_S));
        ctx.fillStyle = gb;
        ctx.fillRect(x0, topo + R, w01, piso - topo - R);
        ctx.fillStyle = amarelo(AM_S);
        ctx.fillRect(x0 - 0.05 * M, piso - 0.12 * M, w01 + 0.1 * M, 0.12 * M);
        ctx.fillStyle = 'rgba(20,20,20,.85)';
        ctx.font = `700 ${0.26 * M}px ${fonte('--font-barlow-cond', '"Barlow Condensed", "Arial Narrow", sans-serif')}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(rotulo, x0 + w01 * 0.5, (topo + R + piso) / 2);
        ctx.textAlign = 'left';
        // rolo de baixo (motriz), logo embaixo do patim, girando com o trilho
        ctx.fillStyle = 'rgb(56,58,64)';
        ctx.beginPath(); ctx.arc(xr, yRb, rRolo, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgb(150,154,162)'; ctx.lineWidth = Math.max(1, 0.018 * M);
        for (let k = 0; k < 4; k++) {
          const a = -girou + (k * Math.PI) / 2;
          ctx.beginPath(); ctx.moveTo(xr + Math.cos(a) * rRolo * 0.25, yRb + Math.sin(a) * rRolo * 0.25); ctx.lineTo(xr + Math.cos(a) * rRolo * 0.85, yRb + Math.sin(a) * rRolo * 0.85); ctx.stroke();
        }
        ctx.fillStyle = 'rgb(200,204,210)';
        ctx.beginPath(); ctx.arc(xr, yRb, rRolo * 0.2, 0, 6.283); ctx.fill();
        // motor e redutor ao lado
        ctx.fillStyle = cor(misturar([120, 124, 130], pal.ceuTopo, escuro ? 0.3 : 0));
        ctx.beginPath(); ctx.ellipse(x0 - 0.18 * M, piso - 0.42 * M, 0.2 * M, 0.17 * M, 0, 0, 6.283); ctx.fill();
        // tampa da ventoinha do motor: as aletas giram enquanto ele puxa
        ctx.strokeStyle = 'rgba(40,42,46,.7)'; ctx.lineWidth = Math.max(1, 0.012 * M);
        for (let k = 0; k < 6; k++) {
          const a = -girou * 3 + (k * Math.PI) / 3;
          ctx.beginPath(); ctx.moveTo(x0 - 0.3 * M, piso - 0.42 * M); ctx.lineTo(x0 - 0.3 * M + Math.cos(a) * 0.07 * M, piso - 0.42 * M + Math.sin(a) * 0.12 * M); ctx.stroke();
        }
        // lâmpada verde do "01": acesa enquanto o rolo está apertado
        const lx01 = x0 + w01 * 0.85, ly01 = topo + R + 0.12 * M;
        if (aperto > 0.5) {
          const gl = ctx.createRadialGradient(lx01, ly01, 0, lx01, ly01, 0.12 * M);
          gl.addColorStop(0, 'rgba(90,230,120,.55)'); gl.addColorStop(1, 'rgba(90,230,120,0)');
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx01, ly01, 0.12 * M, 0, 6.283); ctx.fill();
        }
        ctx.fillStyle = aperto > 0.5 ? 'rgb(110,240,140)' : 'rgb(40,90,56)';
        ctx.beginPath(); ctx.arc(lx01, ly01, 0.03 * M, 0, 6.283); ctx.fill();
        ctx.fillStyle = amarelo(AM);
        ctx.fillRect(x0 - 0.06 * M, piso - 0.6 * M, 0.1 * M, 0.36 * M);
      }
    };
    const roloFrente = (x0: number) => {
      if (x0 + w01 < vx0 - M || x0 > vx1 + M) return;
      const xr = x0 + w01 / 2;
      // travessa de cima com os dois cilindros pneumáticos
      {
        const yb = topo - 0.62 * M;
        ctx.fillStyle = amarelo(AM_S);
        ctx.fillRect(x0 - 0.02 * M, yb, 0.08 * M, topo - yb);
        ctx.fillStyle = amarelo(AM);
        ctx.fillRect(x0 - 0.05 * M, yb - 0.1 * M, w01 + 0.1 * M, 0.12 * M);
        // cilindros recolhendo puxam a travessa e as chapas laterais, que levantam o eixo do rolo de baixo
        const yTrav = topo - 0.28 * M - subida;
        for (const cx of [x0 + w01 * 0.18, x0 + w01 * 0.82]) {
          const gc = ctx.createLinearGradient(cx - 0.06 * M, 0, cx + 0.06 * M, 0);
          gc.addColorStop(0, 'rgb(150,154,160)'); gc.addColorStop(0.45, 'rgb(232,234,238)'); gc.addColorStop(1, 'rgb(120,124,130)');
          ctx.fillStyle = gc;
          ctx.fillRect(cx - 0.06 * M, yb + 0.02 * M, 0.12 * M, 0.2 * M);
          ctx.fillStyle = 'rgb(196,200,206)'; // haste: encurta quando o cilindro recolhe
          ctx.fillRect(cx - 0.018 * M, yb + 0.22 * M, 0.036 * M, Math.max(0, yTrav - yb - 0.22 * M));
        }
        ctx.fillStyle = amarelo(AM);
        ctx.fillRect(x0 + w01 * 0.1, yTrav - 0.03 * M, w01 * 0.8, 0.06 * M);
        // chapa lateral (a do lado de cá do trilho), da travessa até o eixo do rolo, com o parafuso do eixo
        const gch = ctx.createLinearGradient(xr - 0.06 * M, 0, xr + 0.06 * M, 0);
        gch.addColorStop(0, amarelo(AM_L)); gch.addColorStop(1, amarelo(AM_S));
        ctx.fillStyle = gch;
        ctx.beginPath(); ctx.roundRect(xr - 0.06 * M, yTrav, 0.12 * M, yRb - yTrav + 0.06 * M, 0.03 * M); ctx.fill();
        ctx.fillStyle = 'rgb(60,62,68)';
        ctx.beginPath(); ctx.arc(xr, yRb, 0.028 * M, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.beginPath(); ctx.arc(xr - 0.008 * M, yRb - 0.008 * M, 0.009 * M, 0, 6.283); ctx.fill();
        // válvula com o sopro de ar quando os cilindros mexem
        ctx.fillStyle = 'rgb(60,64,72)';
        ctx.fillRect(x0 + w01 * 0.45, yb - 0.16 * M, 0.1 * M, 0.07 * M);
      }
    };
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
      roloAtras(x01, "01");
    }

    // ---------- a linha inteira (passeio): posições e o que fica atrás do trilho ----------
    // Cada estação fica onde a emenda para: a barra para a cada 12 m (Geismar 12 m antes da Schlatter; patim e
    // boleteiras 36, 48 e 60 m depois, nos roletes 35, 40 e 45, como nas fotos). A preparação fica na ponta de cima,
    // os rolos opressores 02 a 04 depois do rolete 49 e o pátio do TLS depois do galpão.
    const X = (m: number) => xm + m * M;
    const xGes = X(12), xPat = X(-36), xB1 = X(-48), xB2 = X(-60), xPatio = X(-80);
    const xPassarela = X(-42);
    const xPR3 = X(-28), xCorte = X(-16.5);
    const rolosFim = [X(-72.5), X(-75), X(-77.5)].map((x) => x - w01 / 2);
    const vis = (a: number, b: number) => b > vx0 - 2 * M && a < vx1 + 2 * M;
    const parada = parado || Math.abs(vel) < 0.5;
    const trabalha = (a: number, b: number) => !parado && parada && fase > a && fase < b && t >= CHEGA;
    // boleteira: o operador empurra a máquina pendurada pelo trilho e puxa de volta (uma ida e volta inteira)
    const empurra = (a: number, b: number) => (trabalha(a, b) ? Math.sin(((fase - a) / (b - a)) * 2 * Math.PI) * 0.55 * M : 0);
    const xBol1 = xB1 + empurra(0.8, 7.8), xBol2 = xB2 + empurra(2.0, 9.0);
    // preparação, colada na Geismar: a barra nova desce nos roletes logo depois do primeiro empurrão (com a régua
    // conferindo), e o trilho da linha passa a terminar 12 m mais adiante. Parada, a ponta da linha fica 12 m depois da
    // Geismar, que lixa a emenda entre essa barra e a de antes.
    const xb0 = X(24) - d1;
    const tDesce0 = F.regua0 + 0.3, tDesce1 = F.regua0 + 1.6;
    const fimTrilho = X(24) - (u - kAtual * L) + (!parado && fase >= tDesce1 ? L : 0);
    const camadaPilha = 0.19 * M;
    const faiscasEm = (x: number, y: number, taxa: number, vx: number, vy: number, abre: number) => {
      const n = Math.round(taxa * dt + Math.random() * 0.6);
      for (let i = 0; i < n; i++) faiscas.push({ x, y, vx: vx + (Math.random() - 0.5) * abre, vy: vy + (Math.random() - 0.5) * abre * 0.6, v: 0.25 + Math.random() * 0.4 });
    };
    // chão do pátio, a céu aberto: concreto claro com brita
    if (vx0 < xPatio) {
      const x1 = Math.min(vx1, xPatio);
      ctx.fillStyle = cor(escuro ? misturar([150, 150, 146], pal.ceuTopo, 0.55) : [196, 192, 184]);
      ctx.fillRect(vx0, piso, x1 - vx0, H - piso);
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      for (let x = Math.floor(vx0 / 9) * 9; x < x1; x += 9) ctx.fillRect(x + ((x * 7) % 5), piso + 3 + ((x * 13) % 11), 2, 1.5);
    }
    // preparação: as talhas não se colocam sozinhas. Os dois operadores (um em cada pórtico) vão até a pilha, que fica
    // do outro lado da linha, engatam o gancho na barra e, pela botoeira pendurada, erguem a barra; quando ela desce nos
    // roletes, vão de novo até os ganchos e soltam. Ficam atrás da linha, de frente para quem vê a tela.
    const yVigaPrep = piso - 4.6 * M;
    const ganchosPrep = [xb0 + 0.8 * M, xb0 + L - 0.8 * M];
    const prepT = (() => {
      const yAlto = topo - 2.2 * M, yPilhaG = piso - 4 * camadaPilha - 0.02 * M, yCarga = topo - 1.4 * M, yLinha = topo - R * 0.06;
      let yG = yAlto, comBarra = false;
      if (!parado) {
        const f = fase;
        yG = mix(yAlto, yPilhaG, suave(0.6, 1.8, f));
        if (f > 3.7) yG = mix(yPilhaG, yCarga, suave(3.7, 5.3, f));
        if (f > tDesce0) yG = mix(yCarga, yLinha, suave(tDesce0, tDesce1, f));
        if (f > tDesce1 + 1.25) yG = mix(yLinha, yAlto, suave(tDesce1 + 1.25, tDesce1 + 2.25, f));
        comBarra = f > 3.65 && f < tDesce1;
      }
      return { yG, comBarra };
    })();
    // operário atrás da linha: desenhado um pouco menor e mais para o fundo; as mãos vão aonde pedimos (no mundo)
    const sAtras = 0.92;
    const atras = (ox: number, m: [number, number]): [number, number] => [ox + (m[0] - ox) / sAtras, piso + (m[1] - (piso - 0.25 * M)) / sAtras];
    const operarioAtras = (pose: PoseOperario) => {
      ctx.save(); ctx.translate(pose.sx, piso - 0.25 * M); ctx.scale(sAtras, sAtras); ctx.translate(-pose.sx, -piso);
      desenharOperario(ctx, { ...pose, maoE: pose.maoE ? atras(pose.sx, pose.maoE) : null, maoD: pose.maoD ? atras(pose.sx, pose.maoD) : null, frente: true });
      ctx.restore();
    };
    if (vis(xb0 - 2.5 * M, xb0 + L + 2.5 * M)) {
      const f = parado ? -1 : fase;
      ganchosPrep.forEach((gx, i) => {
        const lado = i === 0 ? 1 : -1;
        const descanso = gx + lado * 2.3 * M, perto = gx + lado * 0.42 * M;
        const vai = suave(0.2, 1.5, f) - suave(2.6, 3.5, f) + suave(tDesce1, tDesce1 + 0.6, f) - suave(tDesce1 + 1.2, tDesce1 + 1.9, f);
        const sx = mix(descanso, perto, vai);
        const andando = (f > 0.2 && f < 1.5) || (f > 2.6 && f < 3.5) || (f > tDesce1 && f < tDesce1 + 0.6) || (f > tDesce1 + 1.2 && f < tDesce1 + 1.9);
        const engata1 = suave(1.55, 1.85, f) * (1 - suave(2.35, 2.65, f));
        const engata2 = suave(tDesce1 + 0.6, tDesce1 + 0.8, f) * (1 - suave(tDesce1 + 1.05, tDesce1 + 1.2, f));
        const engata = Math.max(engata1, engata2);
        const segura = suave(3.4, 3.65, f) * (1 - suave(5.3, 5.6, f)) + suave(tDesce0 - 0.3, tDesce0, f) * (1 - suave(tDesce1 - 0.05, tDesce1 + 0.15, f));
        const yG = prepT.yG;
        // botoeira: na mão enquanto ergue ou baixa; senão, pendurada pelo cabo ao lado do lugar dele
        const naMao: [number, number] = [sx - lado * 0.12 * M, piso - 1.18 * M];
        const solta: [number, number] = [descanso + lado * 0.25 * M, piso - 1.25 * M];
        const bot: [number, number] = [mix(solta[0], naMao[0], segura), mix(solta[1], naMao[1], segura)];
        const gancho: [number, number] = [gx + lado * 0.06 * M, yG - 0.05 * M];
        operarioAtras({
          sx, piso, Hs: 1.72 * M, t, mq, parado, anda: andando ? 1 : 0, passo: (sx - descanso) / (0.22 * M),
          maoE: engata > 0.01 ? gancho : segura > 0.01 ? bot : null, alcE: engata > 0.01 ? engata : segura,
          maoD: engata > 0.01 ? [gancho[0] + lado * 0.08 * M, gancho[1] + 0.04 * M] : null, alcD: engata,
          dPeito: 0, curva: 0.45 * engata1 + 0.2 * engata2, agacha: 0.42 * engata1, inclina: 0,
          capacete: i === 0 ? [150, 156, 162] : [196, 44, 38], fase: 0.4 + i * 1.3,
        });
        // cabo da botoeira até a talha e a botoeira amarela
        ctx.strokeStyle = 'rgb(28,28,32)'; ctx.lineWidth = Math.max(1, 0.012 * M);
        ctx.beginPath(); ctx.moveTo(gx + lado * 0.3 * M, yVigaPrep + 0.3 * M); ctx.quadraticCurveTo(bot[0], mix(yVigaPrep, bot[1], 0.7), bot[0], bot[1] - 0.12 * M); ctx.stroke();
        ctx.fillStyle = amarelo(AM); ctx.fillRect(bot[0] - 0.05 * M, bot[1] - 0.14 * M, 0.1 * M, 0.2 * M);
        ctx.fillStyle = 'rgb(200,40,36)'; ctx.beginPath(); ctx.arc(bot[0], bot[1] - 0.1 * M, 0.025 * M, 0, 6.283); ctx.fill();
      });
    }
    // pilha de barras da preparação, atrás da linha, com calços de madeira
    if (vis(xb0, xb0 + L)) {
      for (let i = 0; i < 4; i++) {
        const yb = piso - (i + 1) * camadaPilha;
        ctx.fillStyle = cor(misturar([140, 96, 60], pal.ceuTopo, escuro ? 0.4 : 0.1));
        for (let x = xb0 + 0.6 * M; x < xb0 + L; x += 2.6 * M) ctx.fillRect(x, yb + camadaPilha * 0.72, 0.16 * M, camadaPilha * 0.28);
        const gb = ctx.createLinearGradient(0, yb, 0, yb + camadaPilha * 0.72);
        gb.addColorStop(0, cor(misturar(pal.aco, pal.acoLado, 0.35))); gb.addColorStop(1, cor(misturar(pal.acoLado, pal.ceuTopo, 0.4)));
        ctx.fillStyle = gb;
        ctx.fillRect(xb0 + i * 0.12 * M, yb, L - i * 0.24 * M, camadaPilha * 0.72);
      }
    }
    // talha elétrica de cabo de aço (como a da foto): carrinho na viga, corpo amarelo com o tambor preto, a tampa com o
    // disco vermelho e o motor azul; dois cabos descem até o moitão laranja de 2 t com o gancho amarelo
    const talha = (gx: number, yViga: number, yG: number, esc = 1) => {
      const m = M * esc;
      ctx.fillStyle = 'rgb(40,42,46)';
      for (const wx of [gx - 0.2 * m, gx + 0.2 * m]) { ctx.beginPath(); ctx.arc(wx, yViga + 0.08 * m, 0.06 * m, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = amarelo(AM_S); ctx.fillRect(gx - 0.36 * m, yViga + 0.1 * m, 0.72 * m, 0.06 * m);
      ctx.fillStyle = amarelo(AM); ctx.fillRect(gx - 0.3 * m, yViga + 0.16 * m, 0.56 * m, 0.3 * m);
      ctx.fillStyle = 'rgb(26,26,30)'; ctx.fillRect(gx - 0.2 * m, yViga + 0.2 * m, 0.34 * m, 0.22 * m);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      for (let k = 0; k < 5; k++) ctx.fillRect(gx - 0.2 * m + k * 0.07 * m, yViga + 0.2 * m, 1, 0.22 * m);
      ctx.fillStyle = amarelo(AM_L); ctx.beginPath(); ctx.roundRect(gx + 0.14 * m, yViga + 0.14 * m, 0.16 * m, 0.34 * m, 0.05 * m); ctx.fill();
      ctx.fillStyle = 'rgb(206,36,36)'; ctx.beginPath(); ctx.arc(gx + 0.22 * m, yViga + 0.31 * m, 0.065 * m, 0, 6.283); ctx.fill();
      ctx.fillStyle = cor(mq([40, 84, 170])); ctx.beginPath(); ctx.roundRect(gx - 0.5 * m, yViga + 0.2 * m, 0.22 * m, 0.18 * m, 0.04 * m); ctx.fill();
      // cabos de aço até o moitão
      const yM = yG - 0.3 * m;
      ctx.strokeStyle = 'rgb(84,86,92)'; ctx.lineWidth = Math.max(1, 0.012 * m);
      ctx.beginPath(); ctx.moveTo(gx - 0.06 * m, yViga + 0.42 * m); ctx.lineTo(gx - 0.05 * m, yM); ctx.moveTo(gx + 0.06 * m, yViga + 0.42 * m); ctx.lineTo(gx + 0.05 * m, yM); ctx.stroke();
      // moitão laranja e o gancho
      ctx.fillStyle = cor(mq([232, 112, 40])); ctx.beginPath(); ctx.roundRect(gx - 0.1 * m, yM, 0.2 * m, 0.2 * m, 0.04 * m); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(gx - 0.1 * m, yM + 0.15 * m, 0.2 * m, 0.05 * m);
      ctx.strokeStyle = 'rgb(236,186,36)'; ctx.lineWidth = Math.max(1.5, 0.035 * m);
      ctx.beginPath(); ctx.moveTo(gx, yM + 0.2 * m); ctx.lineTo(gx, yG - 0.12 * m); ctx.arc(gx, yG - 0.06 * m, 0.06 * m, -Math.PI / 2, Math.PI * 0.9); ctx.stroke();
    };
    if (vis(xb0 - 2.5 * M, xb0 + L + 2.5 * M)) {
      for (const gx of ganchosPrep) talha(gx, yVigaPrep, prepT.yG);
      if (prepT.comBarra) {
        const gb = ctx.createLinearGradient(0, prepT.yG, 0, prepT.yG + R);
        gb.addColorStop(0, cor(pal.aco)); gb.addColorStop(1, cor(misturar(pal.acoLado, pal.ceuTopo, 0.35)));
        ctx.fillStyle = gb; ctx.fillRect(xb0, prepT.yG, L, R);
      }
    }
    if (vis(xPR3 - 2.5 * M, xPR3 + 2.5 * M)) talha(xPR3, yVigaPrep, topo - 2.0 * M);
    // área de corte: plataforma amarela com escadinhas dos dois lados e as cortinas pretas de solda em cima, atrás da
    // linha; ao lado, os quadros elétricos de 380 V. Se uma solda dá errado, o trecho é cortado aqui.
    if (vis(xCorte - 4 * M, xCorte + 4 * M)) {
      const pL = xCorte - 2.0 * M, pR = xCorte + 1.6 * M, yP = piso - 0.95 * M;
      // painel preto alto atrás de tudo
      ctx.fillStyle = cor(mq([26, 28, 32])); ctx.fillRect(xCorte - 0.6 * M, piso - 3.0 * M, 3.2 * M, 2.4 * M);
      // plataforma e as pernas
      ctx.fillStyle = amarelo(AM_S);
      for (const lx of [pL + 0.1 * M, xCorte - 0.2 * M, pR - 0.15 * M]) ctx.fillRect(lx, yP, 0.08 * M, piso - yP);
      ctx.fillStyle = amarelo(AM); ctx.fillRect(pL, yP - 0.08 * M, pR - pL, 0.1 * M);
      // cortinas pretas (lona de solda), com o brilho do plástico
      for (const [cx0, cw] of [[pL + 0.1 * M, 1.7 * M], [xCorte - 0.1 * M, 1.5 * M]] as [number, number][]) {
        const gc = ctx.createLinearGradient(cx0, 0, cx0 + cw, 0);
        gc.addColorStop(0, 'rgb(20,30,26)'); gc.addColorStop(0.5, 'rgb(44,56,50)'); gc.addColorStop(1, 'rgb(18,24,22)');
        ctx.fillStyle = gc; ctx.fillRect(cx0, yP - 1.25 * M, cw, 1.15 * M);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        for (let k = 0; k < 4; k++) ctx.fillRect(cx0 + (0.2 + k * 0.4) * M, yP - 1.15 * M, Math.max(1, 0.03 * M), 0.5 * M);
      }
      // guarda-corpo de tubo amarelo
      ctx.strokeStyle = amarelo(AM); ctx.lineWidth = Math.max(1.5, 0.05 * M);
      ctx.beginPath();
      ctx.moveTo(pL, yP - 1.3 * M); ctx.lineTo(pR, yP - 1.3 * M);
      for (const lx of [pL, xCorte - 0.15 * M, pR]) { ctx.moveTo(lx, yP - 0.05 * M); ctx.lineTo(lx, yP - 1.3 * M); }
      // escadinhas dos dois lados
      ctx.moveTo(pL, yP); ctx.lineTo(pL - 0.9 * M, piso); ctx.moveTo(pR, yP); ctx.lineTo(pR + 0.9 * M, piso);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 0.03 * M);
      ctx.beginPath();
      for (let k = 1; k < 4; k++) { const f = k / 4; for (const [a0, a1] of [[pL, pL - 0.9 * M], [pR, pR + 0.9 * M]]) { const sx = mix(a0, a1, f), sy = mix(yP, piso, f); ctx.moveTo(sx - 0.15 * M, sy); ctx.lineTo(sx + 0.15 * M, sy); } }
      ctx.stroke();
      // quadros elétricos bege com as placas vermelhas de perigo
      for (const qx of [pR + 1.2 * M, pR + 2.0 * M]) {
        ctx.fillStyle = cor(mq([206, 200, 182])); ctx.fillRect(qx, piso - 2.0 * M, 0.75 * M, 1.85 * M);
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(qx + 0.37 * M, piso - 2.0 * M, 1, 1.85 * M);
        ctx.fillStyle = cor(mq([196, 40, 40])); ctx.fillRect(qx + 0.1 * M, piso - 1.85 * M, 0.55 * M, 0.2 * M);
        ctx.fillStyle = 'rgb(250,250,250)'; ctx.fillRect(qx + 0.15 * M, piso - 1.6 * M, 0.45 * M, 0.12 * M);
        ctx.fillStyle = cor(mq([90, 92, 96])); ctx.fillRect(qx + 0.05 * M, piso - 0.15 * M, 0.1 * M, 0.15 * M); ctx.fillRect(qx + 0.6 * M, piso - 0.15 * M, 0.1 * M, 0.15 * M);
      }
    }
    // grade de tela preta com postes amarelos atrás da linha, por todo o galpão (como nas fotos); abre na Schlatter,
    // na área de corte e na passarela
    {
      const trechos: [number, number][] = [[X(-79), X(-43.2)], [X(-40.8), X(-21)], [X(-12), X(-2.4)], [X(2.4), X(36)]];
      const yT = piso - 1.25 * M, malha = Math.max(5, 0.12 * M);
      for (const [a, b] of trechos) {
        const a0 = Math.max(a, vx0 - M), a1 = Math.min(b, vx1 + M);
        if (a0 >= a1) continue;
        ctx.strokeStyle = cor(mq([40, 42, 46]), escuro ? 0.5 : 0.6); ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = a + Math.ceil((a0 - a) / malha) * malha; x <= a1; x += malha) { ctx.moveTo(x, yT); ctx.lineTo(x, piso - 0.05 * M); }
        for (let y = yT; y <= piso - 0.05 * M; y += malha) { ctx.moveTo(a0, y); ctx.lineTo(a1, y); }
        ctx.stroke();
        ctx.fillStyle = cor(mq([34, 36, 40])); ctx.fillRect(a0, yT - 0.04 * M, a1 - a0, 0.06 * M);
        for (let x = a + Math.ceil((a0 - a) / (2.5 * M)) * 2.5 * M; x <= a1 + 1; x += 2.5 * M) {
          ctx.fillStyle = amarelo(AM_S); ctx.fillRect(x - 0.035 * M, yT - 0.05 * M, 0.07 * M, piso - yT + 0.05 * M);
          ctx.fillStyle = 'rgba(20,20,22,.8)'; ctx.fillRect(x - 0.035 * M, yT + 0.1 * M, 0.07 * M, 0.08 * M);
        }
      }
    }
    // tubo azul que sai das mangueiras da Geismar e o coletor de pó Donaldson (caixa azul) ao lado
    if (vis(xGes - M, xGes + 5 * M)) {
      const yTubo = piso - 3.6 * M, cX = xGes + 3.4 * M, cW = 1.3 * M, cTop = piso - 2.4 * M;
      const azul = (k = 0) => cor(mq([38 + k, 92 + k, 172 + k]));
      ctx.fillStyle = azul(4);
      ctx.fillRect(xGes - 0.45 * M, yTubo - 0.13 * M, cX + cW * 0.5 - xGes + 0.45 * M, 0.26 * M);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(xGes - 0.45 * M, yTubo - 0.13 * M, cX + cW * 0.5 - xGes + 0.45 * M, 0.06 * M);
      ctx.fillStyle = azul(4); ctx.fillRect(cX + cW * 0.5 - 0.13 * M, yTubo, 0.26 * M, cTop - yTubo - 0.3 * M);
      // coletor: caixa azul com a chaminé em cima, a porta e as pernas
      ctx.fillStyle = azul(-6); ctx.fillRect(cX, cTop, cW, piso - cTop - 0.25 * M);
      ctx.fillStyle = azul(8); ctx.fillRect(cX + cW * 0.3, cTop - 0.3 * M, cW * 0.4, 0.3 * M);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(cX + cW * 0.35, cTop + 0.5 * M, cW * 0.35, 1.0 * M);
      ctx.fillStyle = azul(-20);
      for (const lx of [cX + 0.05 * M, cX + cW - 0.13 * M]) ctx.fillRect(lx, piso - 0.25 * M, 0.08 * M, 0.25 * M);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = `700 ${0.11 * M}px ${fonte('--font-barlow-cond', '"Barlow Condensed", "Arial Narrow", sans-serif')}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Donaldson', cX + cW / 2, cTop + 0.25 * M);
      ctx.textAlign = 'left';
    }
    // balancim azul das boleteiras: viga no alto com colunas; a boleteira 1 fica pendurada nele
    const yBal = piso - 3.9 * M;
    if (vis(X(-63), X(-45))) {
      const azul = (k = 0) => cor(mq([40 + k, 86 + k, 160 + k]));
      for (const cx of [X(-45.5), X(-54), X(-62.5)]) { ctx.fillStyle = azul(-8); ctx.fillRect(cx - 0.1 * M, yBal, 0.2 * M, piso - yBal); }
      ctx.fillStyle = azul(6); ctx.fillRect(X(-62.8), yBal - 0.18 * M, X(-45.2) - X(-62.8), 0.2 * M);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(X(-62.8), yBal - 0.18 * M, X(-45.2) - X(-62.8), 0.05 * M);
    }
    // passarela: a escada do outro lado da linha (depois de passar por cima do trilho, desce do lado de lá)
    const yDeck = piso - 2.1 * M, pas0 = xPassarela - 0.7 * M, pas1 = xPassarela + 0.7 * M;
    if (vis(pas0 - 3 * M, pas1 + 3 * M)) {
      const am = cor(mq(escuro ? [150, 120, 30] : [176, 140, 32]));
      ctx.strokeStyle = am; ctx.lineWidth = Math.max(1.5, 0.05 * M);
      const e0 = pas0, e1 = pas0 - 2.2 * M;
      ctx.beginPath();
      ctx.moveTo(e0, yDeck); ctx.lineTo(e1, piso - 0.5 * M);
      ctx.moveTo(e0, yDeck - 0.95 * M); ctx.lineTo(e1, piso - 1.4 * M);
      for (const px of [pas0, pas1]) { ctx.moveTo(px, yDeck); ctx.lineTo(px, piso - 0.5 * M); }
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 0.03 * M);
      ctx.beginPath();
      for (let k = 1; k < 9; k++) { const f = k / 9; const sx = mix(e0, e1, f), sy = mix(yDeck, piso - 0.5 * M, f); ctx.moveTo(sx - 0.1 * M, sy); ctx.lineTo(sx + 0.1 * M, sy); }
      ctx.stroke();
    }
    // boleteira 2: o operador fica do outro lado da linha, de frente para quem vê a tela, segurando a alça da máquina
    if (vis(xBol2 - M, xBol2 + 2 * M)) {
      const quente2 = trabalha(2.0, 9.0);
      const yBarra2 = topo - 0.52 * M;
      operarioAtras({
        sx: xBol2 + 0.75 * M, piso, Hs: 1.72 * M, t, mq, parado, anda: quente2 ? 0.5 : 0, passo: t * 3.2,
        maoE: [xBol2 + 0.25 * M, yBarra2], alcE: 1, maoD: [xBol2 + 0.5 * M, yBarra2], alcD: 1, dPeito: 0,
        curva: 0.1, agacha: 0.05, inclina: -0.2, capacete: [196, 44, 38], fase: 2.4, quente: true,
      });
    }
    // três rolos opressores no fim da linha (bloco e rolo atrás do trilho)
    rolosFim.forEach((x0, i) => roloAtras(x0, String(i + 2).padStart(2, '0')));
    // pilha do TLS no pátio, atrás da linha: cresce enquanto a pessoa fica olhando
    const tlsX0 = X(-110), tlsX1 = X(-82);
    if (vis(tlsX0, tlsX1)) {
      // cavaletes vermelhos embaixo da pilha
      for (let x = tlsX0 + 0.8 * M; x < tlsX1; x += 3.4 * M) {
        ctx.fillStyle = cor(escuro ? misturar([178, 46, 38], pal.ceuTopo, 0.35) : [178, 46, 38]);
        ctx.beginPath(); ctx.moveTo(x - 0.3 * M, piso); ctx.lineTo(x - 0.12 * M, piso - 0.22 * M); ctx.lineTo(x + 0.12 * M, piso - 0.22 * M); ctx.lineTo(x + 0.3 * M, piso); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 0.2 * M, piso - 0.22 * M, 0.4 * M, 0.04 * M);
      }
      for (let i = 0; i < tlsCamadas; i++) {
        const yb = piso - 0.2 * M - (i + 1) * 0.15 * M;
        ctx.fillStyle = cor(misturar([140, 96, 60], pal.ceuTopo, escuro ? 0.4 : 0.05));
        for (let x = tlsX0 + 0.5 * M; x < tlsX1; x += 3 * M) ctx.fillRect(x, yb + 0.1 * M, 0.14 * M, 0.05 * M);
        ctx.fillStyle = cor(misturar(misturar(pal.aco, pal.acoLado, 0.45), [120, 70, 40], 0.12 + (i % 3) * 0.04));
        ctx.fillRect(tlsX0 + (i % 2) * 0.2 * M, yb, tlsX1 - tlsX0 - (i % 2) * 0.4 * M, 0.1 * M);
      }
    }

    // onde já tem máquina embaixo do trilho não vai rolete
    const ocupado = (x: number) =>
      [x01, ...rolosFim].some((x0) => x > x0 - 0.3 * M && x < x0 + w01 + 0.3 * M) ||
      Math.abs(x - xGes) < 1.8 * M || Math.abs(x - xPat) < 1.6 * M;

    // ---------- roletes ----------
    // Rolos de aço deitados atravessando o trilho (não são bolas), em suportes de chapa amarela parafusados no chão,
    // um a cada 2,5 m e numerados como na linha (o número cresce no sentido em que o trilho anda, para a esquerda).
    // Giram com o trilho só quando ele anda. Onde fica o rolo opressor "01" não tem rolete.
    const esp = 2.5 * M;
    const yRol = topo + R + rr;
    const fx = rr * 2.4, fy = -rr * 1.2; // o comprimento do rolo indo para trás (vista um pouco de cima)
    for (let x = xc + Math.floor((vx0 - xc) / esp - 1) * esp; x < vx1 + esp; x += esp) {
      if (ocupado(x)) continue;
      const num = Math.round((X(50) - x) / esp) + 1; // o 1 fica no começo da preparação
      const amPe = amarelo(AM), amPeS = amarelo(AM_S), amPeL = amarelo(AM_L);
      const pe = (px: number, py: number, claro: string, escuroC: string) => {
        // suporte reto de chapa dobrada, com o mancal em cima
        const g = ctx.createLinearGradient(px - rr * 0.6, 0, px + rr * 0.6, 0);
        g.addColorStop(0, claro); g.addColorStop(1, escuroC);
        ctx.fillStyle = g;
        ctx.fillRect(px - rr * 0.45, py, rr * 0.9, piso - py - 0.04 * M);
        ctx.fillRect(px - rr * 0.75, py - rr * 0.45, rr * 1.5, rr * 0.9); // mancal
      };
      // pé e mancal de trás (do outro lado do trilho)
      pe(x + fx, yRol + fy, amPeS, amPeS);
      // corpo do rolo, de trás para a frente
      ctx.save(); ctx.translate(x, yRol); ctx.rotate(Math.atan2(fy, fx));
      const gc = ctx.createLinearGradient(0, -rr, 0, rr);
      gc.addColorStop(0, cor(misturar(pal.aco, [255, 255, 255], 0.15))); gc.addColorStop(0.45, cor(misturar(pal.aco, pal.acoLado, 0.45))); gc.addColorStop(1, cor(misturar(pal.acoLado, pal.ceuTopo, 0.4)));
      ctx.fillStyle = gc;
      ctx.fillRect(0, -rr, Math.hypot(fx, fy), rr * 2);
      ctx.restore();
      // face redonda da frente, com as marcas que giram com o trilho
      const gf = ctx.createRadialGradient(x - rr * 0.3, yRol - rr * 0.35, rr * 0.1, x, yRol, rr);
      gf.addColorStop(0, cor(misturar(pal.aco, [255, 255, 255], 0.2))); gf.addColorStop(1, cor(misturar(pal.acoLado, pal.ceuTopo, 0.25)));
      ctx.fillStyle = gf; ctx.beginPath(); ctx.arc(x, yRol, rr, 0, 6.283); ctx.fill();
      const giro = -u / rr;
      ctx.strokeStyle = cor(misturar(pal.acoLado, [0, 0, 0], 0.5), 0.6); ctx.lineWidth = Math.max(1, rr * 0.12);
      for (let k = 0; k < 3; k++) {
        const a = giro + (k * 2 * Math.PI) / 3;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * rr * 0.3, yRol + Math.sin(a) * rr * 0.3); ctx.lineTo(x + Math.cos(a) * rr * 0.8, yRol + Math.sin(a) * rr * 0.8); ctx.stroke();
      }
      // pedestal da frente (como nas fotos): trapézio amarelo com a grade de ventilação em cima e o número grande
      {
        const yP = yRol + rr * 0.35, topoW = 0.36 * M, baseW = 0.62 * M;
        const gp = ctx.createLinearGradient(x - baseW / 2, 0, x + baseW / 2, 0);
        gp.addColorStop(0, amPeL); gp.addColorStop(1, amPeS);
        ctx.fillStyle = gp;
        ctx.beginPath();
        ctx.moveTo(x - topoW / 2, yP); ctx.lineTo(x + topoW / 2, yP); ctx.lineTo(x + baseW / 2, piso); ctx.lineTo(x - baseW / 2, piso); ctx.closePath(); ctx.fill();
        ctx.fillStyle = amPe; ctx.fillRect(x - topoW / 2 - 0.02 * M, yP - 0.03 * M, topoW + 0.04 * M, 0.05 * M);
        // grade de ventilação
        const gx0 = x - 0.12 * M, gy0 = yP + 0.07 * M, gw = 0.24 * M, gh = 0.15 * M;
        ctx.fillStyle = 'rgba(20,20,22,.6)'; ctx.fillRect(gx0, gy0, gw, gh);
        ctx.strokeStyle = 'rgba(200,200,200,.55)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = gx0; gx <= gx0 + gw + 0.1; gx += Math.max(2.5, 0.035 * M)) { ctx.moveTo(gx, gy0); ctx.lineTo(gx, gy0 + gh); }
        for (let gy = gy0; gy <= gy0 + gh + 0.1; gy += Math.max(2.5, 0.035 * M)) { ctx.moveTo(gx0, gy); ctx.lineTo(gx0 + gw, gy); }
        ctx.stroke();
        // eixo do rolo saindo do mancal
        ctx.fillStyle = cor(misturar(pal.acoLado, [0, 0, 0], 0.5));
        ctx.beginPath(); ctx.arc(x, yRol, rr * 0.22, 0, 6.283); ctx.fill();
        // número pintado de preto
        if (num >= 1 && num <= 49) {
          const tn = Math.max(7, 0.17 * M);
          ctx.fillStyle = 'rgba(16,16,18,.88)';
          ctx.font = `700 ${tn}px ${fonte('--font-barlow-cond', '"Barlow Condensed", "Arial Narrow", sans-serif')}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(num).padStart(2, '0'), x, (gy0 + gh + piso) / 2);
          ctx.textAlign = 'left';
        }
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        for (const bx of [x - baseW / 2 + 0.05 * M, x + baseW / 2 - 0.05 * M]) { ctx.beginPath(); ctx.arc(bx, piso - 0.022 * M, Math.max(1, 0.012 * M), 0, 6.283); ctx.fill(); }
      }
    }

    // ---------- o trilho (perfil de lado, um pouco visto de cima) ----------
    // a linha termina na última barra que o pórtico colocou (do lado da preparação)
    ctx.save();
    ctx.beginPath(); ctx.rect(vx0 - 10, -H, Math.max(0, fimTrilho - vx0 + 10), H * 3); ctx.clip();
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
    ctx.fillStyle = sombra; ctx.fillRect(vx0, piso, W, R * 0.5);
    for (const f of faixas) {
      const y0 = topo + f.y0 * R, y1 = topo + f.y1 * R;
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, cor(f.topo)); g.addColorStop(1, cor(f.base));
      ctx.fillStyle = g;
      ctx.fillRect(vx0, y0, W, y1 - y0 + 0.5);
    }
    // fios de luz nas arestas (boleto e patim) e a sombra do boleto caindo na alma
    ctx.fillStyle = `rgba(255,255,255,${escuro ? 0.55 : 0.8})`;
    ctx.fillRect(vx0, topo - R * 0.06, W, 1.2);
    ctx.fillStyle = `rgba(255,255,255,${escuro ? 0.22 : 0.4})`;
    ctx.fillRect(vx0, topo + R * 0.765, W, 1);
    const somb = ctx.createLinearGradient(0, topo + R * 0.29, 0, topo + R * 0.42);
    somb.addColorStop(0, 'rgba(0,0,0,.35)'); somb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = somb; ctx.fillRect(vx0, topo + R * 0.29, W, R * 0.13);
    // textura do aço andando com o trilho
    if (!padrao) padrao = ctx.createPattern(tex, 'repeat');
    if (padrao) {
      ctx.save();
      ctx.translate(Math.floor(vx0 / 256) * 256 - (u % 256), topo - R * 0.07);
      ctx.fillStyle = padrao;
      ctx.globalAlpha = escuro ? 0.9 : 0.55;
      ctx.fillRect(0, 0, W + 512, R * 1.07);
      ctx.restore();
    }
    // brilho que corre na lateral do boleto
    const pos = ((t * 0.05) % 1.6) - 0.3;
    const brilho = ctx.createLinearGradient(vx0, 0, vx1, 0);
    brilho.addColorStop(0, 'rgba(255,255,255,0)');
    brilho.addColorStop(Math.min(1, Math.max(0, pos)), 'rgba(255,255,255,0)');
    brilho.addColorStop(Math.min(1, Math.max(0, pos + 0.12)), `rgba(255,255,255,${escuro ? 0.22 : 0.35})`);
    brilho.addColorStop(Math.min(1, Math.max(0, pos + 0.24)), 'rgba(255,255,255,0)');
    brilho.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = brilho;
    ctx.fillRect(vx0, topo + R * 0.04, W, R * 0.05);
    ctx.fillRect(vx0, topo + R * 0.79, W, R * 0.03);

    // emendas e a marcação de caneta de tinta na alma de cada barra: S-01, S-02... (a S-01 é a que já está
    // passando pela máquina na abertura; as barras de antes ficam sem número)
    const kMin = Math.floor((u + vx0 - xm) / L) - 1, kMax = Math.ceil((u + vx1 - xm) / L) + 1;
    const hMarca = Math.max(7, R * 0.52);
    for (let k = kMin; k <= kMax; k++) {
      const x = xm + k * L - u;
      const nBarra = k + 2;
      const xg = x + L * 0.42;
      if (nBarra >= 1 && xg > vx0 - 100 && xg < vx1 + 100) {
        const marca = marcaCaneta(`S-${String(nBarra).padStart(2, '0')}`, nBarra);
        desenharMarcaCaneta(ctx, marca, xg - (marca.largura * hMarca) / 2, topo + R * 0.55 - hMarca / 2, hMarca, escuro ? 0.62 : 0.9);
      }
      if (x < vx0 - R || x > vx1 + R) continue;
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
    ctx.restore(); // fim do recorte do trilho
    if (fimTrilho > vx0 && fimTrilho < vx1 + R) {
      // ponta da barra cortada
      ctx.fillStyle = cor(misturar(pal.acoLado, pal.ceuTopo, 0.2));
      ctx.fillRect(fimTrilho - 2, topo - R * 0.06, 2, R * 1.06);
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
      roloFrente(x01);
      for (const b of sopros) { b.x += b.vx * dt; b.y += b.vy * dt; b.r += dt * 0.25 * M; b.v -= dt * 1.6; }
      for (let i = sopros.length - 1; i >= 0; i--) if (sopros[i].v <= 0) sopros.splice(i, 1);
      for (const b of sopros) {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(235,240,245,${0.35 * b.v})`); g.addColorStop(1, 'rgba(235,240,245,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
      }
    }

    // ---------- a linha inteira (passeio): máquinas e gente na frente do trilho ----------
    {
      const Hp = 1.75 * M;
      const cinzaMaq = (c: number) => cor(mq([c, c + 4, c + 10]));
      // Geismar BRA 32 (como na foto): corpo amarelo sobre a base azul, com a janelinha do disco e a placa "BRA 32".
      // A máquina fica parada: o operador só aperta os botões da botoeira e quem mexe são os rebolos lá dentro,
      // descendo até o trilho e indo e voltando ao longo da ponta.
      // As duas mangueiras pretas sobem do corpo até o tubo azul que leva o pó para o coletor (desenhado atrás).
      if (vis(xGes - 2 * M, xGes + 3.5 * M)) {
        const lixa = trabalha(1.0, 6.5);
        const cx = xGes;
        const rebolo = lixa ? Math.sin((fase - 1.0) * 1.6) * 0.09 * M : 0;
        const azul = (k = 0) => cor(mq([38 + k, 92 + k, 172 + k]));
        // base azul no chão e os dois pilares azuis que prendem o trilho, um de cada lado
        ctx.fillStyle = azul(-10);
        ctx.fillRect(xGes - 1.65 * M, piso - 0.14 * M, 3.3 * M, 0.14 * M);
        for (const px of [xGes - 1.5 * M, xGes + 1.5 * M]) {
          ctx.fillStyle = azul(0);
          ctx.fillRect(px - 0.1 * M, topo - 0.32 * M, 0.2 * M, piso - topo + 0.32 * M);
          ctx.fillStyle = azul(18);
          ctx.fillRect(px - 0.07 * M, topo - 0.62 * M, 0.14 * M, 0.3 * M); // cilindro em cima
          ctx.fillStyle = 'rgba(0,0,0,.25)';
          ctx.fillRect(px - 0.1 * M, topo + R + 0.02 * M, 0.2 * M, 0.06 * M);
        }
        // gabinete amarelo (como na foto): a janela grande de canto arredondado com a borracha preta, por onde se vê o
        // rebolo de flap girando sobre a ponta do trilho; embaixo, o funil onde cai o pó
        const gL = cx - 0.62 * M, gR = cx + 0.62 * M, gT = topo - 1.35 * M, gB = topo + R + 0.3 * M;
        const gC = ctx.createLinearGradient(gL, 0, gR, 0);
        gC.addColorStop(0, amarelo(AM_L)); gC.addColorStop(1, amarelo(AM_S));
        ctx.fillStyle = gC; ctx.fillRect(gL, gT, gR - gL, gB - gT);
        ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(gL, gB - 0.04 * M, gR - gL, 0.04 * M);
        // funil e a boca embaixo, com as pernas
        ctx.fillStyle = amarelo(AM_S);
        ctx.beginPath(); ctx.moveTo(gL + 0.12 * M, gB); ctx.lineTo(gR - 0.12 * M, gB); ctx.lineTo(cx + 0.14 * M, piso - 0.45 * M); ctx.lineTo(cx - 0.14 * M, piso - 0.45 * M); ctx.closePath(); ctx.fill();
        ctx.fillStyle = amarelo(AM); ctx.fillRect(cx - 0.11 * M, piso - 0.46 * M, 0.22 * M, 0.32 * M);
        for (const lx of [gL + 0.04 * M, gR - 0.16 * M]) {
          ctx.fillStyle = amarelo(AM);
          ctx.beginPath(); ctx.moveTo(lx, gB); ctx.lineTo(lx + 0.12 * M, gB); ctx.lineTo(lx + 0.12 * M + (lx < cx ? 0.06 : -0.06) * M, piso - 0.14 * M); ctx.lineTo(lx + (lx < cx ? 0.06 : -0.06) * M, piso - 0.14 * M); ctx.closePath(); ctx.fill();
        }
        // janela
        const jx = gL + 0.13 * M, jy = topo - 0.98 * M, jw = 0.86 * M, jh = 1.22 * M, jr = 0.12 * M;
        ctx.fillStyle = 'rgb(24,24,26)'; ctx.beginPath(); ctx.roundRect(jx - 0.05 * M, jy - 0.05 * M, jw + 0.1 * M, jh + 0.1 * M, jr + 0.05 * M); ctx.fill();
        ctx.save();
        ctx.beginPath(); ctx.roundRect(jx, jy, jw, jh, jr); ctx.clip();
        ctx.fillStyle = cor(mq([96, 82, 52])); ctx.fillRect(jx, jy, jw, jh);
        ctx.fillStyle = cor(mq([70, 60, 40])); ctx.fillRect(jx + jw * 0.25, jy + 0.1 * M, jw * 0.42, jh * 0.6);
        // a ponta do trilho lá dentro
        ctx.fillStyle = cor(misturar(pal.acoLado, pal.ceuTopo, 0.3)); ctx.fillRect(jx, topo - R * 0.06, jw, R * 1.06);
        ctx.fillStyle = cor(pal.aco); ctx.fillRect(jx, topo - R * 0.06, jw, R * 0.2);
        // rebolo de flap (franja marrom e o cubo de alumínio)
        const dcx = jx + jw * 0.55 + rebolo, dcy = topo - (lixa ? 0.2 : 0.36) * M, dr = 0.21 * M;
        ctx.fillStyle = 'rgb(104,74,52)'; ctx.beginPath(); ctx.arc(dcx, dcy, dr, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(40,26,18,.6)'; ctx.lineWidth = 1;
        const giraD = parado ? 0 : t * (lixa ? 30 : 0.4);
        ctx.beginPath();
        for (let k = 0; k < 24; k++) { const a = giraD + (k * Math.PI) / 12; ctx.moveTo(dcx + Math.cos(a) * dr * 0.62, dcy + Math.sin(a) * dr * 0.62); ctx.lineTo(dcx + Math.cos(a) * dr, dcy + Math.sin(a) * dr); }
        ctx.stroke();
        const gh = ctx.createRadialGradient(dcx - dr * 0.2, dcy - dr * 0.2, 0, dcx, dcy, dr * 0.6);
        gh.addColorStop(0, 'rgb(236,238,240)'); gh.addColorStop(1, 'rgb(150,154,160)');
        ctx.fillStyle = gh; ctx.beginPath(); ctx.arc(dcx, dcy, dr * 0.58, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(80,84,90,.7)'; ctx.beginPath(); ctx.arc(dcx, dcy, dr * 0.4, 0, 6.283); ctx.stroke();
        ctx.fillStyle = 'rgb(60,62,66)';
        for (const [ox, oy] of [[-0.03, 0], [0.03, 0]]) { ctx.beginPath(); ctx.arc(dcx + ox * M, dcy + oy * M, 0.012 * M, 0, 6.283); ctx.fill(); }
        if (lixa) {
          const g = ctx.createRadialGradient(dcx, topo, 0, dcx, topo, 0.5 * M);
          g.addColorStop(0, 'rgba(255,190,110,.6)'); g.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = g; ctx.fillRect(jx, jy, jw, jh);
        }
        // reflexo no vidro
        ctx.fillStyle = 'rgba(255,255,255,.1)';
        ctx.beginPath(); ctx.moveTo(jx, jy + jh * 0.2); ctx.lineTo(jx + jw * 0.35, jy); ctx.lineTo(jx + jw * 0.5, jy); ctx.lineTo(jx, jy + jh * 0.42); ctx.closePath(); ctx.fill();
        ctx.restore();
        if (lixa) {
          faiscasEm(gL - 0.02 * M, topo + R * 0.3, 90, -180, -30, 200);
          faiscasEm(gR + 0.02 * M, topo + R * 0.3, 70, 180, -30, 200);
        }
        // puxador da porta
        ctx.fillStyle = 'rgb(56,58,62)'; ctx.fillRect(gR - 0.11 * M, topo - 0.3 * M, 0.05 * M, 0.28 * M);
        // mecanismo amarelo do lado, com os parafusos
        ctx.fillStyle = amarelo(AM_S); ctx.fillRect(gR, topo - 0.5 * M, 0.34 * M, piso - 0.3 * M - topo + 0.5 * M);
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        for (const [bx, by] of [[0.08, -0.4], [0.26, -0.4], [0.08, 0.5], [0.26, 0.5]]) { ctx.beginPath(); ctx.arc(gR + bx * M, topo + by * M, 0.02 * M, 0, 6.283); ctx.fill(); }
        ctx.fillStyle = azul(10); ctx.fillRect(gR + 0.06 * M, piso - 1.05 * M, 0.22 * M, 0.2 * M);
        // placa "BRA 32": branca, letras azuis e o risco azul embaixo
        const yTop = gT;
        ctx.fillStyle = 'rgb(244,244,240)';
        ctx.beginPath(); ctx.roundRect(gL + 0.13 * M, gT + 0.07 * M, 0.86 * M, 0.24 * M, 0.03 * M); ctx.fill();
        ctx.fillStyle = cor(mq([46, 98, 196]));
        ctx.font = `800 ${0.17 * M}px ${fonte('--font-barlow', 'Arial, Helvetica, sans-serif')}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('BRA 32', gL + 0.56 * M, gT + 0.17 * M);
        ctx.textAlign = 'left';
        ctx.strokeStyle = cor(mq([46, 98, 196])); ctx.lineWidth = Math.max(1, 0.015 * M);
        ctx.beginPath(); ctx.moveTo(gL + 0.2 * M, gT + 0.27 * M); ctx.quadraticCurveTo(gL + 0.56 * M, gT + 0.24 * M, gL + 0.92 * M, gT + 0.28 * M); ctx.stroke();
        // bocais e as duas mangueiras pretas sanfonadas subindo até o tubo azul (o tubo e o coletor ficam atrás)
        const yTubo = piso - 3.6 * M;
        for (const [ox, tx] of [[-0.38, -0.25], [0.3, 0.55]] as [number, number][]) {
          const bx = cx + ox * M;
          const x2 = xGes + tx * M;
          ctx.strokeStyle = 'rgb(26,27,30)'; ctx.lineWidth = Math.max(3, 0.17 * M); ctx.lineCap = 'butt';
          ctx.beginPath(); ctx.moveTo(bx, yTop + 0.02 * M);
          ctx.bezierCurveTo(bx, yTop - 1.0 * M, x2, yTubo + 0.9 * M, x2, yTubo + 0.1 * M); ctx.stroke();
          ctx.strokeStyle = 'rgba(210,190,150,.22)'; ctx.lineWidth = Math.max(2, 0.15 * M);
          ctx.setLineDash([Math.max(1, 0.02 * M), Math.max(2, 0.045 * M)]);
          ctx.beginPath(); ctx.moveTo(bx, yTop + 0.02 * M);
          ctx.bezierCurveTo(bx, yTop - 1.0 * M, x2, yTubo + 0.9 * M, x2, yTubo + 0.1 * M); ctx.stroke();
          ctx.setLineDash([]);
        }
        // botoeira num poste amarelo, ao lado da máquina, e o operador apertando os botões
        const bpx = xGes + 1.95 * M, byT = piso - 1.42 * M;
        ctx.fillStyle = amarelo(AM_S); ctx.fillRect(bpx - 0.04 * M, byT + 0.32 * M, 0.08 * M, piso - byT - 0.32 * M);
        ctx.fillStyle = cor(mq([196, 200, 204])); ctx.fillRect(bpx - 0.13 * M, byT, 0.26 * M, 0.34 * M);
        ctx.fillStyle = 'rgb(200,40,36)'; ctx.beginPath(); ctx.arc(bpx, byT - 0.02 * M, 0.05 * M, Math.PI, 0); ctx.fill();
        const botoes: [number, number, string][] = [[-0.06, 0.09, 'rgb(40,170,90)'], [0.06, 0.09, 'rgb(220,60,50)'], [-0.06, 0.2, 'rgb(240,190,40)'], [0.06, 0.2, 'rgb(50,110,200)']];
        for (const [bx, by, c] of botoes) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bpx + bx * M, byT + by * M, 0.03 * M, 0, 6.283); ctx.fill(); }
        // aperta um botão quando a máquina começa, outro quando ela troca de lado
        const aperta = !parado && ((fase > 0.6 && fase < 1.1) || (fase > 3.6 && fase < 4.0) || (fase > 6.3 && fase < 6.7));
        desenharOperario(ctx, {
          sx: bpx + 0.38 * M, piso, Hs: Hp, t, mq, parado, anda: 0, passo: 0,
          maoE: [bpx + (aperta ? 0.02 : 0.08) * M, byT + (aperta ? 0.1 : 0.16) * M], alcE: aperta ? 1 : 0.55, maoD: null, alcD: 0, dPeito: 0,
          curva: 0.05, agacha: 0, inclina: 0, capacete: [196, 44, 38], fase: 0.9,
        });
      }
      // patim: corre num trilho amarelo no chão, por baixo da barra, e lixa embaixo da emenda (tira o volume da
      // solda). O operador comanda pelos volantes; botoeira com o botão de emergência ao lado. Trabalho a quente.
      if (vis(xPat - 3.5 * M, xPat + 3.5 * M)) {
        const lixa = trabalha(1.5, 7.5);
        const vai = lixa ? Math.sin((fase - 1.5) * 1.05) * 0.6 * M : 0;
        const px = xPat + vai;
        // trilho amarelo no chão
        ctx.fillStyle = amarelo(AM_S); ctx.fillRect(xPat - 3.2 * M, piso - 0.07 * M, 6.4 * M, 0.07 * M);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(xPat - 3.2 * M, piso - 0.045 * M, 6.4 * M, 0.015 * M);
        // corpo amarelo com as grades, rodando no trilho
        const yT = topo + R + 0.28 * M;
        const gP = ctx.createLinearGradient(px - 0.8 * M, 0, px + 0.8 * M, 0);
        gP.addColorStop(0, amarelo(AM_L)); gP.addColorStop(1, amarelo(AM_S));
        ctx.fillStyle = gP; ctx.fillRect(px - 0.8 * M, yT, 1.6 * M, piso - 0.1 * M - yT);
        ctx.strokeStyle = 'rgba(30,30,30,.55)'; ctx.lineWidth = 1;
        for (const [gx, gw] of [[px - 0.72 * M, 0.55 * M], [px + 0.05 * M, 0.62 * M]] as [number, number][]) {
          const gy = yT + 0.1 * M, gh = piso - 0.28 * M - gy;
          ctx.fillStyle = 'rgba(20,20,20,.35)'; ctx.fillRect(gx, gy, gw, gh);
          ctx.beginPath();
          for (let x = gx; x <= gx + gw; x += Math.max(3, 0.06 * M)) { ctx.moveTo(x, gy); ctx.lineTo(x, gy + gh); }
          for (let y = gy; y <= gy + gh; y += Math.max(3, 0.06 * M)) { ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); }
          ctx.stroke();
        }
        ctx.fillStyle = 'rgb(36,36,40)';
        for (const wx of [px - 0.55 * M, px + 0.55 * M]) { ctx.beginPath(); ctx.arc(wx, piso - 0.1 * M, 0.1 * M, Math.PI, 0); ctx.fill(); }
        // cabeçote de lixa embaixo do trilho
        const yR = topo + R + 0.12 * M - (lixa ? 0.02 * M : -0.04 * M);
        ctx.fillStyle = 'rgb(112,98,84)';
        ctx.beginPath(); ctx.arc(px, yR, 0.12 * M, 0, 6.283); ctx.fill();
        ctx.fillStyle = cinzaMaq(60); ctx.fillRect(px - 0.16 * M, yR + 0.04 * M, 0.32 * M, 0.12 * M);
        if (lixa) {
          faiscasEm(px, topo + R + 0.02 * M, 320, -300, 60, 340);
          faiscasEm(px, topo + R + 0.02 * M, 120, 220, 80, 260);
        }
        // volantes na frente (giram enquanto o operador comanda)
        const vol = (vx: number, vy: number, r: number) => {
          ctx.strokeStyle = 'rgb(28,29,32)'; ctx.lineWidth = Math.max(2, 0.035 * M);
          ctx.beginPath(); ctx.arc(vx, vy, r, 0, 6.283); ctx.stroke();
          const g = t * (lixa ? 2.2 : 0);
          ctx.lineWidth = Math.max(1.5, 0.025 * M);
          for (let k = 0; k < 4; k++) { const a = g + (k * Math.PI) / 2; ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx + Math.cos(a) * r, vy + Math.sin(a) * r); ctx.stroke(); }
          ctx.fillStyle = 'rgb(28,29,32)'; ctx.beginPath(); ctx.arc(vx, vy, r * 0.18, 0, 6.283); ctx.fill();
        };
        const v1: [number, number] = [px - 0.42 * M, piso - 0.62 * M], v2: [number, number] = [px - 0.02 * M, piso - 0.62 * M];
        vol(v1[0], v1[1], 0.2 * M); vol(v2[0], v2[1], 0.13 * M);
        // botoeira com o botão de emergência, num poste do lado da máquina
        const bx = px + 0.95 * M;
        ctx.fillStyle = 'rgb(40,42,46)'; ctx.fillRect(bx - 0.025 * M, topo - 0.35 * M, 0.05 * M, piso - topo + 0.35 * M - 0.1 * M);
        ctx.fillStyle = cor(mq([150, 156, 162])); ctx.fillRect(bx - 0.11 * M, topo - 0.58 * M, 0.22 * M, 0.26 * M);
        ctx.fillStyle = 'rgb(210,44,40)'; ctx.beginPath(); ctx.arc(bx, topo - 0.47 * M, 0.06 * M, 0, 6.283); ctx.fill();
        // operador do lado da máquina (de costas para quem vê), girando o volante grande e o pequeno
        const giraMao = lixa ? Math.sin(t * 2.2) * 0.06 * M : 0;
        desenharOperario(ctx, {
          sx: px - 1.15 * M, piso, Hs: Hp, t, mq, parado, anda: 0, passo: 0,
          maoE: [v1[0] - 0.18 * M, v1[1] + giraMao], alcE: 1, maoD: [v1[0] + 0.05 * M, v1[1] - 0.12 * M - giraMao], alcD: 1, dPeito: 0,
          curva: 0.25, agacha: 0.12, inclina: 0.25, capacete: [150, 156, 162], fase: 1.3, quente: true,
        });
      }
      // Boleteira (esmerilhadeira MP12, como nas fotos): o corpo amarelo roda em cima do trilho, dentro de um quadro de
      // tubo azul, pendurado pela mola balanceadora no carrinho do balancim (que anda junto). Não tem motor de avanço:
      // o operador empurra e puxa pela barra cromada de cima enquanto o rebolo, embaixo da capa azul, lixa o boleto. O
      // volante preto regula o rebolo; a caixinha cinza tem os botões e a parada de emergência.
      const yBarraBol = topo - 0.52 * M; // a barra de cima do quadro azul, por onde o operador empurra
      const boleteira = (mx: number, lixa: boolean, lado: 1 | -1) => {
        if (!vis(mx - 1.5 * M, mx + 1.5 * M)) return;
        // carrinho no balancim e a mola balanceadora azul (o tambor com o cabo), pendurada
        ctx.fillStyle = cor(mq([40, 86, 160])); ctx.fillRect(mx - 0.22 * M, yBal + 0.02 * M, 0.44 * M, 0.14 * M);
        ctx.fillStyle = 'rgb(30,32,36)';
        for (const wx of [mx - 0.14 * M, mx + 0.14 * M]) { ctx.beginPath(); ctx.arc(wx, yBal + 0.02 * M, 0.05 * M, 0, 6.283); ctx.fill(); }
        const yMola = yBal + 0.3 * M;
        ctx.fillStyle = cor(mq([52, 96, 150])); ctx.beginPath(); ctx.roundRect(mx - 0.2 * M, yMola, 0.4 * M, 0.42 * M, 0.1 * M); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(mx, yMola + 0.21 * M, 0.13 * M, 0, 6.283); ctx.stroke();
        ctx.fillStyle = 'rgb(36,38,42)'; ctx.fillRect(mx - 0.02 * M, yBal + 0.16 * M, 0.04 * M, 0.14 * M);
        // cabo de aço até a argola e o "V" até os cantos do quadro
        ctx.strokeStyle = 'rgb(70,72,78)'; ctx.lineWidth = Math.max(1, 0.015 * M);
        const yArg = yBarraBol - 0.32 * M;
        ctx.beginPath(); ctx.moveTo(mx, yMola + 0.42 * M); ctx.lineTo(mx, yArg);
        ctx.moveTo(mx, yArg); ctx.lineTo(mx - 0.58 * M, yBarraBol); ctx.moveTo(mx, yArg); ctx.lineTo(mx + 0.58 * M, yBarraBol); ctx.stroke();
        ctx.strokeStyle = amarelo(AM); ctx.lineWidth = Math.max(1, 0.02 * M); ctx.beginPath(); ctx.arc(mx, yArg + 0.03 * M, 0.03 * M, 0, 6.283); ctx.stroke();
        // cabo de força preto fazendo laço
        ctx.strokeStyle = 'rgb(22,22,26)'; ctx.lineWidth = Math.max(1.5, 0.025 * M);
        ctx.beginPath(); ctx.moveTo(mx + 0.15 * M, yBal + 0.1 * M); ctx.bezierCurveTo(mx + 0.9 * M, yBal + 1.2 * M, mx - 0.9 * M, topo - 0.2 * M, mx - lado * 0.66 * M, topo - 0.3 * M); ctx.stroke();
        // corpo fundido amarelo, comprido sobre o trilho, com os vazados e as duas rodas
        const gB = ctx.createLinearGradient(0, topo - 0.34 * M, 0, topo - 0.04 * M);
        gB.addColorStop(0, amarelo(AM_L)); gB.addColorStop(1, amarelo(AM_S));
        ctx.fillStyle = gB; ctx.beginPath(); ctx.roundRect(mx - 0.56 * M, topo - 0.32 * M, 1.12 * M, 0.24 * M, 0.08 * M); ctx.fill();
        ctx.fillStyle = 'rgba(40,34,20,.55)';
        for (const hx of [-0.42, -0.26, 0.26, 0.42]) { ctx.beginPath(); ctx.moveTo(mx + hx * M - 0.05 * M, topo - 0.12 * M); ctx.lineTo(mx + hx * M, topo - 0.27 * M); ctx.lineTo(mx + hx * M + 0.05 * M, topo - 0.12 * M); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = 'rgb(30,30,34)';
        for (const wx of [mx - 0.42 * M, mx + 0.42 * M]) { ctx.beginPath(); ctx.arc(wx, topo - 0.08 * M, 0.075 * M, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgb(120,122,128)'; ctx.beginPath(); ctx.arc(wx, topo - 0.08 * M, 0.025 * M, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgb(30,30,34)'; }
        // capa azul do rebolo, descendo pelo lado do boleto, e o rebolo girando
        ctx.fillStyle = cor(mq([44, 92, 170])); ctx.fillRect(mx - 0.26 * M, topo - 0.1 * M, 0.34 * M, 0.3 * M);
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(mx - 0.26 * M, topo + 0.14 * M, 0.34 * M, 0.06 * M);
        // motor amarelo de pé, com a tampa da ventoinha, e o fuso com o volante preto de regular o rebolo
        const gM = ctx.createLinearGradient(mx + 0.06 * M, 0, mx + 0.32 * M, 0);
        gM.addColorStop(0, amarelo(AM_L)); gM.addColorStop(1, amarelo(AM_S));
        ctx.fillStyle = gM; ctx.beginPath(); ctx.roundRect(mx + 0.06 * M, topo - 0.68 * M, 0.26 * M, 0.38 * M, 0.06 * M); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1;
        ctx.beginPath(); for (let k = 1; k < 5; k++) { const ax = mx + 0.06 * M + k * 0.052 * M; ctx.moveTo(ax, topo - 0.66 * M); ctx.lineTo(ax, topo - 0.5 * M); } ctx.stroke();
        ctx.fillStyle = amarelo(AM_S); ctx.fillRect(mx + 0.32 * M, topo - 0.5 * M, 0.08 * M, 0.1 * M);
        ctx.fillStyle = cor(mq([120, 124, 130])); ctx.fillRect(mx - 0.16 * M, topo - 0.5 * M, 0.08 * M, 0.2 * M);
        ctx.strokeStyle = 'rgb(26,26,30)'; ctx.lineWidth = Math.max(1.5, 0.03 * M);
        ctx.beginPath(); ctx.ellipse(mx - 0.12 * M, topo - 0.53 * M, 0.15 * M, 0.04 * M, 0, 0, 6.283); ctx.stroke();
        if (lixa) {
          faiscasEm(mx - 0.27 * M, topo + 0.05 * M, 160, -260, -40, 260);
          faiscasEm(mx + 0.09 * M, topo + 0.05 * M, 160, 260, -40, 260);
        }
        // quadro de tubo azul em volta, com a barra cromada em cima
        ctx.strokeStyle = cor(mq([40, 80, 160])); ctx.lineWidth = Math.max(2, 0.045 * M); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(mx - 0.6 * M, yBarraBol); ctx.lineTo(mx - 0.6 * M, topo - 0.06 * M); ctx.lineTo(mx + 0.6 * M, topo - 0.06 * M); ctx.lineTo(mx + 0.6 * M, yBarraBol);
        ctx.stroke();
        const gBar = ctx.createLinearGradient(0, yBarraBol - 0.03 * M, 0, yBarraBol + 0.03 * M);
        gBar.addColorStop(0, 'rgb(236,238,242)'); gBar.addColorStop(1, 'rgb(130,134,140)');
        ctx.strokeStyle = gBar; ctx.lineWidth = Math.max(2.5, 0.06 * M);
        ctx.beginPath(); ctx.moveTo(mx - 0.62 * M, yBarraBol); ctx.lineTo(mx + 0.62 * M, yBarraBol); ctx.stroke();
        ctx.lineCap = 'butt';
        // caixinha de comando cinza na ponta do quadro: botões e a parada de emergência vermelha
        const cbx = mx - lado * 0.6 * M - (lado === 1 ? 0.22 * M : 0);
        ctx.fillStyle = cor(mq([176, 180, 186])); ctx.fillRect(cbx, topo - 0.46 * M, 0.22 * M, 0.34 * M);
        for (const [by, c] of [[0.07, 'rgb(40,90,200)'], [0.15, 'rgb(40,170,90)'], [0.21, 'rgb(220,50,44)']] as [number, string][]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cbx + 0.11 * M, topo - 0.46 * M + by * M, 0.025 * M, 0, 6.283); ctx.fill(); }
        ctx.fillStyle = 'rgb(220,40,36)'; ctx.beginPath(); ctx.arc(cbx + 0.11 * M, topo - 0.17 * M, 0.045 * M, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgb(236,196,40)'; ctx.fillRect(cbx + 0.06 * M, topo - 0.14 * M, 0.1 * M, 0.02 * M);
      };
      // boleteira 1: operador do lado de cá, empurrando e puxando pela alça
      {
        const lixa1 = trabalha(0.8, 7.8);
        boleteira(xBol1, lixa1, 1);
        if (vis(xBol1 - 2 * M, xBol1 + M)) {
          desenharOperario(ctx, {
            sx: xBol1 - 0.95 * M, piso, Hs: Hp, t, mq, parado, anda: lixa1 ? 0.5 : 0, passo: t * 3.2,
            maoE: [xBol1 - 0.5 * M, yBarraBol], alcE: 1, maoD: [xBol1 - 0.25 * M, yBarraBol], alcD: 1, dPeito: 0,
            curva: 0.15, agacha: 0.05, inclina: 0.2, capacete: [150, 156, 162], fase: 2.1, quente: true,
          });
        }
      }
      // boleteira 2: a máquina no trilho; o operador está do outro lado (desenhado atrás)
      boleteira(xBol2, trabalha(2.0, 9.0), -1);
      // suportes amarelos feitos para guardar a retífica e a esmerilhadeira, ao lado das boleteiras
      const suporte = (sx0: number) => {
        // cavalete amarelo de tubo (como na foto): pé em T, a forquilha em cima para deitar a máquina e o gancho com o
        // disco de lixa pendurado
        if (!vis(sx0 - M, sx0 + M)) return;
        const yS = piso - 1.15 * M;
        ctx.strokeStyle = amarelo(AM); ctx.lineWidth = Math.max(2, 0.045 * M); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx0 - 0.3 * M, piso - 0.03 * M); ctx.lineTo(sx0 + 0.3 * M, piso - 0.03 * M);
        ctx.moveTo(sx0, piso - 0.03 * M); ctx.lineTo(sx0 + 0.05 * M, yS);
        ctx.moveTo(sx0 - 0.2 * M, yS - 0.18 * M); ctx.quadraticCurveTo(sx0 + 0.05 * M, yS + 0.12 * M, sx0 + 0.3 * M, yS - 0.18 * M);
        ctx.moveTo(sx0 + 0.04 * M, yS + 0.3 * M); ctx.lineTo(sx0 - 0.16 * M, yS + 0.3 * M); ctx.lineTo(sx0 - 0.16 * M, yS + 0.38 * M);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.fillStyle = 'rgb(60,62,68)'; ctx.beginPath(); ctx.arc(sx0 - 0.16 * M, yS + 0.55 * M, 0.15 * M, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgb(232,232,228)'; ctx.beginPath(); ctx.arc(sx0 - 0.16 * M, yS + 0.55 * M, 0.11 * M, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgb(200,40,36)'; ctx.fillRect(sx0 - 0.25 * M, yS + 0.5 * M, 0.18 * M, 0.04 * M);
        ctx.fillStyle = 'rgb(40,42,46)'; ctx.beginPath(); ctx.arc(sx0 - 0.16 * M, yS + 0.55 * M, 0.025 * M, 0, 6.283); ctx.fill();
      };
      suporte(xB1 + 1.6 * M);
      suporte(xB2 - 1.6 * M);
      // passarela para passar para o outro lado da linha: a escada sobe do lado de cá, o piso atravessa por cima do
      // trilho e a escada do outro lado desce por trás (desenhada atrás do trilho)
      if (vis(pas0 - 3 * M, pas1 + 3 * M)) {
        ctx.fillStyle = amarelo(AM_S);
        for (const px of [pas0, pas1]) ctx.fillRect(px - 0.07 * M, yDeck, 0.14 * M, piso - yDeck);
        ctx.fillStyle = amarelo(AM); ctx.fillRect(pas0 - 0.12 * M, yDeck - 0.12 * M, pas1 - pas0 + 0.24 * M, 0.14 * M);
        ctx.strokeStyle = amarelo(AM); ctx.lineWidth = Math.max(1.5, 0.05 * M);
        ctx.beginPath();
        ctx.moveTo(pas0 - 0.05 * M, yDeck - 1.0 * M); ctx.lineTo(pas1 + 0.05 * M, yDeck - 1.0 * M);
        ctx.moveTo(pas0 - 0.05 * M, yDeck - 0.5 * M); ctx.lineTo(pas1 + 0.05 * M, yDeck - 0.5 * M);
        for (const px of [pas0, xPassarela, pas1]) { ctx.moveTo(px, yDeck - 0.12 * M); ctx.lineTo(px, yDeck - 1.0 * M); }
        // escada do lado de cá, subindo até o piso da passarela
        const e0x = pas1 + 0.1 * M, e1x = pas1 + 2.3 * M;
        ctx.moveTo(e0x, yDeck - 0.05 * M); ctx.lineTo(e1x, piso);
        ctx.moveTo(e0x, yDeck - 0.98 * M); ctx.lineTo(e1x, piso - 0.95 * M);
        ctx.stroke();
        ctx.lineWidth = Math.max(1, 0.03 * M);
        ctx.beginPath();
        for (let k = 1; k < 9; k++) { const f = k / 9; const sx = mix(e0x, e1x, f), sy = mix(yDeck - 0.05 * M, piso, f); ctx.moveTo(sx - 0.12 * M, sy); ctx.lineTo(sx + 0.12 * M, sy); }
        ctx.stroke();
      }
      // rolos opressores do fim: a parte de cima (cilindros)
      rolosFim.forEach((x0) => roloFrente(x0));
      // pórticos de 2 t: estrutura amarela com a placa "CAP 2 TON" no alto, como na foto (a talha, os ganchos e os
      // operadores ficam atrás da linha, desenhados antes do trilho)
      const portico = (gc: number, rotulo: string) => {
        if (!vis(gc - 2.5 * M, gc + 2.5 * M)) return;
        const yViga = yVigaPrep;
        for (const px of [gc - 1.7 * M, gc + 1.7 * M]) {
          const gp = ctx.createLinearGradient(px - 0.12 * M, 0, px + 0.12 * M, 0);
          gp.addColorStop(0, amarelo(AM_L)); gp.addColorStop(1, amarelo(AM_S));
          ctx.fillStyle = gp; ctx.fillRect(px - 0.12 * M, yViga, 0.24 * M, piso - yViga);
          ctx.fillStyle = amarelo(AM_S); ctx.fillRect(px - 0.3 * M, piso - 0.12 * M, 0.6 * M, 0.12 * M); // sapata
        }
        // mão-francesa entre a perna e a viga
        ctx.strokeStyle = amarelo(AM_S); ctx.lineWidth = Math.max(2, 0.1 * M);
        ctx.beginPath();
        ctx.moveTo(gc - 1.6 * M, yViga + 0.9 * M); ctx.lineTo(gc - 0.9 * M, yViga + 0.1 * M);
        ctx.moveTo(gc + 1.6 * M, yViga + 0.9 * M); ctx.lineTo(gc + 0.9 * M, yViga + 0.1 * M);
        ctx.stroke();
        const gv = ctx.createLinearGradient(0, yViga - 0.3 * M, 0, yViga + 0.1 * M);
        gv.addColorStop(0, amarelo(AM_L)); gv.addColorStop(1, amarelo(AM_S));
        ctx.fillStyle = gv; ctx.fillRect(gc - 2.0 * M, yViga - 0.3 * M, 4.0 * M, 0.34 * M);
        // cabo de força da talha, pendurado em laços embaixo da viga
        ctx.strokeStyle = 'rgb(24,24,28)'; ctx.lineWidth = Math.max(1, 0.025 * M);
        ctx.beginPath(); ctx.moveTo(gc - 1.9 * M, yViga + 0.05 * M);
        for (let k = 0; k < 4; k++) { const a = gc - 1.9 * M + k * 0.4 * M; ctx.quadraticCurveTo(a + 0.2 * M, yViga + 0.4 * M, a + 0.4 * M, yViga + 0.05 * M); }
        ctx.stroke();
        // placa branca pendurada na viga
        const pw = 0.9 * M, ph = 0.42 * M, pyT = yViga - 0.3 * M - ph - 0.04 * M;
        ctx.fillStyle = 'rgb(246,246,242)'; ctx.fillRect(gc + 0.5 * M, pyT, pw, ph);
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.strokeRect(gc + 0.5 * M, pyT, pw, ph);
        ctx.fillStyle = 'rgb(20,20,22)';
        ctx.font = `700 ${0.15 * M}px ${fonte('--font-barlow-cond', '"Barlow Condensed", "Arial Narrow", sans-serif')}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CAP 2 TON', gc + 0.5 * M + pw / 2, pyT + ph * 0.32);
        ctx.fillText(rotulo, gc + 0.5 * M + pw / 2, pyT + ph * 0.74);
        ctx.textAlign = 'left';
      };
      portico(ganchosPrep[0], 'PR 01');
      portico(ganchosPrep[1], 'PR 02');
      portico(xPR3, 'PR 03'); // no setor de acabamento, perto do patim
      // pátio do TLS: viga com seis talhas. As talhas não se engatam sozinhas: os dois operadores vão de talha em talha
      // pelo trilho longo soldado engatando os ganchos, erguem tudo de uma vez pelo controle remoto, põem na pilha e
      // depois soltam os ganchos um a um, voltando pelo mesmo caminho.
      if (vis(X(-111), X(-81))) {
        const yViga = piso - 4.2 * M;
        for (let x = X(-82); x >= X(-111); x -= 7 * M) {
          ctx.fillStyle = amarelo(AM_S);
          ctx.fillRect(x - 0.08 * M, yViga, 0.16 * M, piso - yViga);
        }
        ctx.fillStyle = amarelo(AM); ctx.fillRect(X(-111), yViga - 0.2 * M, X(-81) - X(-111), 0.24 * M);
        const CIC = 24;
        const ciclo = Math.floor(t / CIC), ct = parado ? 0 : t % CIC;
        const jaEmpilhou = tlsCiclo === ciclo;
        const yAlto = topo - 1.9 * M, yPronto = topo - 0.5 * M, yLinha = topo - R * 0.06, yErguido = topo - 1.2 * M;
        const yPilha = piso - 0.2 * M - (tlsCamadas + (jaEmpilhou ? 0 : 1)) * 0.15 * M;
        const engT = [2, 5, 8], solT = [21.5, 18.5, 15.5]; // por talha de cada operador (j = 0, 1, 2)
        const gxs = Array.from({ length: 6 }, (_, i) => X(-84) - i * 4.6 * M);
        const yTalha = (i: number) => {
          const j = i % 3;
          let y = mix(yAlto, yPronto, suave(0, 1.5, ct));
          y = mix(y, yLinha, suave(engT[j] + 0.3, engT[j] + 0.6, ct));
          if (ct > 10) y = mix(yLinha, yErguido, suave(10, 12, ct));
          if (ct > 12.5) y = mix(yErguido, yPilha, suave(12.5, 15, ct));
          if (ct > solT[j] + 0.6) y = mix(yPilha, yAlto, suave(solT[j] + 0.6, solT[j] + 1.6, ct));
          return y;
        };
        if (!parado && ct >= 15 && !jaEmpilhou) { tlsCiclo = ciclo; tlsCamadas = Math.min(16, tlsCamadas + 1); }
        gxs.forEach((gx, i) => talha(gx, yViga, yTalha(i), 0.9));
        const carga = ct > 10 && ct < 15;
        if (carga) {
          const yC = yTalha(0);
          const gb = ctx.createLinearGradient(0, yC, 0, yC + R);
          gb.addColorStop(0, cor(pal.aco)); gb.addColorStop(1, cor(misturar(pal.acoLado, pal.ceuTopo, 0.35)));
          ctx.fillStyle = gb; ctx.fillRect(X(-109), yC, X(-82) - X(-109), R);
        }
        // onde está cada operador (índice da talha, com fração enquanto anda) e se está com a mão no gancho
        const ondeOp = (): { j: number; mexe: number; anda: boolean } => {
          const acao = (a: number) => (ct > a - 0.1 && ct < a + 0.8 ? suave(a - 0.1, a + 0.15, ct) * (1 - suave(a + 0.55, a + 0.8, ct)) : 0);
          if (ct < engT[0]) return { j: 0, mexe: 0, anda: false };
          for (let j = 0; j < 3; j++) {
            if (ct <= engT[j] + 0.8) return { j, mexe: acao(engT[j]), anda: false };
            if (j < 2 && ct < engT[j + 1]) return { j: j + suave(engT[j] + 0.8, engT[j + 1], ct), mexe: 0, anda: true };
          }
          if (ct <= solT[2] + 0.8) return { j: 2, mexe: acao(solT[2]), anda: false };
          if (ct < solT[1]) return { j: 2 - suave(solT[2] + 0.8, solT[1], ct), mexe: 0, anda: true };
          if (ct <= solT[1] + 0.8) return { j: 1, mexe: acao(solT[1]), anda: false };
          if (ct < solT[0]) return { j: 1 - suave(solT[1] + 0.8, solT[0], ct), mexe: 0, anda: true };
          return { j: 0, mexe: acao(solT[0]), anda: false };
        };
        const op = ondeOp();
        const controla = suave(9.6, 10, ct) * (1 - suave(15, 15.3, ct));
        [0, 1].forEach((k) => {
          const jf = op.j, i0 = k * 3 + Math.floor(jf), i1 = Math.min(k * 3 + 2, i0 + 1);
          const gxA = mix(gxs[i0], gxs[i1], jf - Math.floor(jf));
          const sx = gxA + 0.42 * M;
          if (!vis(sx - M, sx + M)) return;
          const iAqui = k * 3 + Math.round(jf);
          const yG = yTalha(iAqui);
          const baixo = Math.max(0, (yG - (topo - 0.2 * M)) / M); // gancho abaixo da cintura: agacha
          const mao: [number, number] = [gxs[iAqui] + 0.06 * M, yG - 0.06 * M];
          const radio: [number, number] = [sx - 0.18 * M, piso - 1.2 * M];
          desenharOperario(ctx, {
            sx, piso, Hs: Hp, t, mq, parado, anda: op.anda ? 1 : 0, passo: sx / (0.22 * M),
            maoE: op.mexe > 0.01 ? mao : controla > 0.01 ? radio : null, alcE: op.mexe > 0.01 ? op.mexe : controla,
            maoD: op.mexe > 0.01 ? [mao[0] + 0.1 * M, mao[1] + 0.03 * M] : null, alcD: op.mexe,
            dPeito: 0, curva: (0.2 + Math.min(0.4, baixo)) * op.mexe, agacha: Math.min(0.5, baixo * 0.9) * op.mexe, inclina: 0,
            capacete: k === 0 ? [196, 44, 38] : [150, 156, 162], fase: 3.1 + k,
          });
          if (controla > 0.01) { ctx.fillStyle = amarelo(AM); ctx.fillRect(radio[0] - 0.06 * M, radio[1] - 0.12 * M, 0.12 * M, 0.18 * M); ctx.fillStyle = 'rgb(30,30,34)'; ctx.fillRect(radio[0] - 0.01 * M, radio[1] - 0.22 * M, 0.02 * M, 0.1 * M); }
        });
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
        vista.rect(abX + jn.abW, -H, W * 20, H * 3);
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
          capacete: [196, 44, 38], fase: 1.7,
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
      for (let i = n0; i < faiscas.length; i++) {
        const f = faiscas[i];
        if (camera) {
          f.x = camera.fx + (f.x - camera.ax) / camera.Z; f.y = camera.fy + (f.y - camera.ay) / camera.Z;
          f.vx /= camera.Z; f.vy /= camera.Z;
        } else { f.x += camX; f.y += offY; }
      }
    }
    if (faiscas.length) desenharFaiscas(ctx, faiscas, dt, H);

    ctx.restore(); // mundo (câmera do passeio)
    ctx.restore(); // câmera da abertura ou rolagem
    H = Htela;
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
