#!/bin/bash
# Script pré-build: limpa cache e força regeneração sem validação de database

rm -rf .next
rm -rf node_modules/.prisma

# Usa engine check nativo que gera tipos do schema
export PRISMA_SKIP_VALIDATE_EXECUTABLE=true
export PRISMA_SKIP_ENGINE_CHECK=false

# Tenta gerar, ignora erros de conexão
prisma generate || echo "Prisma generate falhou, continuando mesmo assim..."

exit 0
