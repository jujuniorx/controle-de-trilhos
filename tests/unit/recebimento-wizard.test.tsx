import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecebimentoWizard } from '@/app/patio/(protegido)/recebimentos/novo/RecebimentoWizard';

const {
  pushMock,
  salvarRecebimentoLocalMock,
  sincronizarPendentesMock,
  salvarRascunhoRecebimentoMock,
  lerRascunhoRecebimentoMock,
  limparRascunhoRecebimentoMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  salvarRecebimentoLocalMock: vi.fn().mockResolvedValue(undefined),
  sincronizarPendentesMock: vi.fn().mockResolvedValue(undefined),
  salvarRascunhoRecebimentoMock: vi.fn().mockResolvedValue(undefined),
  lerRascunhoRecebimentoMock: vi.fn().mockResolvedValue(undefined),
  limparRascunhoRecebimentoMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/offline/db', () => ({
  salvarRecebimentoLocal: salvarRecebimentoLocalMock,
  salvarRascunhoRecebimento: salvarRascunhoRecebimentoMock,
  lerRascunhoRecebimento: lerRascunhoRecebimentoMock,
  limparRascunhoRecebimento: limparRascunhoRecebimentoMock,
}));

vi.mock('@/lib/offline/sync', () => ({
  sincronizarPendentes: sincronizarPendentesMock,
}));

describe('RecebimentoWizard — portão de validação local antes de gravar no Dexie', () => {
  beforeEach(() => {
    pushMock.mockClear();
    salvarRecebimentoLocalMock.mockClear();
    sincronizarPendentesMock.mockClear();
    salvarRascunhoRecebimentoMock.mockClear();
    limparRascunhoRecebimentoMock.mockClear();
    lerRascunhoRecebimentoMock.mockReset().mockResolvedValue(undefined);
  });

  it('bloqueia a gravação local e mostra o erro inline quando o payload não passa no schema, mesmo tendo passado pelas validações de UI dos passos 1-4', async () => {
    // Gap real da validação de UI: o input "Quantidade" (modo Quantidade × comprimento)
    // não tem limite superior — só `Math.max(1, ...)` — mas o schema exige max(99).
    // É um caminho totalmente alcançável pela UI que o schema rejeita: exatamente o
    // cenário que o portão de validação em finalizar() precisa barrar antes do Dexie.
    render(<RecebimentoWizard fatoresCadastrados={{ TR57: 0.05 }} />);

    fireEvent.change(document.getElementById('f-nf')!, { target: { value: '123456' } });
    fireEvent.change(document.getElementById('f-origem')!, { target: { value: 'Rondonópolis' } });
    fireEvent.change(document.getElementById('f-cavalo')!, { target: { value: 'ABC1D23' } });
    fireEvent.change(document.getElementById('f-resp')!, { target: { value: 'Teste Unitário' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));

    fireEvent.change(screen.getByLabelText('Perfil do novo grupo'), { target: { value: 'TR57' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar grupo' }));
    fireEvent.change(screen.getByLabelText('Marca do Grupo 1'), { target: { value: 'NIPPON' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lançar medidas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quantidade × comprimento' }));
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '999' } });
    fireEvent.change(screen.getByLabelText('Comprimento'), { target: { value: '5,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Voltar aos grupos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver resumo' }));

    fireEvent.click(screen.getByRole('button', { name: 'Finalizar e salvar' }));

    expect(await screen.findByText('Dados inválidos. Revise os campos e tente novamente.')).toBeTruthy();
    expect(salvarRecebimentoLocalMock).not.toHaveBeenCalled();
    expect(sincronizarPendentesMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
