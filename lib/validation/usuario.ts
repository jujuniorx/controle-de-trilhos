import { z } from 'zod';

const senha = z
  .string()
  .min(8, 'A senha precisa ter ao menos 8 caracteres.')
  .regex(/[A-Za-z]/, 'A senha precisa ter ao menos uma letra.')
  .regex(/[0-9]/, 'A senha precisa ter ao menos um número.');

export const novoUsuarioSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(60, 'Nome muito longo.'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, 'Usuário: 3 a 30 caracteres, só letras minúsculas, números, ponto, hífen ou _.'),
  senha,
});

export const novaSenhaSchema = z.object({ senha });

export type NovoUsuarioInput = z.infer<typeof novoUsuarioSchema>;
