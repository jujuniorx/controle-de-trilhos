import { z } from 'zod';

// O valor já chega como number (parseado no cliente com parseNumeroBR, mesmo
// padrão usado para a metragem no lançamento do Pátio). Zod é a segunda linha
// de defesa no servidor — nunca confiamos só na validação do navegador.
export const pesoSucataRealSchema = z.number().finite('Informe um número válido.').positive('O peso deve ser maior que zero.');
