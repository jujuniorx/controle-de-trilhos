'use client';

import { useEffect, useRef } from 'react';

/**
 * Cena da ferrovia em canvas, usada no fundo das telas.
 *
 * abertura (tela inicial, logins, abertura do app): quem olha está na cabine. Na primeira vez da sessão
 *   a tela sai do escuro, o farol acende, a luz corre pelos trilhos até o horizonte e a composição arranca.
 *   Nas outras vezes a cena só aparece, já em movimento. Na hora em que o logo fecha os trilhos, a emenda
 *   é soldada e saem faíscas.
 * saudacao (faixa "Bom dia"): a via vista de lado, com o céu da hora de verdade (sol nascendo, de tarde,
 *   pondo, lua e estrelas à noite), a serra ao fundo, postes com fios, os dormentes passando e, de tempos
 *   em tempos, uma composição de TLS (trilhos longos sobre vagões plataforma) cruzando.
 *
 * As cores vêm do tema: na abertura, das variáveis --cena-* (app/temas.css); na saudação, da cor do texto da
 * faixa, então a cena funciona sobre o fundo de qualquer tema. Com "reduzir movimento" fica um quadro parado.
 * O desenho para quando a tela não está visível.
 */

type Modo = 'abertura' | 'saudacao';
type RGB = [number, number, number];

const CHAVE_INTRO = 'ct_cena_intro';

export function CenaFerrovia({ modo, intro = 'auto' }: { modo: Modo; intro?: 'auto' | 'completa' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    return modo === 'abertura' ? iniciarAbertura(cv, intro) : iniciarSaudacao(cv);
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
interface Faisca { x: number; y: number; vx: number; vy: number; v: number }
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
    for (let i = 0; i < 22; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.7;
      const v = 160 + Math.random() * 300;
      faiscas.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, v: 0.6 + Math.random() * 0.5 });
    }
  }
}
function desenharFaiscas(ctx: CanvasRenderingContext2D, faiscas: Faisca[], dt: number, H: number) {
  for (const s of faiscas) {
    s.vy += 900 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.v -= dt * 1.3;
  }
  for (let i = faiscas.length - 1; i >= 0; i--) if (faiscas[i].v <= 0 || faiscas[i].y > H) faiscas.splice(i, 1);
  ctx.lineCap = 'round';
  for (const s of faiscas) {
    ctx.strokeStyle = `rgba(255,${(150 + 95 * s.v) | 0},70,${Math.min(1, s.v)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02);
    ctx.stroke();
  }
}

// ---------- abertura: a via em perspectiva, vista da cabine ----------

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

function iniciarAbertura(cv: HTMLCanvasElement, intro: 'auto' | 'completa') {
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
  // Linha do tempo da abertura (s). Curta: já começa andando.
  const T = completa
    ? { cortina: 0.9, farol: [0.3, 1.4], luz: [0.7, 2.4], arranque: [0.6, 3.0], solda: 1.25 }
    : { cortina: 0.45, farol: [0, 0.4], luz: [0, 0.01], arranque: [0, 0.01], solda: 1.25 };

  const BITOLA = 1.0, BRITA = 1.75, DORM_LARG = 1.35, DORM_ESP = 0.6, ALTURA_CAM = 1.55, LONGE = 140, PERTO = 0.9;
  const curva = (z: number) => 3.2 * Math.sin(z * 0.018) + 1.4 * Math.sin(z * 0.041 + 1.3);
  let semente = 11;
  const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  const estrelas = Array.from({ length: 120 }, () => ({ x: rnd(), y: rnd(), r: rnd() * 1.1 + 0.2, f: rnd() * 6.28 }));
  const poeira = Array.from({ length: 46 }, () => ({ x: (rnd() - 0.5) * 6, y: rnd() * 2 + 0.1, z: rnd() * 40 + 2 }));
  const faiscas: Faisca[] = [];
  let soldou = false;
  let camZ = 37;
  let vel = completa ? 0 : 7;

  // Altura do horizonte vem do CSS (--horizonte, muda por tela e largura): relida de tempos em tempos.
  const lerHorizonte = () => {
    const v = getComputedStyle(caixa).getPropertyValue('--horizonte').trim();
    return v.endsWith('%') ? parseFloat(v) / 100 : 0.5;
  };
  let fracHorizonte = lerHorizonte();
  let quadros = 0;
  const controle = laco(cv, 2, () => { pal = paletaAbertura(caixa); fracHorizonte = lerHorizonte(); }, (ctx, W, H, t, dt) => {
    if (++quadros % 45 === 0) fracHorizonte = lerHorizonte();
    const horizonte = H * fracHorizonte;
    const f = Math.min(W, (H - horizonte) * 2.6) * 0.95;
    const alvo = parado ? 0 : 7 * suave(T.arranque[0], T.arranque[1], t);
    vel = mix(vel, alvo, 1 - Math.pow(0.02, dt));
    camZ += vel * dt;
    const camX = curva(camZ + 3);
    const farol = parado ? 1 : suave(T.farol[0], T.farol[1], t);
    const acesoAte = parado ? LONGE : mix(2, LONGE, suave(T.luz[0], T.luz[1], t));
    const proj = (x: number, y: number, d: number): [number, number] => [W / 2 + ((x - camX) * f) / d, horizonte + ((ALTURA_CAM - y) * f) / d];
    const nevoa = (d: number) => suave(18, LONGE, d);
    const luzFarol = (d: number) => farol * Math.exp(-d / 26);

    // céu
    const ceu = ctx.createLinearGradient(0, 0, 0, horizonte);
    ceu.addColorStop(0, cor(pal.ceuTopo));
    ceu.addColorStop(1, cor(pal.ceuHorizonte));
    ctx.fillStyle = ceu;
    ctx.fillRect(0, 0, W, horizonte + 2);
    if (pal.estrelas > 0) {
      for (const s of estrelas) {
        const y = s.y * horizonte * 0.92;
        const a = (0.3 + 0.35 * Math.sin(t * 1.3 + s.f)) * pal.estrelas * suave(0, 1.2, t);
        ctx.fillStyle = `rgba(222,232,255,${a})`;
        ctx.beginPath();
        ctx.arc(s.x * W, y, s.r, 0, 6.283);
        ctx.fill();
      }
    }
    // clarão para onde a via vai e neblina rente ao horizonte
    const fuga = proj(curva(camZ + LONGE), 0, LONGE);
    const halo = ctx.createRadialGradient(fuga[0], horizonte, 0, fuga[0], horizonte, W * 0.55);
    halo.addColorStop(0, cor(pal.neblina, 0.5));
    halo.addColorStop(1, cor(pal.neblina, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    const chao = ctx.createLinearGradient(0, horizonte, 0, H);
    chao.addColorStop(0, cor(misturar(pal.ceuHorizonte, pal.ceuTopo, 0.35)));
    chao.addColorStop(1, cor(pal.ceuTopo));
    ctx.fillStyle = chao;
    ctx.fillRect(0, horizonte, W, H - horizonte);
    const faixa = ctx.createLinearGradient(0, horizonte - H * 0.05, 0, horizonte + H * 0.09);
    faixa.addColorStop(0, cor(pal.neblina, 0));
    faixa.addColorStop(0.45, cor(pal.neblina, 0.32));
    faixa.addColorStop(1, cor(pal.neblina, 0));
    ctx.fillStyle = faixa;
    ctx.fillRect(0, horizonte - H * 0.05, W, H * 0.14);

    // fatias da via, do fundo para perto
    const passos = W < 500 ? 80 : 120;
    const fatias: { d: number; x: number }[] = [];
    for (let i = 0; i <= passos; i++) {
      const d = mix(LONGE, PERTO, Math.pow(i / passos, 0.55));
      fatias.push({ d, x: curva(camZ + d) });
    }
    for (let i = 0; i < fatias.length - 1; i++) {
      const a = fatias[i], b = fatias[i + 1];
      const base = misturar(pal.britaPerto, pal.brita, Math.min(1, a.d / 40));
      const c = misturar(misturar(base, pal.farol, luzFarol(a.d) * 0.14), pal.neblina, nevoa(a.d) * 0.85);
      if (i % 2) { c[0] *= 0.96; c[1] *= 0.96; c[2] *= 0.96; }
      const p1 = proj(a.x - BRITA, 0, a.d), p2 = proj(a.x + BRITA, 0, a.d), p3 = proj(b.x + BRITA, 0, b.d), p4 = proj(b.x - BRITA, 0, b.d);
      ctx.fillStyle = cor(c);
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1] + 0.6); ctx.lineTo(p4[0], p4[1] + 0.6);
      ctx.fill();
    }

    // sinais ao lado da via, a cada 30 m (verde e âmbar)
    for (let k = Math.floor((camZ + LONGE) / 30); k * 30 > camZ + 9; k--) {
      const d = k * 30 - camZ;
      const lado = k % 2 ? 1 : -1;
      const x = curva(k * 30) + lado * 3.4;
      const pe = proj(x, 0, d), topo = proj(x, 4.2, d);
      const n = nevoa(d), a = 1 - n * 0.9;
      ctx.strokeStyle = cor(misturar(pal.poste, pal.neblina, n), a);
      ctx.lineWidth = Math.max(1, (0.12 * f) / d);
      ctx.beginPath(); ctx.moveTo(pe[0], pe[1]); ctx.lineTo(topo[0], topo[1]); ctx.stroke();
      const r = Math.min(6, Math.max(1.2, (0.16 * f) / d));
      const lamp = k % 3 ? pal.sinal1 : pal.sinal2;
      const g = ctx.createRadialGradient(topo[0], topo[1], 0, topo[0], topo[1], r * 4);
      g.addColorStop(0, cor(lamp, 0.9 * a)); g.addColorStop(1, cor(lamp, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(topo[0], topo[1], r * 4, 0, 6.283); ctx.fill();
    }

    // dormentes
    const primeiro = Math.ceil((camZ + PERTO) / DORM_ESP);
    for (let k = Math.floor((camZ + LONGE) / DORM_ESP); k >= primeiro; k--) {
      const z = k * DORM_ESP, d = z - camZ, d2 = d + 0.24;
      const x1 = curva(z), x2 = curva(z + 0.24), n = nevoa(d);
      const c = misturar(misturar(pal.dorm, pal.farol, luzFarol(d) * 0.18), pal.neblina, n * 0.9);
      const a = proj(x1 - DORM_LARG, 0.02, d), b = proj(x1 + DORM_LARG, 0.02, d), c2 = proj(x2 + DORM_LARG, 0.02, d2), d3 = proj(x2 - DORM_LARG, 0.02, d2);
      ctx.fillStyle = cor(c, 1 - n * 0.4);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d3[0], d3[1]); ctx.fill();
    }

    // trilhos: lado do perfil + boleto brilhante, acesos até onde a luz chegou, com um brilho correndo
    for (const lado of [-1, 1]) {
      for (let i = 0; i < fatias.length - 1; i++) {
        const a = fatias[i], b = fatias[i + 1];
        const xa = a.x + (lado * BITOLA) / 2, xb = b.x + (lado * BITOLA) / 2;
        const n = nevoa(a.d);
        const aceso = a.d <= acesoAte ? 1 : 0.18;
        const pa = proj(xa, 0.16, a.d), pb = proj(xb, 0.16, b.d), pba = proj(xa, 0.02, a.d), pbb = proj(xb, 0.02, b.d);
        const wa = Math.max(0.6, (0.075 * f) / a.d), wb = Math.max(0.6, (0.075 * f) / b.d);
        ctx.fillStyle = cor(misturar(pal.acoLado, pal.neblina, n * 0.8), 0.95);
        ctx.beginPath();
        ctx.moveTo(pa[0] - wa / 2, pa[1]); ctx.lineTo(pb[0] - wb / 2, pb[1]); ctx.lineTo(pbb[0] - wb / 2, pbb[1]); ctx.lineTo(pba[0] - wa / 2, pba[1]);
        ctx.fill();
        const corre = parado ? 0 : Math.max(0, 1 - Math.abs((a.d - ((t * 22) % 160)) / 7));
        const intens = Math.min(1, aceso * (0.55 + 0.45 * luzFarol(a.d) * 3) + corre * 0.9);
        ctx.fillStyle = cor(misturar(misturar(pal.acoLado, pal.aco, intens), pal.neblina, n * 0.7));
        ctx.beginPath();
        ctx.moveTo(pa[0] - wa / 2, pa[1]); ctx.lineTo(pa[0] + wa / 2, pa[1]); ctx.lineTo(pb[0] + wb / 2, pb[1]); ctx.lineTo(pb[0] - wb / 2, pb[1]);
        ctx.fill();
      }
    }
    // frente da luz correndo pelos trilhos (só na abertura completa)
    if (!parado && acesoAte < LONGE - 1 && t > T.luz[0]) {
      for (const lado of [-1, 1]) {
        const d = acesoAte;
        const p = proj(curva(camZ + d) + (lado * BITOLA) / 2, 0.16, d);
        const r = Math.max(3, (0.9 * f) / d);
        const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
        g.addColorStop(0, 'rgba(255,240,215,.95)'); g.addColorStop(1, 'rgba(255,200,140,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.283); ctx.fill();
      }
    }
    // poeira no facho do farol
    if (!parado) {
      for (const p of poeira) {
        p.z -= vel * dt;
        if (p.z < 1.2) { p.z += 40; p.x = (rnd() - 0.5) * 6; }
        const q = proj(curva(camZ + p.z) + p.x, p.y, p.z);
        const a = luzFarol(p.z) * 0.4;
        if (a < 0.02 || q[1] < horizonte * 0.9) continue;
        ctx.fillStyle = cor(pal.farol, a);
        ctx.beginPath(); ctx.arc(q[0], q[1], Math.min(1.8, Math.max(0.5, 9 / p.z)), 0, 6.283); ctx.fill();
      }
    }
    // facho do farol vindo de baixo
    if (farol > 0) {
      const fx = ctx.createRadialGradient(W / 2, H * 1.08, 0, W / 2, H * 1.08, (H - horizonte) * 1.5);
      fx.addColorStop(0, cor(pal.farol, 0.16 * farol)); fx.addColorStop(1, cor(pal.farol, 0));
      ctx.fillStyle = fx;
      ctx.fillRect(0, horizonte, W, H - horizonte);
    }
    // solda do logo
    if (!parado && !soldou && t >= T.solda) { soldou = true; soldarLogo(cv, faiscas); }
    if (faiscas.length) desenharFaiscas(ctx, faiscas, dt, H);
    // sai do escuro
    const cortina = parado ? 0 : 1 - suave(0, T.cortina, t);
    if (cortina > 0) { ctx.fillStyle = cor(pal.ceuTopo, cortina); ctx.fillRect(0, 0, W, H); }
  });
  return typeof controle === 'function' ? controle : controle.parar;
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
      const comp = 150 + 8 * 96;
      const xFrente = W + 40 - ciclo * VEL.tls;
      if (xFrente > -comp - 40) {
        const trilhoY = chao - H * 0.06;
        const alto = Math.max(16, H * 0.15);
        const a = 0.34 * entra;
        ctx.fillStyle = cor(tinta, a);
        // locomotiva (vai para a esquerda: cabine na frente)
        const lx = xFrente;
        ctx.beginPath();
        ctx.moveTo(lx, trilhoY - alto * 0.25);
        ctx.lineTo(lx + 10, trilhoY - alto);
        ctx.lineTo(lx + 44, trilhoY - alto);
        ctx.lineTo(lx + 44, trilhoY - alto * 0.78);
        ctx.lineTo(lx + 150, trilhoY - alto * 0.78);
        ctx.lineTo(lx + 150, trilhoY - alto * 0.18);
        ctx.lineTo(lx, trilhoY - alto * 0.18);
        ctx.closePath();
        ctx.fill();
        // janela da cabine e farol aceso
        ctx.fillStyle = 'rgba(255,214,150,.75)';
        ctx.fillRect(lx + 14, trilhoY - alto * 0.88, 16, alto * 0.22);
        const g = ctx.createRadialGradient(lx, trilhoY - alto * 0.32, 0, lx, trilhoY - alto * 0.32, alto * 1.6);
        g.addColorStop(0, 'rgba(255,226,170,.7)'); g.addColorStop(1, 'rgba(255,226,170,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, trilhoY - alto * 0.32, alto * 1.6, 0, 6.283); ctx.fill();
        // vagões plataforma
        ctx.fillStyle = cor(tinta, a);
        for (let v = 0; v < 8; v++) {
          const vx = lx + 154 + v * 96;
          ctx.fillRect(vx, trilhoY - alto * 0.3, 92, alto * 0.12);
          ctx.fillRect(vx + 30, trilhoY - alto * 0.34, 4, alto * 0.06);
        }
        // trilhos longos (TLS) correndo por cima de todos os vagões, em duas camadas
        ctx.fillStyle = cor(tinta, a * 1.25);
        ctx.fillRect(lx + 160, trilhoY - alto * 0.42, 8 * 96 - 14, alto * 0.06);
        ctx.fillRect(lx + 166, trilhoY - alto * 0.52, 8 * 96 - 26, alto * 0.06);
        // rodas
        ctx.fillStyle = cor(tinta, a * 1.1);
        const rodas = [lx + 18, lx + 40, lx + 110, lx + 132];
        for (let v = 0; v < 8; v++) rodas.push(lx + 154 + v * 96 + 14, lx + 154 + v * 96 + 78);
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
