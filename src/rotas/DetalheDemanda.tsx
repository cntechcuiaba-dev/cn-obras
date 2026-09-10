import { useState, useEffect, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle2,
  Camera,
  MessageCircle,
  Copy,
  Target,
  SlidersHorizontal,
  Plus,
} from "lucide-react";
import {
  useDetalhe,
  useModelos,
  useMudarStatus,
  useAnexarFoto,
  useGerarUrl,
  useAtualizar,
  useExecutores,
  useEquipamentos,
  useRegistrarValorRecebido,
  useRegistrarCobranca,
  useAprovarOrcamento,
  useConsumosDaDemanda,
  useRegistrarConsumo,
  useHistoricoDePreco,
} from "../lib/dados";
import { DEMO } from "../lib/env";
import { DemandaView } from "../lib/tipos";

type OrigemCusto = "estoque" | "compra_direta" | "orcamento";
import { Carregando, StatusChip, PrazoBadge, PrioridadeChip } from "../components/ui";
import { MOTIVO_IMPEDIMENTO, MotivoImpedimento, Prioridade } from "../lib/labels";
import { formatarData, formatarDataHora, linkWhatsapp, preencherModelo } from "../lib/format";
import { mascararMoeda, valorMoedaParaNumero } from "../lib/mascaras";
import { mensagemErro } from "../lib/erros";

export default function DetalheDemanda() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agora = Date.now();
  const dados = useDetalhe(id);
  const modelos = useModelos();

  const mudarStatus = useMudarStatus();
  const anexarFoto = useAnexarFoto();
  const gerarUrl = useGerarUrl();

  const [motivo, setMotivo] = useState<MotivoImpedimento>("aguardando_material");
  const [mostrarPausa, setMostrarPausa] = useState(false);
  const [mostrarAjuste, setMostrarAjuste] = useState(false);
  const [mostrarConclusao, setMostrarConclusao] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // [E2] estado dos formulários de orçamento e custo
  const hoje = new Date().toISOString().slice(0, 10);
  const emTresDias = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const [orc, setOrc] = useState({
    fornecedor: "",
    solicitadoEm: hoje,
    cobrarEm: emTresDias,
    responsavelCobrancaId: "",
  });
  const [custoValor, setCustoValor] = useState("");
  const [custoOrigem, setCustoOrigem] = useState<OrigemCusto>("compra_direta");
  const executores = useExecutores();

  if (dados === undefined) return <Carregando />;
  if (dados === null)
    return (
      <p className="mx-auto max-w-3xl text-text-2">Demanda não encontrada.</p>
    );

  const d = dados.demanda;
  const podeAgir = dados.podeExecutar || dados.papel === "lideranca";

  // [E2] a parada por material/orçamento fica marcada no histórico com tipo
  // legível por máquina — é dele que sai a exigência de lançar o valor.
  const precisaLancarCusto =
    d.custo === undefined &&
    dados.historico.some(
      (h) =>
        h.tipo === "impedimento_aguardando_material" ||
        h.tipo === "impedimento_aguardando_orcamento",
    );

  async function acao(fn: () => Promise<unknown>) {
    setErro(null);
    try {
      await fn();
      setMostrarPausa(false);
      setMostrarConclusao(false);
      setConfirmado(false);
    } catch (err) {
      setErro(mensagemErro(err, "Erro."));
    }
  }

  async function enviarFoto(file: File, etiqueta: string) {
    if (DEMO) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await anexarFoto({ demandaId: d._id, etiqueta } as any);
      return;
    }
    const url = await gerarUrl();
    const res = await fetch(url as string, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await anexarFoto({ demandaId: d._id as any, storageId, etiqueta });
  }

  const modeloDoStatus = (modelos ?? []).find((m) => m.tipo === d.status);
  const linkZap = modeloDoStatus
    ? linkWhatsapp(
        d.solicitanteWhatsapp ?? "",
        preencherModelo(modeloDoStatus.texto, {
          demanda: d.titulo,
          prazo: d.prazo ? formatarData(d.prazo) : "a definir",
          local: d.localNome ?? d.localTextoOriginal ?? "",
          solicitante: d.solicitanteNome ?? "",
        }),
      )
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      <button
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{d.titulo}</h1>
            <p className="mt-1 text-text-2">{d.descricao}</p>
          </div>
          <PrazoBadge
            prazo={d.prazo}
            agora={agora}
            status={d.status}
            concluidaEm={d.concluidaEm}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusChip status={d.status} />
          <PrioridadeChip prioridade={d.prioridade} />
          {d.categoriaNome && <Meta>{d.categoriaNome}</Meta>}
          {(d.localNome || d.localTextoOriginal) && (
            <Meta>{d.localNome ?? d.localTextoOriginal}</Meta>
          )}
          {d.equipamentoNome && <Meta>Equipamento: {d.equipamentoNome}</Meta>}
          {d.responsavelNome && <Meta>Responsável: {d.responsavelNome}</Meta>}
          {d.equipeNomes && d.equipeNomes.length > 0 && (
            <Meta>Equipe: {d.equipeNomes.join(", ")}</Meta>
          )}
        </div>

        {d.resultadoEsperado && (
          <div className="mt-4 flex items-start gap-2 rounded bg-surface-raise p-3 text-sm">
            <Target className="mt-0.5 h-4 w-4 flex-none text-accent" />
            <div>
              <span className="font-semibold">Resultado esperado: </span>
              {d.resultadoEsperado}
            </div>
          </div>
        )}

        {d.status === "aguardando" && d.motivoImpedimento && (
          <p className="mt-3 rounded bg-st-aguardando-bg px-3 py-2 text-sm text-st-aguardando">
            Impedimento: {MOTIVO_IMPEDIMENTO[d.motivoImpedimento]}
            {d.impedimentoDesde && ` · desde ${formatarData(d.impedimentoDesde)}`}
          </p>
        )}

        {/* [E2] o compromisso do orçamento, visível: fornecedor, quando cobrar,
            quantas cobranças já foram, valor e aprovação */}
        {d.orcamento && (
          <BlocoOrcamento demanda={d} podeAgir={podeAgir} papel={dados.papel} onErro={setErro} />
        )}

        {d.custo && (
          <p className="mt-3 rounded bg-surface-raise px-3 py-2 text-sm">
            <span className="font-semibold">Custo lançado: </span>
            <span className="font-mono tnum">
              {d.custo.valor.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>{" "}
            <span className="text-text-2">({d.custo.origem.replace("_", " ")})</span>
          </p>
        )}

        {erro && (
          <p className="mt-3 rounded bg-pri-alta-bg px-3 py-2 text-sm text-pri-alta">
            {erro}
          </p>
        )}

        {/* Demanda ainda não triada: a ação executável é triar, e só a liderança faz. */}
        {d.status === "aberta" && dados.papel === "lideranca" && (
          <div className="mt-5 border-t border-border pt-5">
            <button
              className="btn-primary"
              onClick={() => navigate(`/triagem?demanda=${d._id}`)}
            >
              Triar esta demanda
            </button>
          </div>
        )}

        {/* RF08: liderança ajusta prazo, prioridade e responsável a qualquer momento.
            É também o que dá conteúdo ao movimento "Programar manutenção" (RF18b). */}
        {dados.papel === "lideranca" &&
          d.status !== "concluida" &&
          d.status !== "cancelada" &&
          d.status !== "aberta" && (
            <div className="mt-5 border-t border-border pt-5">
              <button
                className="btn-ghost"
                onClick={() => setMostrarAjuste((v) => !v)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {d.origemRecorrenciaId ? "Programar manutenção" : "Ajustar planejamento"}
              </button>
              {mostrarAjuste && (
                <PainelAjuste
                  demanda={d}
                  onPronto={() => setMostrarAjuste(false)}
                  onErro={setErro}
                />
              )}
            </div>
          )}

        {/* Ações de execução */}
        {podeAgir && d.status !== "concluida" && d.status !== "cancelada" && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
            {(d.status === "triada" || d.status === "aguardando") && (
              <button
                className="btn-primary"
                onClick={() =>
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  acao(() => mudarStatus({ demandaId: d._id as any, novoStatus: "em_execucao" }))
                }
              >
                <Play className="h-4 w-4" /> Iniciar
              </button>
            )}
            {d.status === "em_execucao" && (
              <button className="btn-ghost" onClick={() => setMostrarPausa((v) => !v)}>
                <Pause className="h-4 w-4" /> Pausar (impedimento)
              </button>
            )}
            {(d.status === "em_execucao" || d.status === "aguardando") && (
              <button
                className="btn-ghost"
                onClick={() => setMostrarConclusao((v) => !v)}
              >
                <CheckCircle2 className="h-4 w-4" /> Concluir
              </button>
            )}
            <label className="btn-ghost cursor-pointer">
              <Camera className="h-4 w-4" /> Foto
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void acao(() => enviarFoto(f, d.status === "concluida" ? "Depois" : "Antes"));
                }}
              />
            </label>
          </div>
        )}

        {/* Painel pausa: motivo obrigatório; orçamento exige os quatro campos */}
        {mostrarPausa && (
          <div className="mt-4 rounded border border-border p-4">
            <span className="label">Motivo do impedimento</span>
            <select
              className="input"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoImpedimento)}
            >
              {Object.entries(MOTIVO_IMPEDIMENTO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            {/* [E2] compromisso sem data e sem dono é o que produz demanda
                parada dez dias que ninguém explica */}
            {motivo === "aguardando_orcamento" && (
              <div className="mt-4 grid grid-cols-1 gap-3 rounded bg-surface-raise p-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="label">Fornecedor</span>
                  <input
                    className="input"
                    value={orc.fornecedor}
                    onChange={(e) => setOrc({ ...orc, fornecedor: e.target.value })}
                    placeholder="Quem vai orçar"
                  />
                </label>
                <label className="block">
                  <span className="label">Solicitado em</span>
                  <input
                    type="date"
                    className="input"
                    value={orc.solicitadoEm}
                    onChange={(e) => setOrc({ ...orc, solicitadoEm: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="label">Cobrar em</span>
                  <input
                    type="date"
                    className="input"
                    value={orc.cobrarEm}
                    onChange={(e) => setOrc({ ...orc, cobrarEm: e.target.value })}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="label">Responsável pela cobrança</span>
                  <select
                    className="input"
                    value={orc.responsavelCobrancaId}
                    onChange={(e) =>
                      setOrc({ ...orc, responsavelCobrancaId: e.target.value })
                    }
                  >
                    <option value="">Selecione</option>
                    {(executores ?? []).map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-text-2 sm:col-span-2">
                  Na data de cobrança o sistema devolve esta demanda ao painel de quem
                  cobra — ele cobra, não avisa.
                </p>
              </div>
            )}

            <button
              className="btn-primary mt-3"
              onClick={() =>
                acao(() =>
                  mudarStatus({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    demandaId: d._id as any,
                    novoStatus: "aguardando",
                    motivoImpedimento: motivo,
                    orcamento:
                      motivo === "aguardando_orcamento"
                        ? {
                            fornecedor: orc.fornecedor,
                            solicitadoEm: new Date(`${orc.solicitadoEm}T12:00:00`).getTime(),
                            cobrarEm: new Date(`${orc.cobrarEm}T12:00:00`).getTime(),
                            responsavelCobrancaId: orc.responsavelCobrancaId,
                          }
                        : undefined,
                  }),
                )
              }
            >
              Registrar impedimento
            </button>
          </div>
        )}

        {/* Painel conclusão: confirmar resultado */}
        {mostrarConclusao && (
          <div className="mt-4 rounded border border-border p-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
              />
              <span>
                Confirmo que o resultado esperado foi atingido
                {d.resultadoEsperado ? `: "${d.resultadoEsperado}"` : "."}
              </span>
            </label>
            {/* [E2] passou por material ou orçamento => valor obrigatório.
                Zero é resposta válida; vazio não é. */}
            {precisaLancarCusto && (
              <div className="mt-4 grid grid-cols-1 gap-3 rounded bg-surface-raise p-3 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Valor gasto (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input"
                    value={custoValor}
                    onChange={(e) => setCustoValor(mascararMoeda(e.target.value))}
                    placeholder="0,00"
                  />
                </label>
                <label className="block">
                  <span className="label">Origem</span>
                  <select
                    className="input"
                    value={custoOrigem}
                    onChange={(e) => setCustoOrigem(e.target.value as OrigemCusto)}
                  >
                    <option value="estoque">Estoque da igreja</option>
                    <option value="compra_direta">Compra direta</option>
                    <option value="orcamento">Orçamento</option>
                  </select>
                </label>
                <p className="text-xs text-text-2 sm:col-span-2">
                  Esta demanda passou por material ou orçamento. Zero é resposta válida —
                  vazio não é.
                </p>
              </div>
            )}

            <button
              className="btn-primary mt-3"
              disabled={!confirmado || (precisaLancarCusto && custoValor === "")}
              onClick={() =>
                acao(() =>
                  mudarStatus({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    demandaId: d._id as any,
                    novoStatus: "concluida",
                    resultadoConfirmado: true,
                    custo: precisaLancarCusto
                      ? { valor: valorMoedaParaNumero(custoValor), origem: custoOrigem }
                      : undefined,
                  }),
                )
              }
            >
              Concluir demanda
            </button>
          </div>
        )}

        {/* WhatsApp manual (RF22) */}
        {linkZap && d.solicitanteWhatsapp && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
            <a className="btn-primary" href={linkZap} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" /> Avisar solicitante (WhatsApp)
            </a>
            <button
              className="btn-ghost"
              onClick={() => navigator.clipboard.writeText(linkZap)}
            >
              <Copy className="h-4 w-4" /> Copiar link
            </button>
          </div>
        )}
      </div>

      {/* Fotos */}
      {dados.fotos.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 font-semibold">Fotos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {dados.fotos.map((f) => (
              <a key={f.id} href={f.url ?? "#"} target="_blank" rel="noreferrer">
                <img
                  src={f.url ?? ""}
                  alt="Foto da demanda"
                  className="aspect-square w-full rounded-lg border border-border object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* [E2] Material consumido — sem saldo, sem inventário (decisão explícita) */}
      <SecaoConsumos demandaId={d._id} podeAgir={podeAgir} />

      {/* Linha do tempo (RF25) */}
      <div className="mt-6">
        <h2 className="mb-3 font-semibold">Histórico</h2>
        <ol className="relative space-y-4 border-l border-border pl-5">
          {dados.historico.map((h) => (
            <li key={h._id} className="relative">
              <span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full bg-accent" />
              <p className="text-sm">{h.descricao}</p>
              <p className="text-xs text-text-2">
                {formatarDataHora(h._creationTime)}
                {!h.criadoPorClerkId && " · sistema"}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// [E2] Consumo de material — sem saldo, sem inventário. Registra só o que foi
// gasto nesta demanda; o histórico de preço por item é o que sobra sem saldo.
function SecaoConsumos({
  demandaId,
  podeAgir,
}: {
  demandaId: string;
  podeAgir: boolean;
}) {
  const consumos = useConsumosDaDemanda(demandaId);
  const registrar = useRegistrarConsumo();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [item, setItem] = useState("");
  const [itemBuscado, setItemBuscado] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("");
  const [origem, setOrigem] = useState<"estoque" | "compra">("compra");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // debounce simples: só consulta o preço anterior 400ms depois de parar de digitar
  useEffect(() => {
    const t = setTimeout(() => setItemBuscado(item), 400);
    return () => clearTimeout(t);
  }, [item]);
  const precosAnteriores = useHistoricoDePreco(itemBuscado);

  if (!podeAgir && (consumos === undefined || consumos.length === 0)) return null;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await registrar({
        demandaId,
        item,
        quantidade: Number(quantidade),
        valorUnitario: valorUnitario ? valorMoedaParaNumero(valorUnitario) : undefined,
        origem,
      });
      setItem("");
      setItemBuscado("");
      setQuantidade("1");
      setValorUnitario("");
      setMostrarForm(false);
    } catch (err) {
      setErro(mensagemErro(err, "Erro ao registrar."));
    } finally {
      setSalvando(false);
    }
  }

  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Materiais usados</h2>
        {podeAgir && !mostrarForm && (
          <button className="btn-ghost" onClick={() => setMostrarForm(true)}>
            <Plus className="h-4 w-4" /> Registrar consumo
          </button>
        )}
      </div>

      {consumos && consumos.length > 0 && (
        <div className="mb-3 space-y-2">
          {consumos.map((c) => (
            <div key={c._id} className="card flex items-center justify-between px-4 py-2 text-sm">
              <span>
                {c.quantidade}× {c.item}
                <span className="text-text-2">
                  {" "}
                  ({c.origem === "estoque" ? "estoque" : "compra"})
                </span>
              </span>
              {c.valorUnitario !== undefined && (
                <span className="font-mono tnum text-text-2">
                  {brl(c.valorUnitario)}/un
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {(!consumos || consumos.length === 0) && !mostrarForm && (
        <p className="text-sm text-text-2">Nenhum material registrado ainda.</p>
      )}

      {mostrarForm && (
        <form onSubmit={salvar} className="card space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">Item</span>
              <input
                className="input"
                placeholder="Ex: Disjuntor 20A"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                required
              />
              {/* [E2] "com o valor pago anteriormente pelo mesmo item exibido ao lado" */}
              {precosAnteriores && precosAnteriores.length > 0 && (
                <p className="mt-1 text-xs text-accent-active">
                  Última vez: {brl(precosAnteriores[0].valorUnitario)}/un em{" "}
                  {formatarData(precosAnteriores[0].quando)}
                  {precosAnteriores[0].origem === "estoque" ? " (estoque)" : " (compra)"}
                </p>
              )}
            </label>
            <label className="block">
              <span className="label">Quantidade</span>
              <input
                type="number"
                min={1}
                step="1"
                className="input"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="label">Valor unitário (opcional)</span>
              <input
                type="text"
                inputMode="decimal"
                className="input"
                placeholder="0,00"
                value={valorUnitario}
                onChange={(e) => setValorUnitario(mascararMoeda(e.target.value))}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Origem</span>
              <select
                className="input"
                value={origem}
                onChange={(e) => setOrigem(e.target.value as "estoque" | "compra")}
              >
                <option value="estoque">Estoque da igreja</option>
                <option value="compra">Compra</option>
              </select>
            </label>
          </div>
          {erro && <p className="text-xs text-pri-alta">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando ? "Salvando…" : "Registrar"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setMostrarForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// [E2] O compromisso do orçamento na tela: quem, quando cobrar, quantas cobranças,
// quanto veio e se foi aprovado.
function BlocoOrcamento({
  demanda,
  podeAgir,
  papel,
  onErro,
}: {
  demanda: DemandaView;
  podeAgir: boolean;
  papel: string;
  onErro: (m: string | null) => void;
}) {
  const o = demanda.orcamento!;
  const registrarValor = useRegistrarValorRecebido();
  const registrarCobranca = useRegistrarCobranca();
  const aprovar = useAprovarOrcamento();
  const [valor, setValor] = useState("");

  const cobrancaDevida = Date.now() >= o.cobrarEm && o.valorRecebido === undefined;
  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function tentar(fn: () => Promise<unknown>) {
    onErro(null);
    try {
      await fn();
    } catch (e) {
      onErro(mensagemErro(e, "Erro."));
    }
  }

  return (
    <div className="mt-4 rounded border border-border p-4">
      <p className="text-label uppercase text-text-2">Orçamento</p>
      <p className="mt-1 text-sm">
        <span className="font-semibold">{o.fornecedor}</span> · solicitado em{" "}
        {formatarData(o.solicitadoEm)} · cobrar em {formatarData(o.cobrarEm)}
        {o.cobrancasFeitas > 0 && ` · ${o.cobrancasFeitas} cobrança(s) feita(s)`}
      </p>

      {o.valorRecebido !== undefined && (
        <p className="mt-2 text-sm">
          Valor recebido:{" "}
          <span className="font-mono tnum font-semibold">{brl(o.valorRecebido)}</span>
          {o.aprovadoEm ? (
            <span className="ml-2 text-st-concluida">· aprovado</span>
          ) : (
            <span className="ml-2 text-st-execucao">· aguardando aprovação</span>
          )}
        </p>
      )}

      {podeAgir && o.valorRecebido === undefined && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="label">Valor recebido (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              className="input max-w-[160px]"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(mascararMoeda(e.target.value))}
            />
          </label>
          <button
            className="btn-primary"
            disabled={valor === ""}
            onClick={() =>
              tentar(() =>
                registrarValor({ demandaId: demanda._id, valor: valorMoedaParaNumero(valor) }),
              )
            }
          >
            Registrar orçamento
          </button>
          {cobrancaDevida && (
            <button
              className="btn-ghost"
              onClick={() =>
                tentar(() =>
                  registrarCobranca({
                    demandaId: demanda._id,
                    proximaCobrancaEm: Date.now() + 3 * 86_400_000,
                  }),
                )
              }
            >
              Cobrei — reagendar em 3 dias
            </button>
          )}
        </div>
      )}

      {papel === "lideranca" && o.valorRecebido !== undefined && !o.aprovadoEm && (
        <button
          className="btn-primary mt-3"
          onClick={() => tentar(() => aprovar({ demandaId: demanda._id }))}
        >
          Aprovar orçamento
        </button>
      )}
    </div>
  );
}

// RF08: ajuste do planejamento pela liderança — prazo, prioridade e responsável.
function PainelAjuste({
  demanda,
  onPronto,
  onErro,
}: {
  demanda: DemandaView;
  onPronto: () => void;
  onErro: (m: string | null) => void;
}) {
  const atualizar = useAtualizar();
  const executores = useExecutores();
  const equipamentos = useEquipamentos();

  const [prazo, setPrazo] = useState(
    demanda.prazo ? new Date(demanda.prazo).toISOString().slice(0, 10) : "",
  );
  const [prioridade, setPrioridade] = useState<Prioridade>(
    demanda.prioridade ?? "media",
  );
  const [responsavelId, setResponsavelId] = useState(demanda.responsavelId ?? "");
  const [equipamentoId, setEquipamentoId] = useState(demanda.equipamentoId ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    onErro(null);
    setSalvando(true);
    try {
      await atualizar({
        demandaId: demanda._id,
        prazo: prazo ? new Date(`${prazo}T23:59:59`).getTime() : undefined,
        prioridade,
        responsavelId: responsavelId || undefined,
        // omitido = não mexe; null = desvincula; string = novo id — só manda
        // quando o valor de fato mudou, senão todo "Salvar" geraria um evento à toa.
        equipamentoId:
          equipamentoId === (demanda.equipamentoId ?? "")
            ? undefined
            : equipamentoId || null,
      });
      onPronto();
    } catch (err) {
      onErro(mensagemErro(err, "Erro ao ajustar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-4 rounded border border-border p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="label">Prazo</span>
          <input
            type="date"
            className="input"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Prioridade</span>
          <select
            className="input"
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as Prioridade)}
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Responsável</span>
          <select
            className="input"
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
          >
            {(executores ?? []).map((u) => (
              <option key={u._id} value={u._id}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Equipamento</span>
          <select
            className="input"
            value={equipamentoId}
            onChange={(e) => setEquipamentoId(e.target.value)}
          >
            <option value="">Nenhum</option>
            {(equipamentos ?? []).map((eq) => (
              <option key={eq._id} value={eq._id}>
                {eq.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="btn-primary mt-4" disabled={salvando} onClick={salvar}>
        {salvando ? "Salvando…" : "Salvar planejamento"}
      </button>
    </div>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-bg px-2.5 py-1 text-xs text-text-2">{children}</span>
  );
}
