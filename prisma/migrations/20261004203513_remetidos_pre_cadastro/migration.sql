-- AlterEnum
ALTER TYPE "StatusMovimentacao" ADD VALUE 'AGUARDANDO_CHEGADA';

-- AlterTable
ALTER TABLE "Grupo" ADD COLUMN     "pesoInformado" DECIMAL(65,30),
ADD COLUMN     "tampao" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN     "reservaPedido" TEXT,
ALTER COLUMN "numeroDocumento" DROP NOT NULL,
ALTER COLUMN "responsavelPatio" DROP NOT NULL,
ALTER COLUMN "dataMovimentacao" DROP NOT NULL;
