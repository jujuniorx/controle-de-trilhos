'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Nome de cada seção do Administrativo, para a trilha do topo ("Usina / Relatório gerencial"). */
const SECOES: Record<string, string> = {
  '/admin': 'Pendências',
  '/admin/dono': 'Visão geral',
  '/admin/relatorios': 'Relatórios',
  '/admin/informativo': 'Informativo',
  '/admin/portaria': 'Portaria',
  '/admin/usina': 'Usina',
  '/admin/usuarios': 'Usuários',
  '/admin/lixeira': 'Lixeira',
  '/admin/pilhas': 'Pilhas do pátio',
  '/admin/auditoria': 'Auditoria',
  '/admin/serra': 'Serra',
  '/admin/trocar-senha': 'Trocar minha senha',
};

const SUBPAGINAS: Record<string, string> = {
  'relatorio-gerencial': 'Relatório gerencial',
  imprimir: 'Imprimir',
  romaneio: 'Romaneio',
  editar: 'Editar',
};

type Passo = { rotulo: string; href?: string };

function montarTrilha(pathname: string): Passo[] {
  const limpo = pathname.replace(/\/$/, '') || '/admin';
  if (SECOES[limpo]) return [{ rotulo: SECOES[limpo] }];

  const partes = limpo.split('/').filter(Boolean); // ['admin', 'usina', 'relatorio-gerencial']
  const base = `/admin/${partes[1] ?? ''}`;
  const passos: Passo[] = [];

  if (partes[1] === 'recebimentos' || partes[1] === 'remetidos') {
    // Detalhes de movimentação são abertos a partir das Pendências.
    passos.push({ rotulo: 'Pendências', href: '/admin' });
    passos.push({ rotulo: partes[1] === 'recebimentos' ? 'Recebimento' : 'Remetido', href: partes[3] ? `${base}/${partes[2]}` : undefined });
  } else if (SECOES[base]) {
    passos.push({ rotulo: SECOES[base], href: base });
  }

  const ultima = partes[partes.length - 1];
  if (partes.length > 2 && SUBPAGINAS[ultima]) passos.push({ rotulo: SUBPAGINAS[ultima] });
  return passos;
}

/** Trilha de navegação do topo (só desktop): mostra onde a pessoa está e deixa voltar um nível com um clique. */
export function TrilhaTopo() {
  const pathname = usePathname() || '/admin';
  const passos = montarTrilha(pathname);
  if (passos.length === 0) return null;

  return (
    <nav aria-label="Você está em" className="trilha-topo">
      <ol>
        {passos.map((p, i) => {
          const ultimo = i === passos.length - 1;
          return (
            <li key={`${p.rotulo}-${i}`}>
              {p.href && !ultimo ? (
                <Link href={p.href}>{p.rotulo}</Link>
              ) : (
                <span aria-current={ultimo ? 'page' : undefined}>{p.rotulo}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
