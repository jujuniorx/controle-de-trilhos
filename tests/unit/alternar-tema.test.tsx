import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AlternarTema } from '@/components/ui/AlternarTema';
import { TEMA_COOKIE, temaValido } from '@/lib/tema/tema';

describe('temaValido', () => {
  it('aceita só claro/escuro', () => {
    expect(temaValido('claro')).toBe('claro');
    expect(temaValido('escuro')).toBe('escuro');
    expect(temaValido('azul')).toBeUndefined();
    expect(temaValido(undefined)).toBeUndefined();
  });
});

describe('AlternarTema', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.tema;
    document.cookie = `${TEMA_COOKIE}=; path=/; max-age=0`;
  });
  afterEach(cleanup);

  it('no padrão claro oferece o tema escuro e, ao clicar, grava cookie e data-tema', () => {
    render(<AlternarTema padrao="claro" />);
    fireEvent.click(screen.getByRole('button', { name: 'Mudar para o tema escuro' }));
    expect(document.documentElement.dataset.tema).toBe('escuro');
    expect(document.cookie).toContain(`${TEMA_COOKIE}=escuro`);
    expect(screen.getByRole('button', { name: 'Mudar para o tema claro' })).toBeInTheDocument();
  });

  it('volta ao claro no segundo clique', () => {
    render(<AlternarTema padrao="claro" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.tema).toBe('claro');
    expect(document.cookie).toContain(`${TEMA_COOKIE}=claro`);
  });

  it('respeita o tema já escolhido (data-tema do servidor) acima do padrão da área', () => {
    document.documentElement.dataset.tema = 'claro';
    render(<AlternarTema padrao="escuro" />);
    expect(screen.getByRole('button', { name: 'Mudar para o tema escuro' })).toBeInTheDocument();
  });
});
