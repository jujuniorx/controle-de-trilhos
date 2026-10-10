import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { IndicadorSincronizacao } from '@/components/IndicadorSincronizacao';

const { sincronizarPendentesMock } = vi.hoisted(() => ({
  sincronizarPendentesMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/offline/sync', () => ({
  sincronizarPendentes: sincronizarPendentesMock,
}));

describe('IndicadorSincronizacao', () => {
  afterEach(() => {
    cleanup();
    sincronizarPendentesMock.mockClear();
  });

  it('renderiza sem erro e expõe um indicador de status (role="status")', async () => {
    render(<IndicadorSincronizacao />);

    expect(await screen.findByRole('status')).toBeTruthy();
  });
});
