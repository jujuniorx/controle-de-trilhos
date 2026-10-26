-- Partida da usina (data) e local atual de cada trilheiro
ALTER TABLE "TrilheiroDia" ADD COLUMN "partidaEm" DATE, ADD COLUMN "local" TEXT;
