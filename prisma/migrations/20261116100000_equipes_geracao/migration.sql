-- Equipes de geração de trilho: o nome de quem está em cada equipe fica aqui, separado da equipe.
CREATE TABLE "EquipeGeracao" (
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "EquipeGeracao_pkey" PRIMARY KEY ("codigo")
);

INSERT INTO "EquipeGeracao" ("codigo", "nome") VALUES
    ('ALECIO', 'Alécio'),
    ('BRUNO', 'Bruno'),
    ('REGINALDO', 'Reginaldo')
ON CONFLICT ("codigo") DO NOTHING;
