// Gera os @keyframes da linha férrea (perspectiva real) e imprime o CSS para colar entre
// os marcadores "trilhos:keyframes" de app/globals.css.
// Uso: node scripts/gerar-keyframes-via.mjs --escrever   (sem a flag, só imprime)
// Constantes iguais às de lib/ui/geometriaVia.ts.
const BEND = 0;
const DORMENTE_METADE = 19;
const LOCO_LARGURA = 30; // % da largura da via
const FAROL_LARGURA = 10; // idem
const Z0 = 9; // distância em que o dormente "nasce"
const Z_FIM = 0.9; // já passou da base da tela
const r = (n, d = 3) => Number(n.toFixed(d));
const e = (z) => 1 / z;
const desvio = (ev) => BEND * (1 - Math.min(ev, 1)) ** 2;

function passos(inicio, fim, n, fn) {
  const linhas = [];
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    const z = Z0 - (Z0 - Z_FIM) * p;
    linhas.push([r(inicio + (fim - inicio) * p, 2), fn(e(z), p)]);
  }
  return linhas;
}

let css = '';

// Dormentes: o contêiner desce (translateY), a barra cresce e acompanha a curva.
css += '@keyframes via-avanca {\n';
for (const [pc, ev] of passos(0, 100, 25, (ev) => ev)) css += `  ${pc}% { transform: translateY(${r(ev * 100, 2)}%); }\n`;
css += '}\n@keyframes via-engorda {\n';
for (const [pc, ev, p] of passos(0, 100, 25, (ev, p) => [ev, p]).map(([a, [b, c]]) => [a, b, c])) {
  const tx = (desvio(ev) / (DORMENTE_METADE * 2)) * 100;
  const op = p < 0.1 ? r(p / 0.1, 2) : 1;
  css += `  ${pc}% { transform: translateX(${r(tx, 2)}%) scale(${r(ev)}, ${r(ev * ev)}); opacity: ${op}; }\n`;
}
css += '}\n';

// Trem: janela de 62% a 90% do ciclo; fora dela fica invisível.
const T0 = 62;
const T1 = 90;
css += '@keyframes via-trem-y {\n  0%, ' + T0 + '% { transform: translateY(0); visibility: hidden; }\n';
for (const [pc, ev] of passos(T0, T1, 24, (ev) => ev)) css += `  ${pc}% { transform: translateY(${r(ev * 100, 2)}%); visibility: visible; }\n`;
css += `  ${T1 + 0.01}%, 100% { transform: translateY(140%); visibility: hidden; }\n}\n`;

css += '@keyframes via-loco {\n  0%, ' + T0 + '% { opacity: 0; transform: translate(-50%, -100%) scale(0.07); }\n';
for (const [pc, ev] of passos(T0, T1, 24, (ev) => ev)) {
  const tx = -50 + (desvio(ev) / LOCO_LARGURA) * 100;
  const op = pc < T0 + 2 ? r((pc - T0) / 2, 2) : pc > T1 - 2 ? r((T1 - pc) / 2 + 0.0001, 2) : 1;
  css += `  ${pc}% { opacity: ${Math.max(0, Math.min(1, op))}; transform: translate(${r(tx, 2)}%, -100%) scale(${r(ev)}); }\n`;
}
css += '  100% { opacity: 0; transform: translate(-50%, -100%) scale(1.4); }\n}\n';

css += '@keyframes via-farol {\n  0%, ' + T0 + '% { opacity: 0; }\n';
for (const [pc, ev] of passos(T0, T1, 24, (ev) => ev)) {
  const tx = -50 + (desvio(ev) / FAROL_LARGURA) * 100;
  const ty = -(50 + 106 * Math.min(ev, 1.4));
  const s = 0.12 + 1.88 * Math.pow(ev, 1.3);
  const op = pc < T0 + 1 ? 0.2 : pc > T1 - 3 ? Math.max(0, r((T1 - pc) / 3, 2)) : Math.min(1, 0.35 + ev);
  css += `  ${pc}% { opacity: ${r(op, 2)}; transform: translate(${r(tx, 2)}%, ${r(ty, 2)}%) scale(${r(s)}); }\n`;
}
css += '  100% { opacity: 0; }\n}\n';

if (process.argv.includes('--escrever')) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const arq = new URL('../app/globals.css', import.meta.url);
  const atual = readFileSync(arq, 'utf8');
  const ini = atual.indexOf('/* trilhos:keyframes */') + '/* trilhos:keyframes */'.length;
  const fim = atual.indexOf('/* trilhos:fim-keyframes */');
  writeFileSync(arq, atual.slice(0, ini) + '\n' + css + atual.slice(fim));
  console.log('keyframes atualizados em app/globals.css');
} else {
  process.stdout.write(css);
}
