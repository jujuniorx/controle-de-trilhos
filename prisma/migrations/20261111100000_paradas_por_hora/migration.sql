-- Varias paradas por hora (ate 3), guardadas como JSON. Copia a parada unica que existia.
ALTER TABLE "ProducaoLinha" ADD COLUMN "paradas" TEXT NOT NULL DEFAULT '[]';

UPDATE "ProducaoLinha"
SET "paradas" = json_build_array(json_build_object('inicio', "paradaInicio", 'minutos', "paradaMinutos", 'descricao', "paradaDescricao"))::text
WHERE "paradaMinutos" IS NOT NULL;

ALTER TABLE "ProducaoLinha" DROP COLUMN "paradaInicio", DROP COLUMN "paradaMinutos", DROP COLUMN "paradaDescricao";
