/*
  Warnings:

  - You are about to drop the column `pesoReal` on the `Grupo` table. All the data in the column will be lost.
  - You are about to drop the column `statusPeso` on the `Grupo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Grupo" DROP COLUMN "pesoReal",
DROP COLUMN "statusPeso",
ALTER COLUMN "pesoCalculado" DROP NOT NULL,
ALTER COLUMN "pesoCalculado" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN     "pesoSucataReal" DECIMAL(65,30);

-- DropEnum
DROP TYPE "StatusPeso";

-- CreateTable
CREATE TABLE "FatorPerfil" (
    "perfil" "PerfilTrilho" NOT NULL,
    "fator" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "FatorPerfil_pkey" PRIMARY KEY ("perfil")
);
