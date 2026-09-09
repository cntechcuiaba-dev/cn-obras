## Contexto
Painel de gestão de demandas de manutenção predial de igreja. Dois ambientes de uso muito
diferentes: liderança triando no escritório/celular, com calma; executor em campo, no
celular, muitas vezes sob luz direta de sol, com as mãos ocupadas entre uma tarefa e outra.
Um terceiro público, o solicitante, só vê uma tela pública simples, sem login.

## Telas

### Formulário público (abertura de demanda)
- Conteúdo: título, descrição, nome, WhatsApp, local (texto livre), foto opcional
- Ações: enviar solicitação
- Estado vazio: n/a (formulário em branco por padrão)
- Estado de carregamento: botão de envio com spinner inline; sem skeleton (não há dado a carregar)

### Painel (liderança e executor, tela inicial de ambos)
- Conteúdo: um card único no topo — o próximo movimento de quem está logado. Título da demanda, local, uma frase curta explicando por que esse item está ali (gerada da fórmula de risco, nunca escrita à mão), e o botão de ação principal do estado atual (executar, fazer triagem, cobrar orçamento, aprovar, avisar solicitante). Abaixo, no máximo três próximos itens em lista simples — só título e data, sem cor, sem selo. Numa seção separada e visualmente recuada, as demandas que aguardam terceiro: quem se destrava e a condição de retorno.
- Ações: agir no item principal (o botão muda com o estado); abrir qualquer item da lista de próximos; abrir "ver todas as demandas" (tela de consulta separada, não é a inicial).
- Estado vazio: "Nenhum movimento pendente agora" — sem ícone de alerta; é um estado bom, não uma falha de carregamento.
- Estado de carregamento: skeleton só do card principal (retângulo único); a lista de próximos e a seção de bloqueados aparecem depois, sem skeleton próprio.

Regras que valem só para esta tela:

Card principal nunca compete em cor com os itens da lista abaixo — ele é a única superfície com destaque; o resto é texto plano.
Nenhum contador, badge numérico ou soma aparece nesta tela em nenhum lugar.
Se o card principal mudar (por chegada de dado em tempo real) enquanto a pessoa está olhando, usar a transição sutil já prevista na instrução final do documento — nunca troca abrupta.
Liderança e executor usam o mesmo componente de tela; muda só a consulta que alimenta o card (liderança considera todas as demandas, executor só as suas — RF14i).

### Triagem (liderança)
- Conteúdo: lista de demandas "aberta"; ao abrir uma, formulário de categoria, local,
  prioridade, prazo, executor
- Ações: salvar triagem (move para "triada"), cancelar demanda
- Estado vazio: "Nenhuma demanda aguardando triagem"
- Estado de carregamento: skeleton de lista

### Detalhe da Demanda
- Conteúdo: dados da demanda, linha do tempo de histórico, fotos anexadas, link `wa.me`
  gerado para atualização
- Ações: mudar status, anexar foto, copiar/abrir link do WhatsApp
- Estado vazio: histórico com só o evento de criação
- Estado de carregamento: skeleton do cabeçalho + linha do tempo

### Recorrências (liderança)
- Conteúdo: lista de manutenções recorrentes com periodicidade e próxima geração
- Ações: cadastrar, editar, desativar
- Estado vazio: "Nenhuma manutenção recorrente cadastrada"
- Estado de carregamento: skeleton de lista

## Design System

- **Neutros (com temperatura, tema claro):**
  fundo `#F7F5F2` · superfície `#FFFFFF` · superfície elevada `#FCFAF7` · borda `#E4DFD8` ·
  texto secundário `#6B6459` · texto principal `#2B2621`
- **Acento (azul-petróleo dessaturado × 4 estados):**
  normal `#3D7A8C` · hover `#336A7A` · ativo `#2A5866` · sutil/fundo de badge `#E3EEF0`
- **Cores semânticas de status da demanda:**
  aberta `#8A94A6` / fundo `#EEF1F5` · triada `#3D7A8C` / fundo `#E3EEF0` ·
  em_execucao `#C9821A` / fundo `#FBEFDC` · aguardando `#B5643E` / fundo `#F6E9E2` ·
  concluida `#4C8B5B` / fundo `#E7F2E9` · cancelada `#9A968D` / fundo `#F1EFEB`
- **Cores de prioridade:** baixa = neutro · média `#C9821A` · alta `#C4453A` / fundo `#FBE6E4`
- **Cores de vencimento (Painel de Prazos):** vencida `#C4453A` · vencendo `#C9821A` · em dia = neutro
- **Tipografia:** Inter para títulos e corpo, IBM Plex Mono com `tabular-nums` para prazos
  e datas
- **Escala:** H1 32/40, H2 24/32, corpo 16/24, label 13/16 uppercase tracking 0.05em
- **Raio de borda:** 8px, aplicado consistentemente
- **Ícones:** Lucide
- **Densidade:** média — Painel de Prazos com linhas compactas para escaneio rápido; o
  resto (triagem, detalhe, recorrências) respira mais. Mobile do executor: toques grandes,
  alvo mínimo 56px.

## Telas de autenticação
Duas portas distintas:
- **Liderança e executor:** tela de login com e-mail e senha (componentes do Clerk,
  tematizados com o design system acima).
- **Solicitante:** sem login. Acesso direto ao formulário público — tela separada, limpa,
  só com o essencial e a identidade do CN Obras.

## Regras visuais
- Não use gradientes decorativos, glassmorphism, glow ou sombras coloridas.
- Não use emoji como ícone — use Lucide de forma consistente.
- Toda cor tem função semântica: status, prioridade e vencimento carregam cor; o resto é
  peso e espaço.
- Hierarquia por peso e espaço, não por cor.
- O prazo é o elemento mais importante de cada linha de demanda — maior contraste na linha.
- Contraste mínimo AA em todo texto.

## Instrução final
Gere todas as telas navegáveis e coerentes entre si. Os componentes (card de demanda, chip
de status, badge de prazo, cabeçalho) devem ser idênticos onde aparecem. Cubra o estado de
carregamento (skeleton) em toda tela com dados e uma transição sutil quando uma demanda
aparecer sozinha em tempo real. Use o design system como fonte única de verdade.
