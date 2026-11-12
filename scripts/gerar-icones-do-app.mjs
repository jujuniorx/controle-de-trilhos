// Gera os ícones do app (public/icons/<tema>/...) com a marca do sistema: o perfil do trilho sobre o dormente.
// Uso: node scripts/gerar-icones-do-app.mjs   (precisa do Playwright com o Chromium instalado)
// A geometria é a mesma de components/ui/Logo.tsx (MARCA_PERFIL); se a marca mudar lá, mude aqui também.
import { chromium } from 'playwright';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';

const PERFIL =
  'M12.5 45V42.2c0-.9.5-1.5 1.4-1.7L24.5 38V25.2c0-1.5-.8-2.5-2.3-2.8l-2.6-.5c-2-.4-3.1-1.8-3.1-3.8v-4.6c0-2.6 1.7-4.3 4.3-4.3h14.4c2.6 0 4.3 1.7 4.3 4.3v4.6c0 2-1.1 3.4-3.1 3.8l-2.6.5c-1.5.3-2.3 1.3-2.3 2.8V38l10.6 2.5c.9.2 1.4.8 1.4 1.7V45Z';

// Fundo (degradê do canto de cima à esquerda ao de baixo à direita), trilho, dormente e contorno de cada tema.
const TEMAS = {
  azul: { de: '#6a85fe', ate: '#304ce0', trilho: '#ffffff', dorm: 'rgba(255,255,255,.5)' },
  escuro: { de: '#19191b', ate: '#0b0b0c', trilho: '#fafafa', dorm: 'rgba(255,255,255,.38)', contorno: 'rgba(255,255,255,.4)' },
  claro: { de: '#292929', ate: '#0e0e0e', trilho: '#ffffff', dorm: 'rgba(255,255,255,.38)' },
  vidro: { de: '#796e67', ate: '#4f4843', trilho: '#ffb054', dorm: 'rgba(255,255,255,.5)', contorno: 'rgba(255,176,84,.6)' },
  pastel: { de: '#292047', ate: '#1b1530', trilho: '#ffffff', dorm: 'rgba(185,166,255,.8)' },
};

/** SVG do ícone. raio = canto arredondado (0 = fundo até a borda); escala = tamanho da marca dentro do quadro. */
function svg(c, tamanho, raio, escala) {
  const desloca = (56 - 56 * escala) / 2;
  const contorno = c.contorno && raio > 0 ? `<rect x=".6" y=".6" width="54.8" height="54.8" rx="${raio - 0.6}" fill="none" stroke="${c.contorno}" stroke-width="1.2"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 56 56">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.de}"/><stop offset="1" stop-color="${c.ate}"/></linearGradient></defs>
  <rect width="56" height="56" rx="${raio}" fill="url(#g)"/>${contorno}
  <g transform="translate(${desloca} ${desloca}) scale(${escala})">
    <rect x="8" y="45" width="40" height="4.5" rx="1.5" fill="${c.dorm}"/>
    <path d="${PERFIL}" fill="${c.trilho}"/>
    <rect x="20.5" y="12.2" width="15" height="2.4" rx="1.2" fill="${c.de}" opacity=".35"/>
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
