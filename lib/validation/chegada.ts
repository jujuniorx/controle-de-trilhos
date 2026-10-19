import { z } from 'zod';
import { dadosPortariaSchema } from '@/lib/validation/portaria';

/** Recebimento: mesmos campos da Portaria, sem destino (o material está chegando AQUI). */
export const dadosChegadaSchema = dadosPortariaSchema.omit({ destino: true }).extend({
  // Caminhão que também carrega depois de descarregar.
  cargaDescarga: z.boolean().optional(),
  // Destino da carga, quando o caminhão também carrega.
  destinoCarga: z.string().trim().max(120, 'Máximo de 120 caracteres.').optional(),
});
export type DadosChegada = z.infer<typeof dadosChegadaSchema>;
