#!/bin/bash
# Script pré-build: limpa cache e força regeneração sem validação de database

rm -rf .next
rm -rf node_modules/.prisma

# Usa engine check nativo que gera tipos do schema
export PRISMA_SKIP_VALIDATE_EXECUTABLE=true
export PRISMA_SKIP_ENGINE_CHECK=false

# Tenta gerar, ignora erros de conexão
prisma generate || echo "Prisma generate falhou, continuando mesmo assim..."

# Aplica migrações pendentes (só adicionam coisas: valor de enum, tabela). NUNCA derruba o
# build: se o banco não estiver acessível aqui, segue sem aplicar (rode "npx prisma migrate
# deploy" com a DIRECT_DATABASE_URL de produção).
timeout 120 npx prisma migrate deploy || echo "Migrações não aplicadas no build, continuando mesmo assim..."

exit 0
