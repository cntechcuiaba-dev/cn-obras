# Central CN Obras

**Problema:** o ministério CN Obras (manutenção da estrutura predial da igreja) não tem
gestão centralizada de demandas — solicitações se perdem, prazos não são acompanhados e
quem pede não recebe retorno de andamento.

**Solução:** um painel único onde qualquer pessoa abre uma solicitação por link público, a
liderança triagem e atribui, o executor de campo atualiza o status, e um painel de prazos
mostra em tempo real o que está vencido, vencendo ou em execução.

**Sucesso é:** nenhuma demanda esquecida sem alguém responsável e um prazo definido; quem
abriu a solicitação sabe em que pé ela está sem precisar perguntar.

## Quem usa

| Perfil | O que faz | Como entra |
|--------|-----------|------------|
| Liderança/Coordenação | Triagem, atribuição, prazos, prioridade, cancelamento, cadastro de recorrências | Clerk (e-mail + senha) |
| Executor de campo | Vê e executa só as demandas atribuídas a ele; atualiza status e anexa fotos | Clerk (e-mail + senha) |
| Solicitante | Abre demanda por link público | Sem login |

## Escopo v1
- Abertura pública de demanda (com foto opcional)
- Triagem com categoria, local, prioridade, prazo e executor
- Execução com mudança de status e fotos de antes/depois
- Painel de próximo movimento, com fórmula de risco calculada na leitura
- Manutenções recorrentes com geração automática por cron
- Comunicação via WhatsApp manual (link `wa.me` com template pré-preenchido)
- Histórico completo de cada demanda

## Fora do escopo v1
- Envio automático de WhatsApp via API — *custo e complexidade desnecessários no MVP; o
  link manual resolve sem integração*
- Notificação por e-mail — *o ministério já se comunica por WhatsApp; e-mail seria um canal
  a mais sem uso real*
- App nativo — *PWA cobre o uso em campo sem loja de aplicativos*

## Telas

| Tela | Função | Frequência de uso |
|------|--------|-------------------|
| Formulário público | Abrir demanda | Sob demanda, qualquer pessoa |
| Painel | Próximo movimento de quem está logado | Diária | liderança e executor |
| Triagem | Definir categoria, local, prioridade, prazo, executor | Diária — liderança |
| Detalhe da Demanda | Histórico, fotos, mudança de status | Diária — ambos perfis internos |
| Recorrências | Cadastro de manutenções periódicas | Ocasional — liderança |

## Integrações
- WhatsApp — mensagem de atualização de status — *link `wa.me` gerado no cliente, sem action
  nem API, copiado ou aberto manualmente pelo responsável*

## Stack
React + Vite + Tailwind (PWA) · Convex (backend, banco, tempo real, cron) · Clerk
(autenticação) · Vercel ou Netlify.
Vite em vez de Next.js: não há página pública que precise de SEO — só um formulário
acessado por link direto.

## Riscos
- **Executor sem hábito de atualizar status pelo sistema** (tende a voltar pro WhatsApp
  direto) — mitigar com atualização de status em 1 toque e checkpoint de teste no kickoff.
- **Formulário público sem validação forte vira porta de lixo** — testar cedo com entradas
  ruins (nome vazio, WhatsApp errado) antes de divulgar o link.
- **Geração de recorrência duplicada se o cron rodar mais de uma vez no dia** — o job deve
  ser idempotente (verificar se já gerou a demanda do período antes de criar outra).
