/*
  Warnings:

  - Added the required column `dataMovimentacao` to the `Movimentacao` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN     "dataMovimentacao" TIMESTAMP(3) NOT NULL;
