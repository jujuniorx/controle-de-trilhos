'use client';

import { useEffect, useRef } from 'react';

/**
 * Cena da ferrovia em canvas, usada no fundo das telas.
 *
 * abertura (tela inicial, logins, abertura do app): quem olha está na cabine. Na primeira vez da sessão
 *   a tela sai do escuro, o farol acende, a luz corre pelos trilhos até o horizonte e a composição arranca.
 *   Nas outras vezes a cena só aparece, já em movimento. Na hora em que o logo fecha os trilhos, a emenda
 *   é soldada e saem faíscas.
 * inicio (tela inicial, escolha do setor): o TLS saindo do estaleiro. O trilho longo desliza sobre roletes na
 *   parte de baixo; a cada barra para, a emenda é soldada e segue esfriando. Atrás, o galpão com as luminárias.
 * saudacao (faixa "Bom dia"): a via vista de lado, com o céu da hora de verdade (sol nascendo, de tarde,
 *   pondo, lua e estrelas à noite), a serra ao fundo, postes com fios, os dormentes passando e, de tempos
 *   em tempos, uma composição de TLS (trilhos longos sobre vagões plataforma) cruzando.
 *
 * As cores vêm do tema: na abertura, das variáveis --cena-* (app/temas.css); na saudação, da cor do texto da
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
    return modo === 'abertura' ? iniciarAbertura(cv, intro) : modo === 'inicio' ? iniciarInicio(cv, intro) : iniciarSaudacao(cv);
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
  // A primeira emenda chega no meio em CHEGA e é soldada em SOLDA, junto com a emenda do logo.
  const CHEGA = 1.0, SOLDA = 1.25, PAUSA = 1.3, VEL = 70;
  const faiscas: Faisca[] = [];
  const brasas: { x: number; y: number; vy: number; vx: number; v: number }[] = [];
  let soldouLogo = false;

  // Emendas: k = 0 é a que chega no meio na abertura. Guarda quando cada uma foi soldada (s).
  const soldada = new Map<number, number>();
  if (!completa) for (let k = -6; k < 0; k++) soldada.set(k, -60);
  if (reduzirMovimento()) for (let k = -6; k <= 6; k++) soldada.set(k, -60);
  let u = 0; // quanto o trilho andou desde que a emenda 0 ficou no meio (px)
  let vel = 0;
  let pausaAte = -1;
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

  const soltarFaiscas = (x: number, y: number, n: number, forca: number) => {
    faiscas.push({ x, y, vx: 0, vy: 0, v: 1, clarao: true });
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 3.1;
      const v = (140 + Math.random() * 320) * forca;
      faiscas.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, v: 0.5 + Math.random() * 0.6 });
    }
  };

  const controle = laco(cv, 2, () => { pal = paletaAbertura(caixa); padrao = null; }, (ctx, W, H, t, dt) => {
    const escuro = pal.estrelas > 0;
    const xc = W / 2;
    const L = Math.max(520, W * 0.72); // uma barra de 12 m na tela
    const R = Math.max(62, Math.min(132, H * 0.105)); // altura do perfil
    const topo = H - R * 2.05; // topo do boleto
    const rr = R * 0.2; // raio do rolete
    const piso = topo + R + rr * 2 + R * 0.16;

    // ---------- movimento do trilho ----------
    if (parado) {
      u = L * 0.35; vel = 0;
    } else if (t < CHEGA) {
      // abertura: o trilho entra pela direita e freia com a emenda 0 no meio
      const D = completa ? W * 0.95 : W * 0.35;
      const e = 1 - Math.pow(1 - t / CHEGA, 3);
      u = -D * (1 - e);
      vel = 0;
      pausaAte = SOLDA + PAUSA;
    } else {
      if (t < pausaAte) {
        vel = 0;
      } else {
        vel = mix(vel, VEL, 1 - Math.pow(0.05, dt));
        const antes = u;
        u += vel * dt;
        // a próxima emenda chegou no meio: para e solda
        const alvo = proxima * L;
        if (antes < alvo && u >= alvo) { u = alvo; vel = 0; pausaAte = t + PAUSA + 0.25; }
      }
      const emenda = Math.round(u / L);
      if (Math.abs(u - emenda * L) < 0.5 && !soldada.has(emenda) && (emenda > 0 ? t > pausaAte - PAUSA : t >= SOLDA)) {
        soldada.set(emenda, t);
        proxima = emenda + 1;
        soltarFaiscas(xc, topo + R * 0.05, emenda === 0 && completa ? 44 : 30, 1);
        soltarFaiscas(xc, topo + R * 0.86, 14, 0.7);
      }
    }
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

    // ---------- roletes ----------
    const esp = Math.max(170, W * 0.15);
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
    const kMin = Math.floor((u - xc) / L) - 1, kMax = Math.ceil((u + W - xc) / L) + 1;
    ctx.font = `600 ${Math.round(R * 0.19)}px var(--font-barlow-cond), "Barlow Condensed", "Arial Narrow", sans-serif`;
    ctx.textBaseline = 'middle';
    for (let k = kMin; k <= kMax; k++) {
      const x = xc + k * L - u;
      // giz no meio da barra
      const xg = x + L / 2;
      if (xg > -100 && xg < W + 100) {
        ctx.fillStyle = `rgba(255,255,255,${escuro ? 0.32 : 0.6})`;
        ctx.fillText(`TLS ${212 + Math.floor(k / 26)} · B${(((k % 13) + 13) % 13) + 1}`, xg - R * 0.6, topo + R * 0.56);
        ctx.fillRect(xg - R * 0.6, topo + R * 0.66, R * 0.9, 1.2);
      }
      if (x < -R || x > W + R) continue;
      const quando = soldada.get(k);
      if (quando === undefined) {
        // ainda não soldada: fresta entre as barras
        ctx.fillStyle = cor(pal.ceuTopo, 0.95);
        ctx.fillRect(x - 1.5, topo - R * 0.07, 3, R * 1.07);
        continue;
      }
      // colar da solda aluminotérmica: um "anel" um pouco mais alto e largo que o perfil, arredondado
      const cw = R * 0.2;
      const colar = (c: CanvasRenderingContext2D) => {
        c.beginPath();
        c.roundRect(x - cw * 0.42, topo - R * 0.085, cw * 0.84, R * 0.36, R * 0.04); // boleto
        c.roundRect(x - cw * 0.5, topo + R * 0.26, cw, R * 0.54, R * 0.08); // alma (o colar é mais largo)
        c.roundRect(x - cw * 0.72, topo + R * 0.76, cw * 1.44, R * 0.26, R * 0.05); // patim
      };
      const frio = ctx.createLinearGradient(0, topo - R * 0.08, 0, topo + R);
      frio.addColorStop(0, cor(misturar(pal.aco, pal.acoLado, 0.35)));
      frio.addColorStop(0.3, cor(misturar(pal.acoLado, pal.ceuTopo, 0.15)));
      frio.addColorStop(0.7, cor(misturar(pal.acoLado, pal.ceuTopo, 0.4)));
      frio.addColorStop(1, cor(misturar(pal.acoLado, pal.ceuTopo, 0.2)));
      ctx.fillStyle = frio;
      colar(ctx);
      ctx.fill();
      // contorno do colar, para a emenda fria continuar visível no trilho
      ctx.strokeStyle = 'rgba(0,0,0,.32)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // topo do boleto esmerilhado depois da solda
      ctx.fillStyle = cor(pal.aco, 0.9);
      ctx.fillRect(x - cw * 0.42, topo - R * 0.06, cw * 0.84, 1.4);
      // calor
      const h = calor(ultimoT - quando);
      if (h.a > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, topo + R * 0.45, 0, x, topo + R * 0.45, R * 1.9);
        g.addColorStop(0, cor(h.c, 0.5 * h.a)); g.addColorStop(0.4, cor(h.c, 0.16 * h.a)); g.addColorStop(1, cor(h.c, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, topo + R * 0.45, R * 1.9, 0, 6.283); ctx.fill();
        // reflexo no piso
        const gp = ctx.createRadialGradient(x, piso + 2, 0, x, piso + 2, R * 1.3);
        gp.addColorStop(0, cor(h.c, 0.32 * h.a)); gp.addColorStop(1, cor(h.c, 0));
        ctx.fillStyle = gp; ctx.fillRect(x - R * 1.3, piso, R * 2.6, R * 0.7);
        ctx.restore();
        // o metal em brasa: mais claro no miolo, escurecendo para as bordas
        const quente = ctx.createRadialGradient(x, topo + R * 0.45, 0, x, topo + R * 0.45, R * 0.75);
        quente.addColorStop(0, cor(misturar(h.c, [255, 255, 240], 0.35), h.a));
        quente.addColorStop(0.6, cor(h.c, h.a));
        quente.addColorStop(1, cor(misturar(h.c, [60, 10, 5], 0.45), h.a * 0.9));
        ctx.fillStyle = quente;
        colar(ctx);
        ctx.fill();
        // brasas subindo da solda quente
        if (!parado && h.a > 0.35 && Math.random() < dt * 14 * h.a) {
          brasas.push({ x: x + (Math.random() - 0.5) * cw, y: topo, vy: -(20 + Math.random() * 40), vx: (Math.random() - 0.5) * 14, v: 1 });
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
