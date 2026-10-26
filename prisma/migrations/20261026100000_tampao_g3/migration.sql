-- Todo reemprego G1, G2 ou G3 passa a ser tampão (inclusive os remetidos já cadastrados).
UPDATE "Grupo"
SET "tampao" = true
WHERE "tipoMaterial" = 'REEMPREGO'
  AND "classificacao"::text IN ('G1', 'G2', 'G3')
  AND "tampao" = false;
