import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PatioShell } from '@/components/patio/PatioShell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/patio/remetidos',
}));

vi.mock('@/lib/offline/sync', () => ({
  sincronizarPendentes: vi.fn().mockResolvedValue(undefined),
}));

describe('PatioShell', () => {
  afterEach(cleanup);

  it('mostra a marca "Controle de Trilhos" e o badge "Pátio"', () => {
    render(<PatioShell>conteúdo</PatioShell>);
    expect(screen.getByText('Controle de Trilhos')).toBeTruthy();
    expect(screen.getByText('Pátio')).toBeTruthy();
  });

  it('renderiza o indicador de sincronização e os filhos', async () => {
    render(<PatioShell>área de conteúdo</PatioShell>);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText('área de conteúdo')).toBeTruthy();
  });
});
