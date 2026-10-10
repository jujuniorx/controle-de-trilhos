-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('RECEBIMENTO', 'REMETIDO');

-- CreateEnum
CREATE TYPE "StatusMovimentacao" AS ENUM ('PENDENTE_CONFERENCIA', 'CONFERIDO');

-- CreateEnum
CREATE TYPE "TipoTransporte" AS ENUM ('CAMINHAO', 'VAGAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoRemetido" AS ENUM ('VENDA', 'TRANS', 'INDUS');

-- CreateEnum
CREATE TYPE "PerfilTrilho" AS ENUM ('TR22', 'TR32', 'TR37', 'TR40', 'TR45', 'TR50', 'TR54', 'TR55', 'TR57', 'TR60', 'TR68');

-- CreateEnum
CREATE TYPE "TipoMaterial" AS ENUM ('NOVO', 'REEMPREGO', 'SUCATA');

-- CreateEnum
CREATE TYPE "ClassificacaoReemprego" AS ENUM ('G1', 'G2', 'G3');

-- CreateEnum
CREATE TYPE "ClassificacaoSC" AS ENUM ('SC1', 'SC2', 'SC3');

-- CreateEnum
CREATE TYPE "StatusPeso" AS ENUM ('CALCULADO', 'PENDENTE', 'CONFIRMADO');

-- CreateEnum
CREATE TYPE "ModoMedicao" AS ENUM ('INDIVIDUAL', 'QTD_COMPRIMENTO');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoLoginEm" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoAte" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatioAcessoToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PatioAcessoToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimentacao" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "tipoTransporte" "TipoTransporte" NOT NULL,
    "placaCavalo" TEXT,
    "placaCarreta" TEXT,
    "origem" TEXT,
    "destino" TEXT,
    "responsavelPatio" TEXT NOT NULL,
    "status" "StatusMovimentacao" NOT NULL DEFAULT 'PENDENTE_CONFERENCIA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conferidoPorId" TEXT,
    "conferidoEm" TIMESTAMP(3),

    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemetidoDetalhe" (
    "movimentacaoId" TEXT NOT NULL,
    "tipoRemetido" "TipoRemetido" NOT NULL,

    CONSTRAINT "RemetidoDetalhe_pkey" PRIMARY KEY ("movimentacaoId")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "movimentacaoId" TEXT NOT NULL,
    "perfil" "PerfilTrilho" NOT NULL,
    "tipoMaterial" "TipoMaterial" NOT NULL,
    "classificacao" "ClassificacaoReemprego",
    "fabricante" TEXT,
    "metrosTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "pesoCalculado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "statusPeso" "StatusPeso" NOT NULL DEFAULT 'CALCULADO',
    "pesoReal" DECIMAL(65,30),

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicao" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "modo" "ModoMedicao" NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "comprimento" DECIMAL(65,30) NOT NULL,
    "metros" DECIMAL(65,30) NOT NULL,
    "classificacaoSC" "ClassificacaoSC",

    CONSTRAINT "Medicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" TEXT NOT NULL,
    "movimentacaoId" TEXT NOT NULL,
    "grupoId" TEXT,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoAlteracao" (
    "id" TEXT NOT NULL,
    "movimentacaoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "usuarioNome" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "campo" TEXT,
    "valorAntigo" TEXT,
    "valorNovo" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoAlteracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_identificador_key" ON "LoginAttempt"("identificador");

-- CreateIndex
CREATE UNIQUE INDEX "PatioAcessoToken_tokenHash_key" ON "PatioAcessoToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Movimentacao_clientId_key" ON "Movimentacao"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Grupo_clientId_key" ON "Grupo"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Medicao_clientId_key" ON "Medicao"("clientId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemetidoDetalhe" ADD CONSTRAINT "RemetidoDetalhe_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "Movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "Movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicao" ADD CONSTRAINT "Medicao_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "Movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoAlteracao" ADD CONSTRAINT "HistoricoAlteracao_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "Movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
