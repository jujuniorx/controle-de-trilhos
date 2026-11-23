import { describe, expect, it } from 'vitest';
import { motivoDoDia, separarObservacoes } from '@/lib/usina/periodo';

const DIAS = ['2026-11-20', '2026-11-21', '2026-11-22'];
const nada = () => true;

describe('motivo do dia sem produção', () => {
  it('reconhece só a palavra sozinha, sem ligar para maiúscula, acento ou ponto', () => {
    expect(motivoDoDia('Feriado')).toBe('Feriado');
    expect(motivoDoDia(' feriado. ')).toBe('Feriado');
    expect(motivoDoDia('SÁBADO')).toBe('Folga');
    expect(motivoDoDia('Domingo')).toBe('Folga');
    expect(motivoDoDia('Fim de semana')).toBe('Folga');
    expect(motivoDoDia('feriado, mas cortamos 10 barras')).toBeNull();
    expect(motivoDoDia('Barras cortadas 36 metros')).toBeNull();
  });
});

describe('observações de sexta a domingo', () => {
  it('geração da imagem: os motivos vão para o gráfico e sobra só a observação de verdade', () => {
    const r = separarObservacoes(
      [
        { data: '2026-11-20', rotulo: 'Equipe 1', texto: 'Barras cortadas 36 metros' },
        { data: '2026-11-20', rotulo: 'Equipe 2', texto: 'Feriado' },
        { data: '2026-11-20', rotulo: 'Equipe 3', texto: 'Feriado' },
        { data: '2026-11-21', rotulo: 'Equipe 1', texto: 'Sábado' },
        { data: '2026-11-21', rotulo: 'Equipe 2', texto: 'Sábado' },
        { data: '2026-11-21', rotulo: 'Equipe 3', texto: 'Sábado' },
        { data: '2026-11-22', rotulo: 'Equipe 1', texto: 'Domingo' },
        { data: '2026-11-22', rotulo: 'Equipe 2', texto: 'Domingo' },
        { data: '2026-11-22', rotulo: 'Equipe 3', texto: 'Domingo' },
      ],
      DIAS,
      nada,
    );
    expect(r.motivos).toEqual({ '2026-11-20': 'Feriado', '2026-11-21': 'Folga', '2026-11-22': 'Folga' });
    expect(r.linhas).toEqual(['Sex 20/11 · Equipe 1: Barras cortadas 36 metros']);
  });

  it('serra da imagem: W61 e W62 sem nada a mais, a caixa fica vazia', () => {
    const entradas = DIAS.flatMap((d, i) => ['W61', 'W62'].map((a) => ({ data: d, rotulo: a, texto: ['Feriado', 'Sábado', 'Domingo'][i]! })));
    const r = separarObservacoes(entradas, DIAS, nada);
    expect(r.linhas).toEqual([]);
    expect(Object.values(r.motivos)).toEqual(['Feriado', 'Folga', 'Folga']);
  });

  it('dia com produção não ganha etiqueta: o motivo continua na lista', () => {
    const r = separarObservacoes([{ data: '2026-11-20', rotulo: 'Equipe 2', texto: 'Feriado' }], DIAS, (d) => d !== '2026-11-20');
    expect(r.motivos).toEqual({});
    expect(r.linhas).toEqual(['Sex 20/11 · Equipe 2: Feriado']);
  });

  it('motivo diferente da maioria no mesmo dia continua na lista', () => {
    const r = separarObservacoes(
      [
        { data: '2026-11-20', rotulo: 'Equipe 1', texto: 'Feriado' },
        { data: '2026-11-20', rotulo: 'Equipe 2', texto: 'Feriado' },
        { data: '2026-11-20', rotulo: 'Equipe 3', texto: 'Folga' },
      ],
      DIAS,
      nada,
    );
    expect(r.motivos).toEqual({ '2026-11-20': 'Feriado' });
    expect(r.linhas).toEqual(['Sex 20/11 · Equipe 3: Folga']);
  });

  it('mesmo texto de várias equipes vira uma linha, e em dias seguidos vira faixa', () => {
    const r = separarObservacoes(
      [
        { data: '2026-11-21', rotulo: 'Equipe 2', texto: 'Chuva' },
        { data: '2026-11-21', rotulo: 'Equipe 3', texto: 'Chuva' },
        { data: '2026-11-22', rotulo: 'Equipe 2', texto: 'Chuva' },
        { data: '2026-11-22', rotulo: 'Equipe 3', texto: 'Chuva' },
        { data: '2026-11-21', rotulo: 'W61', texto: 'Serra quebrada' },
        { data: '2026-11-21', rotulo: 'W62', texto: 'Serra quebrada' },
      ],
      DIAS,
      () => false,
    );
    expect(r.linhas).toEqual(['Sáb 21 a Dom 22/11 · Equipes 2 e 3: Chuva', 'Sáb 21/11 · W61 e W62: Serra quebrada']);
  });

  it('observação do setor (sem rótulo) sai sem dois-pontos', () => {
    const r = separarObservacoes([{ data: '2026-11-20', texto: 'Falta de energia' }], DIAS, () => false);
    expect(r.linhas).toEqual(['Sex 20/11 · Falta de energia']);
  });
});
