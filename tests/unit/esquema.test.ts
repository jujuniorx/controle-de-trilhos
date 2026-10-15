import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMANDOS_ESQUEMA } from '@/lib/services/esquema';

const MIGRATIONS = ['20261015120000_perfil_toco', '20261015120100_lixeira_movimentacao', '20261015130000_role_portaria', '20261015130100_portaria', '20261015140000_chegada_caminhao', '20261015140100_observacao', '20261015150000_observacao_portaria'];

function normalizar(sql: string): string {
  return sql.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').replace(/ ,/g, ',').trim();
}

function comandosDoArquivo(nome: string): string[] {
  const sql = readFileSync(join(process.cwd(), 'prisma', 'migrations', nome, 'migration.sql'), 'utf8');
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(normalizar)
    .filter(Boolean);
}

describe('atualização do banco pela tela do dono', () => {
  it('todos os comandos podem rodar mais de uma vez', () => {
    for (const c of COMANDOS_ESQUEMA) expect(/IF NOT EXISTS/.test(c)).toBe(true);
  });
  it('as migrations em arquivo também (para o migrate deploy não conflitar depois)', () => {
    for (const m of MIGRATIONS) for (const c of comandosDoArquivo(m)) expect(/IF NOT EXISTS/.test(c)).toBe(true);
  });
  it('a lista em código é igual aos arquivos de migration, na mesma ordem', () => {
    const doArquivo = MIGRATIONS.flatMap(comandosDoArquivo);
    expect(COMANDOS_ESQUEMA.map(normalizar)).toEqual(doArquivo);
  });
});
