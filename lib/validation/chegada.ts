import { z } from 'zod';
import { dadosPortariaSchema } from '@/lib/validation/portaria';

/** Recebimento: mesmos campos da Portaria, sem destino (o material está chegando AQUI). */
export const dadosChegadaSchema = dadosPortariaSchema.omit({ destino: true }).extend({
  // Caminhão que também carrega depois de descarregar.
  cargaDescarga: z.boolean().optional(),
});
export type DadosChegada = z.infer<typeof dadosChegadaSchema>;
