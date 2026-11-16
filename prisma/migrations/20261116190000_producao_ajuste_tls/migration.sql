-- Barras soldadas a mais e cortadas depois: o Administrativo desconta da conta do TLS.
ALTER TABLE "ProducaoDia" ADD COLUMN "ajusteTls" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProducaoDia" ADD COLUMN "ajusteTlsMotivo" TEXT;
