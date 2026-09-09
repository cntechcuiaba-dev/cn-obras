# Mensagem-guia — colar como PRIMEIRA mensagem no Claude Code

> Pré-requisito: rode isto uma vez antes de colar (fora do Claude Code), com as contas já
> criadas: `npx convex dev` · integração Clerk↔Convex ativada ·
> `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://...` e tenha `VITE_CONVEX_URL` e
> `VITE_CLERK_PUBLISHABLE_KEY` no `.env.local`.

---

```
Você vai implementar o sistema Central CN Obras. Toda a especificação está na pasta docs/:

- docs/06-emenda-01.md            → Esta emenda vence os documentos 01 a 05 nos pontos que trata. Fora deles, o pacote original continua valendo integralmente.
- docs/04-kickoff-claude-code.md  → como implementar (schema, autorização, config, ordem)
- docs/03-requisitos.md           → requisitos funcionais e não-funcionais completos
- docs/02-schema-convex.md        → schema do Convex e regras de autorização
- docs/05-prototipo-visual.md     → design system e telas
- docs/01-blueprint.md            → visão geral (contexto, não precisa implementar daqui)

Leia docs/06 primeiro, depois docs/04 e docs/03 antes de começar. Onde o kickoff diz "[cole aqui...]", use o
conteúdo do documento indicado.

## Como quero que você trabalhe
- Siga a "Ordem de execução" do docs/04, um passo por vez. NÃO adiante passos.
- Ao terminar cada passo: rode o projeto, confirme que sobe SEM erro e me diga o que
  testar na tela. Só siga para o próximo passo quando eu confirmar.
- Faça um commit git a cada passo que subir sem erro, com mensagem clara
  (ex.: "passo 2: login Clerk + rota protegida"). Se um passo quebrar, quero poder voltar.
- Não me explique teoria; implemente. Só escreva texto quando for um checkpoint de teste.

## Seed inicial (peça isso já no passo 3)
2-3 categorias (ex.: Elétrica, Hidráulica, Estrutura), 2-3 locais (ex.: Templo, Salas de
aula, Estacionamento) e 1 modelo de mensagem por tipo (em_execucao, aguardando, concluida).

## Checkpoints obrigatórios
- Depois do passo 2: login pelo Clerk numa tela vazia tem que funcionar. Se não logar,
  pare aqui — nada adianta seguir.
- Depois do passo 5: abrir uma demanda pelo formulário público e vê-la
  aparecer no painel como próximo movimento, com a frase explicando por que
  é ela. Esse é o "funcionou" de verdade.

Se você tentar pular etapas ou "adiantar tudo", eu vou pedir para voltar. A ordem
(auth → schema → módulos) existe porque cada passo depende do anterior estar de pé.
```
