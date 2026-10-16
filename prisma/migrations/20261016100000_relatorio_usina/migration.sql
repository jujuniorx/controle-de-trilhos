-- CreateEnum
CREATE TYPE "LiderGeracao" AS ENUM ('ALECIO', 'BRUNO', 'REGINALDO');

-- CreateEnum
CREATE TYPE "ComposicaoAtiva" AS ENUM ('W61', 'W62');

-- CreateEnum
CREATE TYPE "TrilheiroCod" AS ENUM ('E40', 'E42', 'E46');

-- CreateEnum
CREATE TYPE "CaminhaoSolda" AS ENUM ('CW01', 'CW02', 'CW03');

-- CreateEnum
CREATE TYPE "TipoTls" AS ENUM ('UIC60_REEMPREGO', 'UIC60_NOVO', 'GB60_REEMPREGO', 'TR68_REEMPREGO', 'TR68_NOVO');

-- CreateTable
CREATE TABLE "EstaleiroDia" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "soldas" INTEGER,
    "cortes" INTEGER,
    "observacao" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstaleiroDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManutencaoSemana" (
    "id" TEXT NOT NULL,
    "semanaInicio" DATE NOT NULL,
    "diaManutencao" DATE NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManutencaoSemana_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstoqueTlsDia" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoTls" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstoqueTlsDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalaSemana" (
    "id" TEXT NOT NULL,
    "semanaInicio" DATE NOT NULL,
    "conteudo" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalaSemana_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeracaoDia" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "lider" "LiderGeracao" NOT NULL,
    "local" TEXT,
    "corteM" DECIMAL(65,30),
    "carregamentoM" DECIMAL(65,30),
    "perfil" TEXT,
    "quantidade" INTEGER,
    "deixadaViaM" DECIMAL(65,30),
    "observacao" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeracaoDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComposicaoDia" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "ativo" "ComposicaoAtiva" NOT NULL,
    "barras" INTEGER,
    "jacares" INTEGER,
    "observacao" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComposicaoDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrilheiroGiro" (
    "id" TEXT NOT NULL,
    "trilheiro" "TrilheiroCod" NOT NULL,
    "boEm" DATE,
    "chegadaUsinaEm" DATE,
    "partidaEm" DATE,
    "retornoEm" DATE,
    "perfil" "TipoTls",
    "carregados" INTEGER NOT NULL DEFAULT 0,
    "descarregados" INTEGER NOT NULL DEFAULT 0,
    "local" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrilheiroGiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrilheiroManutencao" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "trilheiro" "TrilheiroCod" NOT NULL,
    "local" TEXT,
    "tipo" TEXT,
    "detalhamento" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrilheiroManutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaminhaoSoldaDia" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "caminhao" "CaminhaoSolda" NOT NULL,
    "local" TEXT,
    "producaoDiaria" INTEGER,
    "inicioMacro1" TEXT,
    "terminoMacro9" TEXT,
    "perdaDiaria" INTEGER,
    "observacao" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaminhaoSoldaDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feriado" (
    "data" DATE NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Feriado_pkey" PRIMARY KEY ("data")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstaleiroDia_data_key" ON "EstaleiroDia"("data");

-- CreateIndex
CREATE UNIQUE INDEX "ManutencaoSemana_semanaInicio_key" ON "ManutencaoSemana"("semanaInicio");

-- CreateIndex
CREATE UNIQUE INDEX "EstoqueTlsDia_data_tipo_key" ON "EstoqueTlsDia"("data", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "EscalaSemana_semanaInicio_key" ON "EscalaSemana"("semanaInicio");

-- CreateIndex
CREATE UNIQUE INDEX "GeracaoDia_data_lider_key" ON "GeracaoDia"("data", "lider");

-- CreateIndex
CREATE UNIQUE INDEX "ComposicaoDia_data_ativo_key" ON "ComposicaoDia"("data", "ativo");

-- CreateIndex
CREATE INDEX "TrilheiroGiro_trilheiro_boEm_idx" ON "TrilheiroGiro"("trilheiro", "boEm");

-- CreateIndex
CREATE INDEX "TrilheiroManutencao_trilheiro_data_idx" ON "TrilheiroManutencao"("trilheiro", "data");

-- CreateIndex
CREATE UNIQUE INDEX "CaminhaoSoldaDia_data_caminhao_key" ON "CaminhaoSoldaDia"("data", "caminhao");
