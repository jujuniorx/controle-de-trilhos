import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RecebimentoWizard } from '@/app/patio/(protegido)/recebimentos/novo/RecebimentoWizard';
import { db } from '@/lib/offline/db';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/offline/sync', () => ({ sincronizarPendentes: vi.fn().mockResolvedValue(undefined) }));

describe('RecebimentoWizard — rascunho sobrevive a sair e voltar (ex.: botão "voltar" do navegador)', () => {
  afterEach(async () => {
    cleanup();
    await db.rascunhosRecebimento.clear();
  });

  it('restaura o grupo e a medição depois que o componente desmonta e remonta', async () => {
    const { unmount } = render(<RecebimentoWizard fatoresCadastrados={{ TR57: 0.057 }} />);

    fireEvent.change(document.getElementById('f-nf')!, { target: { value: '123456' } });
    fireEvent.change(document.getElementById('f-origem')!, { target: { value: 'Rondonópolis' } });
    fireEvent.change(document.getElementById('f-cavalo')!, { target: { value: 'ABC1D23' } });
    fireEvent.change(document.getElementById('f-resp')!, { target: { value: 'Teste Rascunho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));

    fireEvent.change(screen.getByLabelText('Perfil do novo grupo'), { target: { value: 'TR57' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar grupo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lançar medidas' }));
    fireEvent.change(screen.getByLabelText('Comprimento'), { target: { value: '8,10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('1. 8.10 m')).toBeTruthy();

    // Aguarda o efeito de persistência rodar antes de "sair da tela" (desmontar).
    await vi.waitFor(async () => {
      expect(await db.rascunhosRecebimento.get('atual')).toBeDefined();
    });

    unmount();

    render(<RecebimentoWizard fatoresCadastrados={{ TR57: 0.057 }} />);

    // O rascunho foi salvo com o wizard parado na tela de medições (passo 3) — é
    // isso que "1. 8.10 m" confirma. Para confirmar que os dados do passo 1
    // (nota fiscal etc.) também sobreviveram, navega de volta como o operador
    // faria (os mesmos botões "Voltar" já usados no resto da suíte).
    expect(await screen.findByText('1. 8.10 m')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar aos grupos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));

    expect((document.getElementById('f-nf') as HTMLInputElement).value).toBe('123456');
  });

  it('finalizar com sucesso limpa o rascunho, para o próximo recebimento começar em branco', async () => {
    // spyOn primeiro, destructuring depois: `vi.spyOn` substitui a propriedade no
    // objeto do módulo, então quem desestrutura a função ANTES disso fica com a
    // referência original (não-mockada), não com o spy.
    const dbModule = await import('@/lib/offline/db');
    const salvarRecebimentoLocalSpy = vi.spyOn(dbModule, 'salvarRecebimentoLocal').mockResolvedValue(undefined);

    render(<RecebimentoWizard fatoresCadastrados={{ TR57: 0.057 }} />);

    fireEvent.change(document.getElementById('f-nf')!, { target: { value: '654321' } });
    fireEvent.change(document.getElementById('f-origem')!, { target: { value: 'Rondonópolis' } });
    fireEvent.change(document.getElementById('f-cavalo')!, { target: { value: 'ABC1D23' } });
    fireEvent.change(document.getElementById('f-resp')!, { target: { value: 'Teste Rascunho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));

    fireEvent.change(screen.getByLabelText('Perfil do novo grupo'), { target: { value: 'TR57' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar grupo' }));
    fireEvent.change(screen.getByLabelText('Marca do Grupo 1'), { target: { value: 'NIPPON' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lançar medidas' }));
    fireEvent.change(screen.getByLabelText('Comprimento'), { target: { value: '8,10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar aos grupos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver resumo' }));

    await vi.waitFor(async () => {
      expect(await db.rascunhosRecebimento.get('atual')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Finalizar e salvar' }));

    await vi.waitFor(async () => {
      expect(await db.rascunhosRecebimento.get('atual')).toBeUndefined();
    });

    expect(salvarRecebimentoLocalSpy).toHaveBeenCalled();
  });
});
