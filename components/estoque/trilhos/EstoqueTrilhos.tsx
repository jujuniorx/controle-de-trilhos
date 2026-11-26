import { cookies } from 'next/headers';
import { FormularioUsina } from '@/components/usina/FormularioUsina';
import { IconeBaixar } from '@/components/icones/Icones';
import { ajustarSaldoTrilhoAction, carregarSaldoInicialAction } from '@/app/admin/(protegido)/estoque/trilhos-actions';
import { montarEstoqueTrilhos } from '@/lib/services/estoqueTrilhos';
import { ORDEM_PERFIS } from '@/lib/estoque/trilhos';
import { conferenciaSap } from '@/lib/estoque/visao';
import { ChaveVista } from './ChaveVista';
import { DetalhadoTrilhos, type AbaDetalhado, type ModoTabela } from './DetalhadoTrilhos';
import { ResumoTrilhos } from './ResumoTrilhos';
import { COOKIE_VISTA_TRILHOS, dataHoraBr, fmt, hojeSP } from './formato';

const ehData = (v?: string) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? '');

export interface ParamsTrilhos {
  vista?: string;
  aba?: string;
  modo?: string;
  de?: string;
  ate?: string;
}

function FormAjuste() {
  return (
    <details className="etr-ajuste">
      <summary className="btn btn-ghost h-11">Ajustar saldo</summary>
      <div className="etr-ajuste-corpo">
        <p className="mb-3 text-sm text-ink-muted">Para contagem física ou correção. Fica no histórico com o seu nome e o motivo.</p>
        <FormularioUsina acao={ajustarSaldoTrilhoAction} rotuloBotao="Salvar ajuste">
          <div className="etr-grade-form">
            <div className="field">
              <label htmlFor="aj-secao">Seção</label>
              <select id="aj-secao" name="secao" className="h-11" defaultValue="NOVO">
                <option value="NOVO">Novo</option>
                <option value="REEMPREGO">Reemprego</option>
                <option value="SUCATA">Sucata</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="aj-perfil">Perfil</label>
              <select id="aj-perfil" name="perfil" className="h-11" defaultValue="TR68">
                {ORDEM_PERFIS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="aj-tipo">Tipo (novo)</label>
              <select id="aj-tipo" name="tipo" className="h-11" defaultValue="LISA">
                <option value="TLS">TLS</option>
                <option value="LISA">Barra lisa</option>
                <option value="TALA">Tala (com furos)</option>
                <option value="CURTA12">Curta 12 m</option>
                <option value="MENOR12">Menor de 12 m</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="aj-fab">Fabricante (novo)</label>
              <select id="aj-fab" name="fabricante" className="h-11" defaultValue="PANGANG">
                <option value="NIPPON">Nippon</option>
                <option value="EVRAZ">Evraz</option>
                <option value="PANGANG">Pangang</option>
                <option value="ARCELORMITTAL">Arcelormittal</option>
                <option value="UHCX">UHCX</option>
                <option value="DIVERSOS">Diversos</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="aj-classe">Classificação</label>
              <select id="aj-classe" name="classe" className="h-11" defaultValue="NORMAL">
                <optgroup label="Novo">
                  <option value="NORMAL">Novo</option>
                  <option value="21M">Novo 21 metros</option>
                  <option value="TORCIDO">Torcido</option>
                  <option value="TESTE">Trilho teste</option>
                </optgroup>
                <optgroup label="Reemprego">
                  <option value="G1">G1</option>
                  <option value="G2">G2</option>
                  <option value="G3">G3</option>
                  <option value="TLS">TLS de reemprego</option>
                </optgroup>
                <optgroup label="Sucata">
                  <option value="SC1">SC-1 longas</option>
                  <option value="SC2">SC-2 curtas</option>
                  <option value="SC3">SC-3 tocos</option>
                </optgroup>
              </select>
            </div>
            <div className="field">
              <label htmlFor="aj-direcao">Entra ou sai</label>
              <select id="aj-direcao" name="direcao" className="h-11" defaultValue="ENTRA">
                <option value="ENTRA">Entra no estoque</option>
                <option value="SAI">Sai do estoque</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="aj-qtd">Quantidade (metros; TLS em unidades)</label>
              <input id="aj-qtd" name="quantidade" inputMode="decimal" className="h-11" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="aj-motivo">Motivo</label>
            <input id="aj-motivo" name="motivo" className="h-11" placeholder="Ex.: contagem física de 28/11" required />
          </div>
        </FormularioUsina>
      </div>
    </details>
  );
}

/** Aba Trilhos do Estoque: resumo (abre primeiro) e detalhado (como a planilha). */
export async function EstoqueTrilhos({ params }: { params: ParamsTrilhos }) {
  const guardada = (await cookies()).get(COOKIE_VISTA_TRILHOS)?.value;
  const vista = (params.vista ?? guardada) === 'detalhado' ? 'detalhado' : 'resumo';
  const estoque = await montarEstoqueTrilhos();

  if (!estoque.temSaldoInicial) {
    return (
      <div className="etr">
        <div className="etr-cab">
          <h1 className="etr-titulo">Estoque de trilhos</h1>
        </div>
        <div className="etr-caixa space-y-3">
          <p className="font-semibold">O saldo inicial ainda não foi carregado.</p>
          <p className="text-sm text-ink-muted">
            Ele vem da planilha &quot;Controle de Estoque - 2026&quot; de 25/11/2026 (abas Estoque Novo e Reemprego e Estoque sucata). Depois disso, o estoque anda
            sozinho com vagões, caminhões, envios, Produção e trilheiros.
          </p>
          <form action={carregarSaldoInicialAction}>
            <button type="submit" className="btn btn-primary h-11">
              Carregar saldo da planilha de 25/11/2026
            </button>
          </form>
        </div>
      </div>
    );
  }

  const hoje = hojeSP();
  const de = ehData(params.de) ? params.de! : `${hoje.slice(0, 8)}01`;
  const ate = ehData(params.ate) ? params.ate! : hoje;
  const [ini, fim] = de <= ate ? [de, ate] : [ate, de];
  const aba: AbaDetalhado = (['novo', 'sucata', 'sap', 'movimentos'] as const).find((a) => a === params.aba) ?? 'novo';
  const modo: ModoTabela = params.modo === 'movimento' ? 'movimento' : 'saldo';
  const href = (troca: Record<string, string>) => {
    const p = new URLSearchParams({ area: 'area-trilhos', vista: 'detalhado', aba, modo, de: ini, ate: fim, ...troca });
    return `/admin/estoque?${p.toString()}`;
  };

  const sap = conferenciaSap(estoque.saldos, estoque.sap);
  const tlsSap = sap.filter((l) => l.tipo === 'TLS' && l.situacao !== 'sem-sap');
  const barrasDif = sap.filter((l) => l.tipo === 'BARRAS' && l.situacao === 'diferenca');

  return (
    <div className="etr">
      <div className="etr-cab">
        <div>
          <h1 className="etr-titulo">Estoque de trilhos</h1>
          <div className="etr-sub">
            {estoque.atualizadoEm && <span className="etr-atual">Atualizado em {dataHoraBr(estoque.atualizadoEm)}</span>}
            {vista === 'resumo' && tlsSap.length > 0 && (
              <span className={`etr-selo ${tlsSap.every((l) => l.situacao === 'bate') ? 'etr-selo-ok' : 'etr-selo-av'}`}>
                {tlsSap.every((l) => l.situacao === 'bate') ? 'TLS bate com o SAP' : 'TLS diferente do SAP'}
              </span>
            )}
            {vista === 'resumo' && barrasDif.length > 0 && (
              <a href={href({ aba: 'sap' })} className="etr-selo etr-selo-av">
                Barras: {barrasDif.map((l) => `${l.perfil} ${(l.diferenca ?? 0) > 0 ? '+' : '−'}${fmt(Math.abs(l.diferenca ?? 0))} t`).join(' e ')} em relação ao SAP
              </a>
            )}
            {vista === 'detalhado' && <span>Mesmas linhas, colunas e contas da planilha &quot;Controle de Estoque - 2026&quot;</span>}
          </div>
        </div>
        <div className="etr-acoes">
          <ChaveVista vista={vista} />
          <a href="/api/estoque/trilhos/pdf" className="btn btn-ghost h-11 inline-flex items-center gap-2">
            <IconeBaixar size={16} />
            Baixar PDF
          </a>
        </div>
      </div>
      <FormAjuste />
      {vista === 'resumo' ? (
        <ResumoTrilhos saldos={estoque.saldos} lancamentos={estoque.lancamentos} />
      ) : (
        <DetalhadoTrilhos saldos={estoque.saldos} lancamentos={estoque.lancamentos} sap={estoque.sap} aba={aba} modo={modo} de={ini} ate={fim} href={href} />
      )}
    </div>
  );
}
