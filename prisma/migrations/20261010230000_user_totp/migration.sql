-- Verificação em duas etapas (TOTP) opcional por usuário. Colunas aditivas: nada muda para quem não ativar.
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT,
ADD COLUMN "totpAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "totpUltimoPasso" INTEGER;
