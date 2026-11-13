// Gera os ícones do app (public/icons/<tema>/...) com a marca do sistema: a via vista de cima (dois trilhos, cinco dormentes e as placas de apoio).
// Uso: node scripts/gerar-icones-do-app.mjs   (precisa do Playwright com o Chromium instalado)
// A geometria é a mesma de components/ui/Logo.tsx (MARCA_DORMENTES e MARCA_TRILHOS); se a marca mudar lá, mude aqui também.
import { chromium } from 'playwright';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';

const DORMENTES = [10.5, 19.25, 28, 36.75, 45.5];
const TRILHOS = [15, 41];

// Fundo (degradê do canto de cima à esquerda ao de baixo à direita), trilho, dormente e contorno de cada tema.
const TEMAS = {
  azul: { de: '#6a85fe', ate: '#304ce0', trilho: '#ffffff', dorm: '#c3ceff' },
  escuro: { de: '#19191b', ate: '#0b0b0c', trilho: '#fafafa', dorm: '#a1a1aa', contorno: 'rgba(255,255,255,.4)' },
  claro: { de: '#292929', ate: '#0e0e0e', trilho: '#ffffff', dorm: '#9a9a95' },
  pastel: { de: '#292047', ate: '#1b1530', trilho: '#ffffff', dorm: '#b9a6ff' },
  vermelho: { de: '#ff3b3f', ate: '#7a0d10', trilho: '#ffffff', dorm: '#ff9a9c' },
};

/** SVG do ícone. raio = canto arredondado (0 = fundo até a borda); escala = tamanho da marca dentro do quadro. */
function svg(c, tamanho, raio, escala) {
  const desloca = (56 - 56 * escala) / 2;
  const contorno = c.contorno && raio > 0 ? `<rect x=".6" y=".6" width="54.8" height="54.8" rx="${raio - 0.6}" fill="none" stroke="${c.contorno}" stroke-width="1.2"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 56 56">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.de}"/><stop offset="1" stop-color="${c.ate}"/></linearGradient></defs>
  <rect width="56" height="56" rx="${raio}" fill="url(#g)"/>${contorno}
  <g transform="translate(${desloca} ${desloca}) scale(${escala})">
    ${DORMENTES.map((x) => `<rect x="${x - 2}" y="9" width="4" height="38" rx="1.6" fill="${c.dorm}" opacity=".55"/>${TRILHOS.map((y) => `<rect x="${x - 3.5}" y="${y - 3.7}" width="7" height="7.4" rx="1" fill="${c.dorm}"/>`).join('')}`).join('')}
    ${TRILHOS.map((y) => `<rect x="5.5" y="${y - 2.5}" width="45" height="5" rx="2.5" fill="${c.trilho}"/><rect x="8.5" y="${y - 0.55}" width="39" height="1.1" rx=".55" fill="#000" opacity=".2"/>`).join('')}
  </g>
</svg>`;
}

const ARQUIVOS = [
  { nome: 'icon-512.png', tamanho: 512, raio: 12.5, escala: 0.92, transparente: true },
  { nome: 'icon-192.png', tamanho: 192, raio: 12.5, escala: 0.92, transparente: true },
  { nome: 'favicon-48.png', tamanho: 48, raio: 12.5, escala: 1, transparente: true },
  // Maskable: o aparelho corta as bordas, então o fundo vai até a borda e a marca fica na área segura.
  { nome: 'icon-maskable-512.png', tamanho: 512, raio: 0, escala: 0.7, transparente: false },
  // iPhone: sem transparência (ele mesmo arredonda os cantos).
  { nome: 'apple-touch-icon.png', tamanho: 180, raio: 0, escala: 0.86, transparente: false },
];

const navegador = await chromium.launch();
for (const [tema, cores] of Object.entries(TEMAS)) {
  await mkdir(`public/icons/${tema}`, { recursive: true });
  for (const a of ARQUIVOS) {
    const pagina = await navegador.newPage({ viewport: { width: a.tamanho, height: a.tamanho } });
    await pagina.setContent(`<body style="margin:0;background:transparent">${svg(cores, a.tamanho, a.raio, a.escala)}</body>`);
    await writeFile(`public/icons/${tema}/${a.nome}`, await pagina.screenshot({ omitBackground: a.transparente }));
    await pagina.close();
  }
}
await navegador.close();
// Os ícones da raiz (usados nas notificações e por quem ainda não escolheu tema) são os do tema padrão, Azul-marinho.
for (const nome of ['icon-512.png', 'icon-192.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) {
  await copyFile(`public/icons/azul/${nome}`, `public/icons/${nome}`);
}
console.log('Ícones gerados em public/icons');
