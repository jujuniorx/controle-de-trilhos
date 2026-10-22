import { z } from 'zod';
import { dadosPortariaSchema } from '@/lib/validation/portaria';

/** Recebimento: mesmos campos da Portaria, sem destino (o material está chegando AQUI). */
export const dadosChegadaSchema = dadosPortariaSchema.omit({ destino: true });
export type DadosChegada = z.infer<typeof dadosChegadaSchema>;
