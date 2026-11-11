'use client';

import { useRef, useState } from 'react';

type Props = {
  perfis: readonly string[];
  fabricantes: readonly string[];
  perfilSalvo: string;
  fabricanteSalvo: string;
  horas: string[];
};

/** Hora atual em Sao Paulo, dentro do expediente (primeira hora se o dia for outro ou fora do horario). */
function horaDaTroca(horas: string[], dataSelecionada: string): string {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  if (dataSelecionada !== hoje) return horas[0];
  const h = Number(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).slice(0, 2));
  const alvo = `${String(h).padStart(2, '0')}:00`;
  if (horas.includes(alvo)) return alvo;
  return alvo < horas[0] ? horas[0] : horas[horas.length - 1];
}

/**
 * Trilho e fabricante do topo da Produção. Podem mudar durante o dia: ao trocar um valor,
 * o sistema pede confirmação e registra a hora da troca (a troca vale dali em diante).
 */
export function TrocaTopo({ perfis, fabricantes, perfilSalvo, fabricanteSalvo, horas }: Props) {
  const [perfil, setPerfil] = useState(perfilSalvo);
  const [fabricante, setFabricante] = useState(fabricanteSalvo);
  const [horaPerfil, setHoraPerfil] = useState('');
  const [horaFabricante, setHoraFabricante] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  function dataDoForm(): string {
    const campo = document.getElementById('data') as HTMLInputElement | null;
    return campo?.value ?? '';
  }

  function trocar(
    campo: 'perfil' | 'fabricante',
    novo: string,
    anterior: string,
    salvo: string,
    setValor: (v: string) => void,
    setHora: (v: string) => void,
    horaAtual: string,
    rotulo: string,
  ) {
    if (novo === anterior) return;
    if (novo === salvo) {
      // Voltou ao que estava salvo: nao ha troca a registrar.
      setValor(novo);
      setHora('');
      return;
    }
    const hora = horaAtual || horaDaTroca(horas, dataDoForm());
    const ok = window.confirm(
      `Trocar ${rotulo} de ${salvo} para ${novo} a partir das ${hora}?\n\nAs horas anteriores continuam com o valor que estava registrado.`,
    );
    if (!ok) {
      // Desfaz a escolha na tela (o select volta ao valor anterior).
      const el = formRef.current?.querySelector<HTMLSelectElement>(`select[name="${campo}"]`);
      if (el) el.value = anterior;
      return;
    }
    setValor(novo);
    setHora(hora);
  }

  return (
    <div ref={formRef} className="contents">
      <div className="field">
        <label htmlFor="perfil">Trilho (perfil)</label>
        <select
          id="perfil"
          name="perfil"
          value={perfil}
          onChange={(e) => trocar('perfil', e.target.value, perfil, perfilSalvo, setPerfil, setHoraPerfil, horaPerfil, 'o trilho')}
          className="h-11"
        >
          {perfis.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input type="hidden" name="hora_troca_perfil" value={horaPerfil} />
      </div>
      <div className="field">
        <label htmlFor="fabricante">Fabricante</label>
        <select
          id="fabricante"
          name="fabricante"
          value={fabricante}
          onChange={(e) => trocar('fabricante', e.target.value, fabricante, fabricanteSalvo, setFabricante, setHoraFabricante, horaFabricante, 'o fabricante')}
          className="h-11"
        >
          {fabricantes.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <input type="hidden" name="hora_troca_fabricante" value={horaFabricante} />
      </div>
    </div>
  );
}
