import { describe, it, expect } from 'vitest';
import { novoUsuarioSchema, novaSenhaSchema } from '@/lib/validation/usuario';

describe('novoUsuarioSchema', () => {
  it('normaliza o usuário para minúsculas e aceita dados válidos', () => {
    const r = novoUsuarioSchema.parse({ nome: ' Ana ', username: 'Ana.Silva', senha: 'abcdefg1' });
    expect(r).toEqual({ nome: 'Ana', username: 'ana.silva', senha: 'abcdefg1' });
  });
  it('recusa usuário com espaço ou muito curto', () => {
    expect(novoUsuarioSchema.safeParse({ nome: 'Ana', username: 'a b', senha: 'abcdefg1' }).success).toBe(false);
    expect(novoUsuarioSchema.safeParse({ nome: 'Ana', username: 'an', senha: 'abcdefg1' }).success).toBe(false);
  });
  it('recusa senha fraca', () => {
    expect(novaSenhaSchema.safeParse({ senha: 'curta1' }).success).toBe(false);
    expect(novaSenhaSchema.safeParse({ senha: 'semnumeros' }).success).toBe(false);
    expect(novaSenhaSchema.safeParse({ senha: '12345678' }).success).toBe(false);
  });
});
