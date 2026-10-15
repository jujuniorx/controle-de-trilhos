import { describe, it, expect } from 'vitest';
import { cpfValido, dadosPortariaSchema } from '@/lib/validation/portaria';
import { estadoPortaria, motivoNaoPodeLiberar } from '@/lib/domain/portaria';
import { novoUsuarioSchema } from '@/lib/validation/usuario';

const base = { status: 'AGUARDANDO_CHEGADA', medicaoConcluidaEm: null as Date | null, carretaLiberadaEm: null as Date | null };
const medido = { ...base, medicaoConcluidaEm: new Date() };

describe('dadosPortariaSchema', () => {
  it('aceita tudo em branco (nada é obrigatório ao salvar)', () => {
    const r = dadosPortariaSchema.parse({ transportadora: '', placaCavalo: '  ', motoristaCpf: '', capacidadeCarga: '' });
    expect(r.placaCavalo).toBe(undefined);
    expect(r.motoristaCpf).toBe(undefined);
    expect(r.capacidadeCarga).toBe(undefined);
  });
  it('normaliza placa, CPF, telefone e capacidade', () => {
    const r = dadosPortariaSchema.parse({
      placaCarreta: 'abc-1d23',
      motoristaCpf: '529.982.247-25',
      motoristaTelefone: '(14) 99876-5432',
      capacidadeCarga: '32,5',
    });
    expect(r).toMatchObject({ placaCarreta: 'ABC1D23', motoristaCpf: '52998224725', motoristaTelefone: '14998765432', capacidadeCarga: 32.5 });
  });
  it('recusa placa, CPF, telefone e capacidade inválidos', () => {
    expect(dadosPortariaSchema.safeParse({ placaCavalo: 'XX12' }).success).toBe(false);
    expect(dadosPortariaSchema.safeParse({ motoristaCpf: '111.111.111-11' }).success).toBe(false);
    expect(dadosPortariaSchema.safeParse({ motoristaTelefone: '12345' }).success).toBe(false);
    expect(dadosPortariaSchema.safeParse({ capacidadeCarga: '0' }).success).toBe(false);
    expect(dadosPortariaSchema.safeParse({ capacidadeCarga: '500' }).success).toBe(false);
  });
});

describe('cpfValido', () => {
  it('confere os dígitos verificadores', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('52998224726')).toBe(false);
  });
});

describe('estadoPortaria', () => {
  it('deriva o estado das datas', () => {
    expect(estadoPortaria(base)).toBe('MEDINDO');
    expect(estadoPortaria(medido)).toBe('AGUARDANDO_CARRETA');
    expect(estadoPortaria({ ...medido, carretaLiberadaEm: new Date() })).toBe('LIBERADA');
  });
});

describe('motivoNaoPodeLiberar', () => {
  it('exige medição concluída', () => {
    expect(motivoNaoPodeLiberar(base, 'ABC1D23', null)).toMatch(/medir/);
  });
  it('exige ao menos uma placa', () => {
    expect(motivoNaoPodeLiberar(medido, null, undefined)).toMatch(/placa/);
  });
  it('libera com placa do cavalo OU da carreta', () => {
    expect(motivoNaoPodeLiberar(medido, 'ABC1D23', null)).toBe(null);
    expect(motivoNaoPodeLiberar(medido, null, 'XYZ9K87')).toBe(null);
  });
  it('não libera duas vezes nem fora de "aguardando chegada"', () => {
    expect(motivoNaoPodeLiberar({ ...medido, carretaLiberadaEm: new Date() }, 'ABC1D23', null)).toMatch(/já foi liberada/);
    expect(motivoNaoPodeLiberar({ ...medido, status: 'PENDENTE_CONFERENCIA' }, 'ABC1D23', null)).toMatch(/aguardando chegada/);
  });
});

describe('novoUsuarioSchema perfil', () => {
  it('aceita Portaria e recusa DONO', () => {
    expect(novoUsuarioSchema.parse({ nome: 'Rui', username: 'rui', senha: 'abcdefg1', perfil: 'PORTARIA' }).perfil).toBe('PORTARIA');
    expect(novoUsuarioSchema.safeParse({ nome: 'Rui', username: 'rui', senha: 'abcdefg1', perfil: 'DONO' }).success).toBe(false);
  });
});
