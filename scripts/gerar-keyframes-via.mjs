// Gera os @keyframes da linha férrea (perspectiva real) e imprime o CSS para colar entre
// os marcadores "trilhos:keyframes" de app/globals.css.
// Uso: node scripts/gerar-keyframes-via.mjs --escrever   (sem a flag, só imprime)
// Constantes iguais às de lib/ui/geometriaVia.ts.
const BEND = 0;
const DORMENTE_METADE = 16.5;
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
