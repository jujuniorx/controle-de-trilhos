'use client';

import Link from 'next/link';
import { sairSemSalvar } from './SetoresNav';

/** Troca de semana: anterior, próxima e um dia qualquer no calendário. Mantém o setor aberto. */
export function NavegacaoSemana({ data, setor, faixa, anterior, proxima, hoje }: { data: string; setor: string; faixa: string; anterior: string; proxima: string; hoje: string }) {
  const para = (d: string) => `/admin/usina?data=${d}&setor=${setor}`;
  return (
    <div className="semana-nav card">
      <div className="semana-nav-faixa">
        <Link href={para(anterior)} className="btn btn-ghost h-11" onClick={sairSemSalvar} aria-label="Semana anterior">←</Link>
        <div className="semana-nav-texto">
          <p className="kv-label">Semana</p>
          <p className="semana-nav-datas">{faixa}</p>
        </div>
        <Link href={para(proxima)} className="btn btn-ghost h-11" onClick={sairSemSalvar} aria-label="Próxima semana">→</Link>
      </div>
      <form method="get" className="semana-nav-ir" onSubmit={(e) => { if (document.querySelector('form[data-sujo="true"]') && !window.confirm('Há lançamentos que ainda não foram salvos. Sair sem salvar?')) e.preventDefault(); }}>
        <input type="hidden" name="setor" value={setor} />
        <label htmlFor="data" className="sr-only">Ir para a semana do dia</label>
        <input id="data" name="data" type="date" defaultValue={data} className="h-11" />
        <button type="submit" className="btn btn-ghost h-11">Ir</button>
        {data !== hoje && <Link href={para(hoje)} className="btn btn-ghost h-11" onClick={sairSemSalvar}>Hoje</Link>}
      </form>
    </div>
  );
}
