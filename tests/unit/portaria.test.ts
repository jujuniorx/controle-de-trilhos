import { describe, it, expect } from 'vitest';
import { cpfValido, dadosPortariaSchema } from '@/lib/validation/portaria';
import {
  estadoPortaria,
  motivoNaoPodeConfirmarSaida,
  motivoNaoPodeLiberar,
  motivoNaoPodeRegistrarChegada,
} from '@/lib/domain/portaria';
import { novoUsuarioSchema } from '@/lib/validation/usuario';

const base = {
  status: 'AGUARDANDO_CHEGADA',
  chegadaPortariaEm: null as Date | null,
  carretaLiberadaEm: null as Date | null,
  saidaPortariaEm: null as Date | null,
};
const chegou = { ...base, chegadaPortariaEm: new Date() };
const liberada = { ...chegou, carretaLiberadaEm: new Date() };

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
    expect(dadosPortariaSchema.safeParse({ motoristaCpf: '1234567' }).success).toBe(false);
    // dígitos verificadores NÃO são conferidos: qualquer CPF com 11 números passa
    expect(dadosPortariaSchema.safeParse({ motoristaCpf: '123.456.789-00' }).success).toBe(true);
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
  it('deriva o estado das datas: chegou → liberada pelo Pátio → saiu', () => {
    expect(estadoPortaria(base)).toBe('AGUARDANDO_CARRETA');
    expect(estadoPortaria(chegou)).toBe('CHEGOU');
    expect(estadoPortaria(liberada)).toBe('LIBERADA');
    expect(estadoPortaria({ ...liberada, saidaPortariaEm: new Date() })).toBe('SAIU');
  });
  it('remetido liberado pelo fluxo antigo (sem chegada) continua liberado', () => {
    expect(estadoPortaria({ ...base, carretaLiberadaEm: new Date() })).toBe('LIBERADA');
  });
});

describe('Portaria registra a chegada da carreta', () => {
  it('exige ao menos uma placa', () => {
    expect(motivoNaoPodeRegistrarChegada(base, null, undefined)).toMatch(/placa/);
  });
  it('registra com placa do cavalo OU da carreta', () => {
    expect(motivoNaoPodeRegistrarChegada(base, 'ABC1D23', null)).toBe(null);
    expect(motivoNaoPodeRegistrarChegada(base, null, 'XYZ9K87')).toBe(null);
  });
  it('não registra duas vezes nem depois da saída', () => {
    expect(motivoNaoPodeRegistrarChegada(chegou, 'ABC1D23', null)).toMatch(/já foi registrada/);
    expect(motivoNaoPodeRegistrarChegada({ ...liberada, saidaPortariaEm: new Date() }, 'ABC1D23', null)).toMatch(/já saiu/);
  });
});

describe('Pátio libera a carreta', () => {
  it('só depois que a carreta chegou', () => {
    expect(motivoNaoPodeLiberar(base)).toMatch(/ainda não chegou/);
    expect(motivoNaoPodeLiberar(chegou)).toBe(null);
  });
  it('não libera duas vezes nem depois da saída', () => {
    expect(motivoNaoPodeLiberar(liberada)).toMatch(/já foi liberada/);
    expect(motivoNaoPodeLiberar({ ...liberada, saidaPortariaEm: new Date() })).toMatch(/já saiu/);
  });
  it('libera mesmo depois que o Pátio confirmou o carregamento (status já mudou)', () => {
    expect(motivoNaoPodeLiberar({ ...chegou, status: 'PENDENTE_CONFERENCIA' })).toBe(null);
  });
});

describe('Portaria confirma a saída', () => {
  it('só depois que o Pátio liberou, e uma única vez', () => {
    expect(motivoNaoPodeConfirmarSaida(chegou)).toMatch(/ainda não liberou/);
    expect(motivoNaoPodeConfirmarSaida(liberada)).toBe(null);
    expect(motivoNaoPodeConfirmarSaida({ ...liberada, saidaPortariaEm: new Date() })).toMatch(/já foi confirmada/);
  });
});

describe('novoUsuarioSchema perfil', () => {
  it('aceita Portaria e recusa DONO', () => {
    expect(novoUsuarioSchema.parse({ nome: 'Rui', username: 'rui', senha: 'abcdefg1', perfil: 'PORTARIA' }).perfil).toBe('PORTARIA');
    expect(novoUsuarioSchema.safeParse({ nome: 'Rui', username: 'rui', senha: 'abcdefg1', perfil: 'DONO' }).success).toBe(false);
  });
});

import { estadoChegada, motivoNaoPodeConfirmarSaidaChegada, motivoNaoPodeLiberarChegada } from '@/lib/domain/portaria';
import { dadosChegadaSchema } from '@/lib/validation/chegada';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';

const chegada = { liberadaEm: null as Date | null, canceladaEm: null as Date | null, movimentacaoId: null as string | null, saidaEm: null as Date | null };

describe('chegada de caminhão (Recebimento)', () => {
  it('deriva o estado', () => {
    expect(estadoChegada(chegada)).toBe('AGUARDANDO_LIBERACAO');
    expect(estadoChegada({ ...chegada, liberadaEm: new Date() })).toBe('LIBERADA');
    expect(estadoChegada({ ...chegada, liberadaEm: new Date(), movimentacaoId: 'x' })).toBe('RECEBIDA');
    expect(estadoChegada({ ...chegada, liberadaEm: new Date(), canceladaEm: new Date() })).toBe('CANCELADA');
    expect(estadoChegada({ ...chegada, liberadaEm: new Date(), movimentacaoId: 'x', saidaEm: new Date() })).toBe('SAIU');
  });
  it('a saída só vale depois de descarregado, e uma única vez', () => {
    expect(motivoNaoPodeConfirmarSaidaChegada({ ...chegada, liberadaEm: new Date() })).toMatch(/ainda não terminou/);
    expect(motivoNaoPodeConfirmarSaidaChegada({ ...chegada, liberadaEm: new Date(), movimentacaoId: 'x' })).toBe(null);
    expect(motivoNaoPodeConfirmarSaidaChegada({ ...chegada, liberadaEm: new Date(), movimentacaoId: 'x', saidaEm: new Date() })).toMatch(/já foi confirmada/);
  });
  it('só registra a chegada com uma placa e uma única vez', () => {
    expect(motivoNaoPodeLiberarChegada(chegada, null, null)).toMatch(/placa/);
    expect(motivoNaoPodeLiberarChegada(chegada, 'ABC1D23', null)).toBe(null);
    expect(motivoNaoPodeLiberarChegada({ ...chegada, liberadaEm: new Date() }, 'ABC1D23', null)).toMatch(/já foi registrada/);
    expect(motivoNaoPodeLiberarChegada({ ...chegada, movimentacaoId: 'x' }, 'ABC1D23', null)).toMatch(/descarregou/);
    expect(motivoNaoPodeLiberarChegada({ ...chegada, canceladaEm: new Date() }, 'ABC1D23', null)).toMatch(/cancelada/);
  });
  it('o formulário da chegada não tem destino e aceita tudo em branco', () => {
    const r = dadosChegadaSchema.parse({ origem: '', placaCavalo: 'abc1d23', destino: 'IGNORADO' });
    expect(r.placaCavalo).toBe('ABC1D23');
    expect('destino' in r).toBe(false);
  });
});

describe('observação do Pátio e chegadaId no recebimento', () => {
  const base = {
    clientId: '11111111-1111-4111-8111-111111111111',
    dados: { data: '2026-10-15', origem: 'X', placaCavalo: 'ABC1D23', responsavelPatio: 'Eduardo', observacao: '  Dormente quebrado  ' },
    grupos: [
      {
        clientId: '22222222-2222-4222-8222-222222222222',
        perfil: 'TR57',
        tipoMaterial: 'SUCATA',
        medicoes: [{ clientId: '33333333-3333-4333-8333-333333333333', modo: 'INDIVIDUAL', quantidade: 1, comprimento: 12, classificacaoSC: 'SC1' }],
      },
    ],
  };
  it('guarda a observação aparada e o chegadaId', () => {
    const r = recebimentoCaminhaoSchema.parse({ ...base, chegadaId: 'abc123' });
    expect(r.dados.observacao).toBe('Dormente quebrado');
    expect(r.chegadaId).toBe('abc123');
  });
  it('observação é opcional e limitada a 500 caracteres', () => {
    expect(recebimentoCaminhaoSchema.safeParse({ ...base, dados: { ...base.dados, observacao: undefined } }).success).toBe(true);
    expect(recebimentoCaminhaoSchema.safeParse({ ...base, dados: { ...base.dados, observacao: 'a'.repeat(501) } }).success).toBe(false);
  });
});

describe('observação da Portaria', () => {
  it('é opcional, aparada e limitada a 500 caracteres', () => {
    expect(dadosPortariaSchema.parse({ observacao: '  lona rasgada  ' }).observacao).toBe('lona rasgada');
    expect(dadosPortariaSchema.parse({ observacao: '' }).observacao).toBe(undefined);
    expect(dadosPortariaSchema.safeParse({ observacao: 'a'.repeat(501) }).success).toBe(false);
    expect(dadosChegadaSchema.parse({ observacao: 'recado' }).observacao).toBe('recado');
  });
});

describe('Diversos no recebimento (sem medição)', () => {
  const dados = { data: '2026-10-15', origem: 'X', placaCavalo: 'ABC1D23', responsavelPatio: 'Eduardo' };
  const diversos = { clientId: '44444444-4444-4444-8444-444444444444', perfil: 'TOCO', tipoMaterial: 'SUCATA', medicoes: [] as unknown[] };
  const med = { clientId: '33333333-3333-4333-8333-333333333333', modo: 'INDIVIDUAL', quantidade: 1, comprimento: 12, classificacaoSC: 'SC1' };

  it('aceita o grupo Diversos sem nenhuma medição', () => {
    expect(recebimentoCaminhaoSchema.safeParse({ clientId: '11111111-1111-4111-8111-111111111111', dados, grupos: [diversos] }).success).toBe(true);
  });
  it('recusa medição dentro do Diversos', () => {
    expect(recebimentoCaminhaoSchema.safeParse({ clientId: '11111111-1111-4111-8111-111111111111', dados, grupos: [{ ...diversos, medicoes: [med] }] }).success).toBe(false);
  });
  it('sucata comum continua exigindo medição', () => {
    expect(recebimentoCaminhaoSchema.safeParse({ clientId: '11111111-1111-4111-8111-111111111111', dados, grupos: [{ ...diversos, perfil: 'TR57' }] }).success).toBe(false);
  });
});
