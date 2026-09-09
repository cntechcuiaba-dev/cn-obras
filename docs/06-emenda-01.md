# Emenda 01 — Central CN Obras

Set/2026 · normativa

**Precedência.** Esta emenda vence os documentos 01 a 05 nos pontos que
trata. Fora deles, o pacote original continua valendo integralmente.

Ordem de leitura para quem for implementar:
`06-emenda-01.md` → `03-requisitos.md` → `02-schema-convex.md` → `04-kickoff` → `05-prototipo`

---

## Por que esta emenda existe

O pacote original é sólido e já incorporou as correções da auditoria v2
(resultado esperado, impedimento com motivo durante a parada, confirmação
de resultado para concluir, rotina de risco independente de alguém abrir
a tela).

O que ele não resolveu foi o **RF14**. Ele pede um painel que agrupa
demandas em vencidas, vencendo e em execução. Isso é uma lista organizada,
não uma decisão. A construção de set/2026 implementou o RF14 exatamente
como escrito, e o resultado foi uma tela onde cinco itens disputam a mesma
urgência, três deles sem ação executável, e a mesma demanda aparecendo em
dois grupos com um aviso de "também aqui" para não parecer duplicata.

O defeito é do requisito, não da implementação.

Além disso, dois assuntos ficaram de fora do pacote e precisam entrar:
orçamento e custo, e a distinção entre responsável e equipe.

---

## E1. Solicitante — mantido como está

**Sem mudança em relação ao pacote.** O solicitante abre demanda por link
público, sem login (RF01 a RF04). Ele não tem conta nem acesso ao sistema.

O retorno continua manual por WhatsApp (RF21 a RF23). O que muda é só
isto: **o envio é manual, o lembrete não é.**

Toda mudança de status que interessa ao solicitante gera um registro de
aviso pendente, que aparece como movimento no painel do responsável com a
mensagem já montada e o link `wa.me` pronto. O movimento só desaparece
quando marcado como enviado.

Sem isso, o retorno depende de alguém lembrar — e o valor prometido no
blueprint ("saber em que pé está sem precisar perguntar") continua não
sendo entregue, que foi exatamente a ressalva da auditoria.

---

## E2. Orçamento e custo — novo

O tipo de demanda **não** decide se há orçamento. A cadeia decide:

```
Precisa de material?
├─ Não  → sem custo, sem orçamento.
└─ Sim  → tem no estoque da igreja?
          ├─ Sim → baixa registrada. Custo interno (pode ser zero).
          └─ Não → valor conhecido e compra direta?
                   ├─ Sim → gasto lançado na própria demanda.
                   └─ Não → orçamento solicitado ao fornecedor.
```

### O orçamento é um compromisso embutido na demanda

Não é entidade separada. É um bloco dentro da demanda, com a
característica que define compromisso: vence sozinho e ninguém trabalha
nele até a data chegar.

Reaproveita o estado `aguardando` que já existe, com o motivo
`aguardando_orcamento` que já está na lista fechada. **Nenhum estado
novo é criado.**

Campos obrigatórios juntos para entrar em `aguardando` com esse motivo:

- fornecedor
- data de solicitação
- data de cobrança (padrão: solicitação + 3 dias úteis)
- responsável pela cobrança

**Prevenção:** a mutation recusa a transição sem os quatro. Compromisso
sem data e sem dono é o que produz demanda parada dez dias que ninguém
explica.

**O sistema cobra, não avisa.** Na data de cobrança, a demanda volta ao
painel do responsável como movimento "cobrar o orçamento da [fornecedor]".
A mesma rotina diária do RF30 faz isso — não precisa de cron novo.

### Aprovação

Sem alçada por valor. Todo orçamento recebido gera movimento de aprovação
no painel da liderança, com o valor pago anteriormente pelo mesmo item
exibido ao lado.

### Custo realizado

**Prevenção:** demanda que passou por `aguardando` com motivo de material
ou orçamento não pode ser concluída sem valor lançado. Zero é resposta
válida; vazio não é.

### Estoque

**Não construir módulo de estoque.** Sem saldo, sem inventário, sem
entrada de compra. Registra-se apenas o consumo: qual item, quanto, em
qual demanda.

Saldo exige que todo mundo que tira material do armário alimente o
sistema. Ninguém faz isso, e saldo errado é pior que saldo nenhum — vira
o campo que o sistema lê para decidir e decide errado.

Sem saldo, o consumo registrado ainda entrega: frequência de troca por
item e local, histórico de preço pago (usado na aprovação de orçamento) e
sinal de recorrência.

Rever se o registro mostrar falta de material travando demandas com
frequência.

---

## E3. RF14 substituído — painel de um movimento

> **RF14 (revogado).** Painel agrupando demandas em vencidas, vencendo e
> em execução, ordenadas por risco e prioridade.

**RF14a.** O painel exibe **um** item: o próximo movimento de quem está
logado.

**RF14b.** Um item só entra no painel se essa pessoa pode agir agora.
Demanda bloqueada por terceiro sai do painel e vai para uma seção
separada, identificada, com quem destrava e a condição de retorno.

**RF14c.** A ordem sai de uma **única fórmula calculada na leitura**, a
partir de `prazo`, `prioridade` e `impedimentoDesde`. Nenhum campo de
prioridade calculada é gravado no banco. Foi o cache manual que fez o
painel antigo ordenar por ordem de inserção parecendo ordenar por
urgência.

**RF14d.** O item exibe **por que é ele** — uma frase gerada da fórmula,
não escrita à mão. Sem ela a ordem parece arbitrária e o usuário volta a
pedir a lista inteira.

**RF14e.** Abaixo do item, no máximo três próximos, em linha simples com
título e data. Sem cor, sem selo de prioridade, sem contador.

**RF14f.** Nenhum item aparece no painel sem ação executável. Card que só
informa é histórico.

**RF14g.** Status é estado único. Vencimento é propriedade derivada da
data, nunca um estado. Se a mesma demanda precisar aparecer em dois
lugares, o modelo está errado.

**RF14h.** Contadores, badges numéricos e totalizadores não entram no
painel. Nenhum deles muda o que a pessoa faz a seguir.

**RF14i.** Liderança tem acesso a todas as demandas; executor apenas às
suas. **Acesso não é painel** — os dois veem um item só, muda a fórmula.
"Todas as demandas" é tela de consulta separada, aberta por escolha,
nunca a tela inicial.

O RF15 (cálculo de vencimento na leitura), o RF16 e o RF30 (rotina de
risco) continuam valendo — passam a alimentar a fórmula do RF14c.

---

## E4. Responsável e equipe

Uma demanda pode ter equipe, mas o próximo movimento tem dono único.

- `responsavelId` — sempre um. Em cujo painel a demanda aparece.
- `equipeIds` — quem executa junto. Tem acesso de leitura e pode anexar
  foto e atualizar status. Não recebe o movimento.

O campo `executorId` do schema original passa a se chamar
`responsavelId`. O RF09 e o RF13 passam a considerar responsável **ou**
integrante da equipe para acesso.

Demanda designada a três pessoas sem responsável definido aparece em três
painéis e ninguém age.

---

## E5. Manutenções recorrentes — antecedência

O RF17 a RF20 continuam valendo. Uma correção de finalidade:

A recorrência não serve para criar a demanda no dia. Serve para **a
liderança se programar antes**. Demanda que nasce no dia do vencimento
não deu tempo de nada.

**RF18a.** Cada manutenção recorrente tem `antecedenciaDias`. A demanda é
gerada com essa antecedência, já triada, e o prazo é a data prevista da
manutenção.

**RF18b.** A geração produz um movimento no painel da liderança —
"programar [manutenção]" — não uma linha silenciosa numa lista.

Este é o compromisso mais puro do sistema: vence sozinho e ninguém
trabalha nele até chegar a data. É onde o princípio de lembrar pelo
usuário tem peso máximo.

---

## Mudanças no schema

Sobre `docs/02-schema-convex.md`. Nenhum estado novo; nenhuma tabela
removida.

### `demandas`

Renomear:
```
executorId  →  responsavelId
```

Acrescentar:
```ts
equipeIds: v.optional(v.array(v.id("usuarios"))),

orcamento: v.optional(v.object({
  fornecedor: v.string(),
  solicitadoEm: v.number(),
  cobrarEm: v.number(),
  responsavelCobrancaId: v.id("usuarios"),
  cobrancasFeitas: v.number(),
  valorRecebido: v.optional(v.number()),
  recebidoEm: v.optional(v.number()),
  aprovadoEm: v.optional(v.number()),
  aprovadoPorId: v.optional(v.id("usuarios")),
})),

custo: v.optional(v.object({
  valor: v.number(),
  origem: v.union(
    v.literal("estoque"),
    v.literal("compra_direta"),
    v.literal("orcamento"),
  ),
  lancadoEm: v.number(),
})),
```

Índice novo:
```ts
.index("by_cobranca", ["status", "orcamento.cobrarEm"])
```

### `consumos` — tabela nova

```ts
consumos: defineTable({
  demandaId: v.id("demandas"),
  item: v.string(),
  quantidade: v.number(),
  valorUnitario: v.optional(v.number()),
  origem: v.union(v.literal("estoque"), v.literal("compra")),
})
  .index("by_demanda", ["demandaId"])
  .index("by_item", ["item"]),
```

### `avisos` — tabela nova

```ts
avisos: defineTable({
  demandaId: v.id("demandas"),
  responsavelId: v.id("usuarios"),
  gatilho: v.string(),
  mensagem: v.string(),
  enviadoEm: v.optional(v.number()),
})
  .index("by_responsavel_pendente", ["responsavelId", "enviadoEm"])
  .index("by_demanda", ["demandaId"]),
```

### `manutencoesRecorrentes`

Acrescentar:
```ts
antecedenciaDias: v.number(),
```

### Autorização — acréscimos

```
· escrita do bloco orcamento (solicitar, registrar valor recebido):
  lideranca, ou o responsável da demanda
· aprovacaoEm / aprovadoPorId: só lideranca
· custo: lideranca ou responsável; obrigatório antes de concluir quando
  houve passagem por aguardando com motivo de material ou orçamento
· consumos: lideranca ou responsável da demanda
· avisos: criados só por mutation interna; marcados como enviados por
  quem é o responsável
· leitura de demanda: lideranca lê tudo; executor lê onde é responsável
  OU integra equipeIds
```

---

## Onde a trava mora

O Convex não expressa "campo obrigatório apenas neste estado". Todos os
blocos acima são opcionais no schema e obrigatórios nas mutations.

Consequência: **um único arquivo escreve `status`.** Se qualquer outra
mutation puder escrever esse campo, a máquina de estados deixa de existir
sem ninguém perceber.

Toda trava precisa de um teste que verifica **quem escreve e quem lê**.
Trava checada por duas funções e escrita por nenhuma é promessa sem
cumprimento — já aconteceu em produção no Frota 065.

---

## Pergunta de encerramento

**Que problema volta a existir sem esta emenda?** O painel volta a listar
tudo agrupado por vencimento, porque é isso que o RF14 original pede — e
gasto de material continua fora do sistema, decidido de memória.

**Que erro volta a ser possível?** Pedir orçamento sem data de cobrança e
sem dono; concluir demanda com compra feita e sem valor lançado; demanda
com três executores e nenhum responsável; manutenção recorrente
aparecendo no dia em que já era para estar pronta.
