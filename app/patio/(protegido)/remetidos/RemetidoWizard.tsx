'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  CLASSIFICACOES_REEMPREGO_REMETIDO,
  TIPOS_REMETIDO,
  confirmacaoRemetidoSchema,
  lancamentoDiretoRemetidoSchema,
} from '@/lib/validation/remetido';
import { PERFIS, MARCAS, MARCA_LABEL, PLACA_REGEX, CLASSIFICACOES_SC } from '@/lib/validation/recebimento';
import { validarReemprego } from '@/lib/domain/regras';
import { confirmarRemetidoAction } from './[id]/confirmar/actions';
import { criarRemetidoDiretoAction } from './novo/actions';

const TIPO_REMETIDO_LABEL: Record<(typeof TIPOS_REMETIDO)[number], string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

type TipoMaterial = 'NOVO' | 'REEMPREGO' | 'SUCATA';
type ModoMedicao = 'INDIVIDUAL' | 'QTD_COMPRIMENTO';
type Marca = (typeof MARCAS)[number];
type Classificacao = (typeof CLASSIFICACOES_REEMPREGO_REMETIDO)[number];
type ClassificacaoSC = (typeof CLASSIFICACOES_SC)[number];

interface MedicaoLocal {
  clientId: string;
  modo: ModoMedicao;
  quantidade: number;
  comprimento: number;
  classificacaoSC?: ClassificacaoSC;
}

interface GrupoLocal {
  clientId: string;
  perfil: string;
  tipoMaterial: TipoMaterial;
  classificacao?: Classificacao;
  tampao: boolean;
  marca?: Marca;
  fabricanteOutro?: string;
  pesoInformado: string;
  medicoes: MedicaoLocal[];
}

interface Dados {
  data: string;
  numeroDocumento: string;
  placaCavalo: string;
  placaCarreta: string;
  transportadora: string;
  responsavelPatio: string;
}

function novoUuid(): string {
  return crypto.randomUUID();
}

function semInscricao(): () => void {
  return () => {};
}

function dataDeHojeLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function parseComprimento(texto: string): { valor?: number; erro?: string } {
  const t = texto.trim().replace(',', '.');
  if (!t) return { erro: 'Digite o comprimento, por exemplo 8,10.' };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { erro: 'Use números com até 2 casas decimais.' };
  const valor = Math.round(parseFloat(t) * 100) / 100;
  if (valor <= 0) return { erro: 'O comprimento precisa ser maior que zero.' };
  return { valor };
}

function metrosDoGrupo(g: GrupoLocal): number {
  return g.medicoes.reduce((acc, m) => acc + Math.round(m.quantidade * m.comprimento * 100) / 100, 0);
}

function validarDados(d: Dados) {
  const erros: Partial<Record<keyof Dados, string>> = {};
  if (!d.data) erros.data = 'Informe a data.';
  if (!PLACA_REGEX.test(d.placaCavalo) && !PLACA_REGEX.test(d.placaCarreta)) {
    erros.placaCavalo = 'Informe ao menos a placa do cavalo ou da carreta.';
  } else {
    if (d.placaCavalo && !PLACA_REGEX.test(d.placaCavalo)) erros.placaCavalo = 'Placa inválida. Ex.: ABC1D23';
    if (d.placaCarreta && !PLACA_REGEX.test(d.placaCarreta)) erros.placaCarreta = 'Placa inválida. Ex.: ABC1D23';
  }
  if (d.responsavelPatio.trim().length < 3) erros.responsavelPatio = 'Informe quem está preenchendo.';
  if (d.numeroDocumento && !/^\d{1,9}$/.test(d.numeroDocumento)) erros.numeroDocumento = 'Somente números.';
  return erros;
}

type TipoRemetido = (typeof TIPOS_REMETIDO)[number];

interface Identificacao {
  tipoRemetido: TipoRemetido | '';
  reservaPedido: string;
  destino: string;
}

function validarIdentificacao(i: Identificacao) {
  const erros: Partial<Record<keyof Identificacao, string>> = {};
  if (!i.tipoRemetido) erros.tipoRemetido = 'Selecione o tipo de remetido.';
  if (!i.reservaPedido.trim()) erros.reservaPedido = 'Informe a reserva/pedido.';
  if (!i.destino.trim()) erros.destino = 'Informe o destino.';
  return erros;
}

type Props =
  | { modo: 'novo' }
  | { modo: 'confirmar'; movimentacaoId: string; numeroDocumentoPreCadastrado: string | null };

export function RemetidoWizard(props: Props) {
  const router = useRouter();
  const numeroDocumentoPreCadastrado = props.modo === 'confirmar' ? props.numeroDocumentoPreCadastrado : null;
  const hoje = useSyncExternalStore(semInscricao, dataDeHojeLocal, () => '');
  const [dataTocada, setDataTocada] = useState(false);
  const [identificacao, setIdentificacao] = useState<Identificacao>({
    tipoRemetido: '',
    reservaPedido: '',
    destino: '',
  });
  const [dadosBrutos, setDados] = useState<Dados>({
    data: '',
    numeroDocumento: numeroDocumentoPreCadastrado ?? '',
    placaCavalo: '',
    placaCarreta: '',
    transportadora: '',
    responsavelPatio: '',
  });
  const [attemptSubmit, setAttemptSubmit] = useState(false);
  const [grupos, setGrupos] = useState<GrupoLocal[]>([]);
  const [activeGrupoId, setActiveGrupoId] = useState<string | null>(null);
  const [draftPerfil, setDraftPerfil] = useState('');
  const [draftTipo, setDraftTipo] = useState<TipoMaterial>('NOVO');
  const [draftMedicao, setDraftMedicao] = useState({ quantidade: '1', comprimento: '', sc: '' as ClassificacaoSC | '', erro: '' });
  const [modoDraft, setModoDraft] = useState<ModoMedicao>('INDIVIDUAL');
  const [enviando, setEnviando] = useState(false);
  const [erroFinal, setErroFinal] = useState('');

  const dados = useMemo<Dados>(
    () => (dataTocada ? dadosBrutos : { ...dadosBrutos, data: dadosBrutos.data || hoje }),
    [dadosBrutos, dataTocada, hoje],
  );
  const errosDados = attemptSubmit ? validarDados(dados) : {};
  const errosIdentificacao = attemptSubmit && props.modo === 'novo' ? validarIdentificacao(identificacao) : {};
  const grupoAtivo = grupos.find((g) => g.clientId === activeGrupoId) ?? null;

  const pesoTotal = useMemo(
    () => grupos.reduce((acc, g) => acc + (Number(g.pesoInformado.replace(',', '.')) || 0), 0),
    [grupos],
  );

  function adicionarGrupo() {
    if (!draftPerfil) return;
    const g: GrupoLocal = {
      clientId: novoUuid(),
      perfil: draftPerfil,
      tipoMaterial: draftTipo,
      tampao: false,
      pesoInformado: '',
      medicoes: [],
    };
    setGrupos((prev) => [...prev, g]);
    setActiveGrupoId(g.clientId);
    setDraftPerfil('');
  }

  function atualizarGrupo(id: string, patch: Partial<GrupoLocal>) {
    setGrupos((prev) => prev.map((g) => (g.clientId === id ? { ...g, ...patch } : g)));
  }

  function removerGrupo(id: string) {
    setGrupos((prev) => prev.filter((g) => g.clientId !== id));
    if (activeGrupoId === id) setActiveGrupoId(null);
  }

  function adicionarMedicao() {
    if (!grupoAtivo) return;
    const r = parseComprimento(draftMedicao.comprimento);
    if (r.erro || r.valor == null) {
      setDraftMedicao((d) => ({ ...d, erro: r.erro ?? '' }));
      return;
    }
    if (grupoAtivo.tipoMaterial === 'REEMPREGO' && !validarReemprego(r.valor)) {
      setDraftMedicao((d) => ({ ...d, erro: 'Medição de reemprego precisa ter ao menos 7 m.' }));
      return;
    }
    if (grupoAtivo.tipoMaterial === 'SUCATA' && !draftMedicao.sc) {
      setDraftMedicao((d) => ({ ...d, erro: 'Selecione a classificação SC1, SC2 ou SC3.' }));
      return;
    }
    const quantidade = modoDraft === 'QTD_COMPRIMENTO' ? Math.max(1, Number(draftMedicao.quantidade) || 1) : 1;
    const medicao: MedicaoLocal = {
      clientId: novoUuid(),
      modo: modoDraft,
      quantidade,
      comprimento: r.valor,
      classificacaoSC: grupoAtivo.tipoMaterial === 'SUCATA' ? (draftMedicao.sc as ClassificacaoSC) : undefined,
    };
    atualizarGrupo(grupoAtivo.clientId, { medicoes: [...grupoAtivo.medicoes, medicao] });
    setDraftMedicao({ quantidade: '1', comprimento: '', sc: '', erro: '' });
  }

  function removerMedicao(grupoId: string, medicaoClientId: string) {
    setGrupos((prev) =>
      prev.map((g) =>
        g.clientId === grupoId ? { ...g, medicoes: g.medicoes.filter((m) => m.clientId !== medicaoClientId) } : g,
      ),
    );
  }

  const grupoIncompleto = (g: GrupoLocal) =>
    g.medicoes.length === 0 ||
    !g.pesoInformado ||
    (g.tipoMaterial === 'REEMPREGO' && !g.classificacao) ||
    (g.tipoMaterial === 'NOVO' && g.marca === 'OUTROS' && !g.fabricanteOutro?.trim());

  const podeConfirmar = grupos.length > 0 && grupos.every((g) => !grupoIncompleto(g));

  async function confirmar() {
    setAttemptSubmit(true);
    setErroFinal('');
    if (Object.keys(validarDados(dados)).length > 0) return;
    if (props.modo === 'novo' && Object.keys(validarIdentificacao(identificacao)).length > 0) return;
    if (!podeConfirmar) {
      setErroFinal('Complete todos os grupos (medições, peso da NF e classificação) antes de confirmar.');
      return;
    }

    const dadosPayload = {
      ...dados,
      numeroDocumento: dados.numeroDocumento || undefined,
      placaCavalo: dados.placaCavalo || undefined,
      placaCarreta: dados.placaCarreta || undefined,
      transportadora: dados.transportadora || undefined,
    };
    const gruposPayload = grupos.map((g) => ({
      clientId: g.clientId,
      perfil: g.perfil,
      tipoMaterial: g.tipoMaterial,
      pesoInformado: Number(g.pesoInformado.replace(',', '.')),
      ...(g.tipoMaterial === 'REEMPREGO' ? { classificacao: g.classificacao, tampao: g.tampao } : {}),
      ...(g.tipoMaterial === 'NOVO'
        ? {
            ...(g.marca ? { marca: g.marca } : {}),
            ...(g.marca === 'OUTROS' ? { fabricanteOutro: g.fabricanteOutro || undefined } : {}),
          }
        : {}),
      medicoes: g.medicoes.map((m) => ({
        clientId: m.clientId,
        modo: m.modo,
        quantidade: m.quantidade,
        comprimento: m.comprimento,
        ...(g.tipoMaterial === 'SUCATA' ? { classificacaoSC: m.classificacaoSC } : {}),
      })),
    }));

    setEnviando(true);
    let resultado: { ok: boolean; erro?: string };

    if (props.modo === 'novo') {
      const parsed = lancamentoDiretoRemetidoSchema.safeParse({
        tipoRemetido: identificacao.tipoRemetido,
        reservaPedido: identificacao.reservaPedido,
        destino: identificacao.destino,
        dados: dadosPayload,
        grupos: gruposPayload,
      });
      if (!parsed.success) {
        setEnviando(false);
        setErroFinal('Dados inválidos. Revise os campos e tente novamente.');
        return;
      }
      resultado = await criarRemetidoDiretoAction(parsed.data);
    } else {
      const parsed = confirmacaoRemetidoSchema.safeParse({ dados: dadosPayload, grupos: gruposPayload });
      if (!parsed.success) {
        setEnviando(false);
        setErroFinal('Dados inválidos. Revise os campos e tente novamente.');
        return;
      }
      resultado = await confirmarRemetidoAction(props.movimentacaoId, parsed.data);
    }

    setEnviando(false);
    if (!resultado.ok) {
      setErroFinal(resultado.erro ?? 'Não foi possível salvar o remetido.');
      return;
    }
    router.push('/patio/remetidos');
  }

  return (
    <div className="mt-4 space-y-4">
      {props.modo === 'novo' && (
        <section className="space-y-3 rounded-lg border bg-white p-3">
          <h2 className="font-semibold text-neutral-800">Identificação do remetido</h2>
          <p className="text-sm text-neutral-600">Sem pré-cadastro — preencha o que normalmente vem do Administrativo.</p>
          <div>
            <label className="block text-sm font-medium" htmlFor="f-tipo-remetido">Tipo de remetido</label>
            <select
              id="f-tipo-remetido"
              className="mt-1 h-11 w-full rounded border px-3"
              value={identificacao.tipoRemetido}
              onChange={(e) => setIdentificacao({ ...identificacao, tipoRemetido: e.target.value as TipoRemetido })}
            >
              <option value="" disabled>Selecione</option>
              {TIPOS_REMETIDO.map((t) => (
                <option key={t} value={t}>{TIPO_REMETIDO_LABEL[t]}</option>
              ))}
            </select>
            {errosIdentificacao.tipoRemetido && <p className="text-sm text-red-600">{errosIdentificacao.tipoRemetido}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="f-reserva-pedido">Reserva/Pedido</label>
            <input
              id="f-reserva-pedido"
              className="mt-1 h-11 w-full rounded border px-3"
              value={identificacao.reservaPedido}
              onChange={(e) => setIdentificacao({ ...identificacao, reservaPedido: e.target.value })}
            />
            {errosIdentificacao.reservaPedido && <p className="text-sm text-red-600">{errosIdentificacao.reservaPedido}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="f-destino">Destino</label>
            <input
              id="f-destino"
              className="mt-1 h-11 w-full rounded border px-3"
              value={identificacao.destino}
              onChange={(e) => setIdentificacao({ ...identificacao, destino: e.target.value })}
            />
            {errosIdentificacao.destino && <p className="text-sm text-red-600">{errosIdentificacao.destino}</p>}
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-lg border bg-white p-3">
        <h2 className="font-semibold text-neutral-800">Dados da chegada</h2>
        <div>
          <label className="block text-sm font-medium" htmlFor="f-data">Data</label>
          <input
            id="f-data"
            type="date"
            className="mt-1 h-11 w-full rounded border px-3"
            value={dados.data}
            onChange={(e) => {
              setDataTocada(true);
              setDados({ ...dados, data: e.target.value });
            }}
          />
          {errosDados.data && <p className="text-sm text-red-600">{errosDados.data}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="f-nf">Nota fiscal {numeroDocumentoPreCadastrado ? '' : '(se já souber)'}</label>
          <input
            id="f-nf"
            inputMode="numeric"
            disabled={Boolean(numeroDocumentoPreCadastrado)}
            className="mt-1 h-11 w-full rounded border px-3 disabled:bg-neutral-100"
            value={dados.numeroDocumento}
            onChange={(e) => setDados({ ...dados, numeroDocumento: e.target.value.replace(/\D/g, '').slice(0, 9) })}
          />
          {errosDados.numeroDocumento && <p className="text-sm text-red-600">{errosDados.numeroDocumento}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium" htmlFor="f-cavalo">Placa do cavalo</label>
            <input
              id="f-cavalo"
              className="mt-1 h-11 w-full rounded border px-3 uppercase"
              value={dados.placaCavalo}
              onChange={(e) => setDados({ ...dados, placaCavalo: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="f-carreta">Placa da carreta</label>
            <input
              id="f-carreta"
              className="mt-1 h-11 w-full rounded border px-3 uppercase"
              value={dados.placaCarreta}
              onChange={(e) => setDados({ ...dados, placaCarreta: e.target.value.toUpperCase() })}
            />
          </div>
        </div>
        {errosDados.placaCavalo && <p className="text-sm text-red-600">{errosDados.placaCavalo}</p>}
        <div>
          <label className="block text-sm font-medium" htmlFor="f-transp">Transportadora</label>
          <input
            id="f-transp"
            className="mt-1 h-11 w-full rounded border px-3"
            value={dados.transportadora}
            onChange={(e) => setDados({ ...dados, transportadora: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="f-resp">Responsável (Pátio)</label>
          <input
            id="f-resp"
            className="mt-1 h-11 w-full rounded border px-3"
            value={dados.responsavelPatio}
            onChange={(e) => setDados({ ...dados, responsavelPatio: e.target.value })}
          />
          {errosDados.responsavelPatio && <p className="text-sm text-red-600">{errosDados.responsavelPatio}</p>}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-3">
        <h2 className="font-semibold text-neutral-800">Grupos</h2>
        {grupos.map((g) => (
          <div key={g.clientId} className="rounded border p-2">
            <div className="flex items-center justify-between">
              <b>
                {g.perfil} — {g.tipoMaterial}
                {g.tampao ? ' (Tampão)' : ''}
              </b>
              <button className="text-sm text-red-600" onClick={() => removerGrupo(g.clientId)}>
                Remover
              </button>
            </div>

            {g.tipoMaterial === 'NOVO' && (
              <div className="mt-2 flex gap-2">
                <select
                  className="h-10 flex-1 rounded border px-2"
                  value={g.marca ?? ''}
                  onChange={(e) => atualizarGrupo(g.clientId, { marca: (e.target.value || undefined) as Marca | undefined })}
                >
                  <option value="">Marca (opcional)</option>
                  {MARCAS.map((m) => (
                    <option key={m} value={m}>
                      {m === 'OUTROS' ? 'Outros' : MARCA_LABEL[m]}
                    </option>
                  ))}
                </select>
                {g.marca === 'OUTROS' && (
                  <input
                    className="h-10 flex-1 rounded border px-2"
                    placeholder="Nome do fabricante"
                    value={g.fabricanteOutro ?? ''}
                    onChange={(e) => atualizarGrupo(g.clientId, { fabricanteOutro: e.target.value })}
                  />
                )}
              </div>
            )}

            {g.tipoMaterial === 'REEMPREGO' && (
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={g.tampao}
                    onChange={(e) =>
                      atualizarGrupo(g.clientId, {
                        tampao: e.target.checked,
                        classificacao: e.target.checked && g.classificacao === 'G3' ? undefined : g.classificacao,
                      })
                    }
                  />
                  É tampão
                </label>
                <select
                  className="h-10 w-full rounded border px-2"
                  value={g.classificacao ?? ''}
                  onChange={(e) => atualizarGrupo(g.clientId, { classificacao: (e.target.value || undefined) as Classificacao | undefined })}
                >
                  <option value="">{g.tampao ? 'Classificação (G1 ou G2)' : 'Classificação'}</option>
                  {CLASSIFICACOES_REEMPREGO_REMETIDO.filter((c) => !g.tampao || c !== 'G3').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-2">
              <label className="block text-sm font-medium">Peso da NF (t) — para este grupo</label>
              <input
                inputMode="decimal"
                placeholder="Ex.: 12,500"
                className="mt-1 h-10 w-full rounded border px-2"
                value={g.pesoInformado}
                onChange={(e) => atualizarGrupo(g.clientId, { pesoInformado: e.target.value })}
              />
            </div>

            <div className="mt-2">
              <p className="text-sm text-neutral-600">{metrosDoGrupo(g).toFixed(2)} m lançados</p>
              <ol className="mt-1 divide-y rounded border text-sm">
                {g.medicoes.map((m) => (
                  <li key={m.clientId} className="flex items-center justify-between px-2 py-1">
                    <span>
                      {m.quantidade > 1 ? `${m.quantidade} × ${m.comprimento} m` : `${m.comprimento} m`}
                      {m.classificacaoSC ? ` — ${m.classificacaoSC}` : ''}
                    </span>
                    <button className="text-red-600" onClick={() => removerMedicao(g.clientId, m.clientId)}>
                      Remover
                    </button>
                  </li>
                ))}
              </ol>

              {activeGrupoId === g.clientId && (
                <div className="mt-2 rounded border p-2">
                  <div className="flex gap-2 text-sm">
                    <button
                      className={`rounded px-2 py-1 ${modoDraft === 'INDIVIDUAL' ? 'bg-steel text-white' : 'border'}`}
                      onClick={() => setModoDraft('INDIVIDUAL')}
                    >
                      Individual
                    </button>
                    <button
                      className={`rounded px-2 py-1 ${modoDraft === 'QTD_COMPRIMENTO' ? 'bg-steel text-white' : 'border'}`}
                      onClick={() => setModoDraft('QTD_COMPRIMENTO')}
                    >
                      Qtd × comprimento
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {modoDraft === 'QTD_COMPRIMENTO' && (
                      <input
                        inputMode="numeric"
                        className="h-10 w-16 rounded border px-2"
                        value={draftMedicao.quantidade}
                        onChange={(e) => setDraftMedicao((d) => ({ ...d, quantidade: e.target.value }))}
                      />
                    )}
                    <input
                      inputMode="decimal"
                      placeholder="Comprimento (m)"
                      className="h-10 flex-1 rounded border px-2"
                      value={draftMedicao.comprimento}
                      onChange={(e) => setDraftMedicao((d) => ({ ...d, comprimento: e.target.value, erro: '' }))}
                    />
                    {g.tipoMaterial === 'SUCATA' && (
                      <select
                        className="h-10 rounded border px-2"
                        value={draftMedicao.sc}
                        onChange={(e) => setDraftMedicao((d) => ({ ...d, sc: e.target.value as ClassificacaoSC | '' }))}
                      >
                        <option value="">SC</option>
                        {CLASSIFICACOES_SC.map((sc) => (
                          <option key={sc} value={sc}>
                            {sc}
                          </option>
                        ))}
                      </select>
                    )}
                    <button className="h-10 rounded bg-steel px-3 text-white" onClick={adicionarMedicao}>
                      Adicionar
                    </button>
                  </div>
                  {draftMedicao.erro && <p className="mt-1 text-sm text-red-600">{draftMedicao.erro}</p>}
                </div>
              )}
              {activeGrupoId !== g.clientId && (
                <button className="mt-2 text-sm text-blue-700 underline" onClick={() => setActiveGrupoId(g.clientId)}>
                  Lançar medidas
                </button>
              )}
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <select className="h-11 flex-1 rounded border px-2" value={draftPerfil} onChange={(e) => setDraftPerfil(e.target.value)}>
            <option value="">Perfil</option>
            {PERFIS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded border px-2"
            value={draftTipo}
            onChange={(e) => setDraftTipo(e.target.value as TipoMaterial)}
          >
            <option value="NOVO">NOVO</option>
            <option value="REEMPREGO">REEMPREGO</option>
            <option value="SUCATA">SUCATA</option>
          </select>
          <button className="h-11 rounded bg-steel px-3 text-white" onClick={adicionarGrupo} disabled={!draftPerfil}>
            Adicionar grupo
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-3">
        <p className="text-sm text-neutral-500">PESO TOTAL (soma das NFs dos grupos)</p>
        <p className="text-2xl font-semibold">{pesoTotal.toFixed(3)} t</p>
      </section>

      {erroFinal && <p role="alert" className="text-sm text-red-600">{erroFinal}</p>}
      <button
        className="h-12 w-full rounded bg-steel font-medium text-white disabled:bg-neutral-300"
        disabled={enviando}
        onClick={confirmar}
      >
        {enviando
          ? (props.modo === 'novo' ? 'Lançando...' : 'Confirmando...')
          : (props.modo === 'novo' ? 'Lançar remetido' : 'Confirmar chegada e salvar')}
      </button>
    </div>
  );
}
