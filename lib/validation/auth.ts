import { z } from 'zod';

export const trocarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual.'),
    novaSenha: z
      .string()
      .min(8, 'A nova senha precisa ter ao menos 8 caracteres.')
      .regex(/[A-Za-z]/, 'A nova senha precisa ter ao menos uma letra.')
      .regex(/[0-9]/, 'A nova senha precisa ter ao menos um número.'),
    confirmacao: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((d) => d.novaSenha === d.confirmacao, {
    message: 'A confirmação não bate com a nova senha.',
    path: ['confirmacao'],
  })
  .refine((d) => d.novaSenha !== d.senhaAtual, {
    message: 'A nova senha precisa ser diferente da senha atual.',
    path: ['novaSenha'],
  });

export type TrocarSenhaInput = z.infer<typeof trocarSenhaSchema>;
