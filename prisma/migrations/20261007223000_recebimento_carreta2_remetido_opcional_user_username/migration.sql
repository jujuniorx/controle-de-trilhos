-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN     "placaCarreta2" TEXT;

-- AlterTable
ALTER TABLE "RemetidoDetalhe" ALTER COLUMN "tipoRemetido" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
