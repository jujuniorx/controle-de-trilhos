import { describe, it, expect } from 'vitest';
import { hashSegredo, verificarSegredo } from '@/lib/services/auth';

describe('hashSegredo/verificarSegredo', () => {
  it('gera um hash verificável e rejeita valores errados', async () => {
    const hash = await hashSegredo('senha-correta');
    expect(await verificarSegredo('senha-correta', hash)).toBe(true);
    expect(await verificarSegredo('senha-errada', hash)).toBe(false);
  });

  it('trata hash mal formado (ex.: configurado com escape indevido) como "não bate", sem lançar exceção', async () => {
    const hashValido = await hashSegredo('senha-correta');
    const hashComEscapeIndevido = hashValido.replaceAll('$', '\\$');
    await expect(verificarSegredo('senha-correta', hashComEscapeIndevido)).resolves.toBe(false);
  });
});
