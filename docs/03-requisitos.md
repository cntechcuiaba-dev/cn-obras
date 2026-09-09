# Requisitos — Central CN Obras

## Requisitos Funcionais

Módulo: Abertura de Demanda (público)
RF01. O sistema deve permitir que qualquer pessoa abra uma demanda por um link público, sem login, informando título, descrição, nome, WhatsApp e local (texto livre).
RF02. O sistema deve permitir anexar ao menos uma foto na abertura, de forma opcional.
RF03. O sistema deve criar toda demanda nova com status "aberta" e registrar o evento no histórico.
RF04. O sistema deve exibir ao solicitante uma confirmação com um identificador da demanda ao concluir a abertura.

Módulo: Triagem (liderança)
RF05. O sistema deve listar as demandas com status "aberta" para triagem.
RF06. O sistema deve permitir à liderança definir categoria, local, prioridade, prazo, executor responsável e o resultado esperado (o que caracteriza a demanda como resolvida), movendo a demanda para "triada".
RF07. O sistema deve impedir mover uma demanda para "triada" sem prazo e executor definidos.
RF08. O sistema deve permitir à liderança reatribuir executor, alterar prazo/prioridade e cancelar uma demanda a qualquer momento.

Módulo: Execução (executor)
RF09. O sistema deve exibir a cada executor apenas as demandas atribuídas a ele.
RF10. O sistema deve permitir ao executor mudar o status entre "em_execucao", "aguardando" e "concluida". Ao mover para "aguardando", deve exigir um motivo de impedimento de uma lista fechada (aguardando aprovação, material, terceiro, orçamento ou decisão), registrado no momento da parada — não no encerramento.
RF11. O sistema deve permitir ao executor anexar fotos à demanda (antes/depois).
RF12. Ao concluir uma demanda, o sistema deve exigir que o executor confirme se o resultado esperado (definido na triagem) foi atingido, e então registrar a data de conclusão e o evento no histórico. Não deve permitir mover para "concluida" sem essa confirmação.
RF13. O sistema deve impedir que um executor leia ou altere demanda que não está atribuída a ele.

## Módulo: Painel (ver E3 da emenda — revoga RF14 original)
RF14. O sistema deve exibir um painel com as demandas agrupadas em vencidas, vencendo (dentro de N dias) e em execução, ordenadas por risco de vencimento e, dentro do mesmo nível de risco, por prioridade, atualizando em tempo real.
RF15. O sistema deve calcular o estado de vencimento na leitura, comparando o prazo com a data atual, sem depender de rotina agendada.
RF16. O sistema deve destacar visualmente o prazo quando vencido, tanto
no item principal do painel quanto na lista de próximos.

Módulo: Manutenções Recorrentes
RF17. O sistema deve permitir à liderança cadastrar manutenções recorrentes com título, descrição, categoria, local, executor padrão, periodicidade (mensal a anual) e prazo em dias.
RF18. O sistema deve gerar automaticamente, uma vez por dia via cron, uma nova demanda para cada manutenção recorrente ativa cujo período tenha vencido, com status "triada" (já com categoria, local, executor e prazo herdados).
RF19. O sistema deve impedir gerar mais de uma demanda para a mesma manutenção recorrente no mesmo período (job idempotente).
RF20. O sistema deve permitir à liderança editar ou desativar uma manutenção recorrente a qualquer momento, sem afetar demandas já geradas.

Módulo: Comunicação (WhatsApp manual)
RF21. O sistema deve permitir cadastrar modelos de mensagem pré-configurados por tipo de atualização (em execução, aguardando, concluída).
RF22. O sistema deve gerar um link `wa.me` com o modelo de mensagem preenchido com os dados da demanda, para o responsável abrir e enviar manualmente.
RF23. O sistema não deve enviar mensagens automaticamente nem integrar com API de WhatsApp.

> Nota (auditoria Trino v2): o retorno automático ao solicitante — persona AUSENTE, cujo valor prometido no blueprint é "saber em que pé está sem perguntar" — permanece fora de escopo por decisão de produto (RF23; blueprint). Hoje ele só é alcançado por WhatsApp manual. Reabrir essa decisão (adicionar um canal externo automático) exige o cliente — ver bloco PRECISA DO CLIENTE da auditoria. As correções deste ciclo cobrem a avaliação de risco *dentro do app* (RF30), não o disparo externo.

Módulo: Histórico e Auditoria
RF24. O sistema deve registrar todo evento relevante da demanda (criação, triagem, mudança de status, foto anexada) com quem realizou e quando.
RF25. O sistema deve exibir a linha do tempo completa de eventos na tela de detalhe da demanda.

Módulo: Administração
RF26. O sistema deve permitir à liderança cadastrar, ativar e desativar categorias e locais.
RF27. O sistema deve permitir à liderança promover um usuário de executor para liderança.
RF28. O sistema deve criar todo novo usuário como "executor" no primeiro login, exigindo promoção manual da liderança para acesso total.

Módulo: Inteligência Operacional
RF29. O sistema deve oferecer à liderança uma visão que agrupe as demandas concluídas por categoria e por local ao longo do tempo, evidenciando recorrência (mesmo local ou categoria se repetindo) e o tempo médio entre abertura e conclusão — transformando o histórico em aprendizado, não apenas em consulta cronológica. Demandas geradas por recorrência devem ser identificáveis por `origemRecorrenciaId`.
RF30. Uma rotina automática diária deve avaliar as demandas ativas quanto a risco — vencidas, ou a vencer em N dias sem progresso desde a última mudança de status — e sinalizá-las de forma persistente (marcação `riscoSinalizadoEm` na demanda e evento no histórico), de modo que o risco exista mesmo que ninguém abra o Painel de Prazos. Complementa, não substitui, o cálculo em tempo real do RF15. A rotina deve ser idempotente (não repetir a sinalização de uma demanda já sinalizada).
RF31. A geração de uma demanda recorrente (RF18) e a sinalização de risco (RF30) devem produzir um evento visível para o executor responsável dentro do app — nunca uma alteração silenciosa.

## Requisitos Não-Funcionais

RNF01. Autenticação de liderança e executor via Clerk, com sessão persistente.
RNF02. Toda query e mutation deve verificar identidade antes de ler ou escrever; o Convex não possui RLS.
RNF03. O papel do usuário deve ser lido da tabela `usuarios`, nunca de claim do token.
RNF04. A abertura pública de demanda é a única mutation sem exigência de autenticação; toda outra função exposta exige identidade válida.
RNF05. Interface responsiva, com prioridade mobile para as telas do executor.
RNF06. Instalável como PWA.
RNF07. Painel de Prazos deve refletir mudanças em tempo real, sem necessidade de recarregar a página.
RNF08. Carregamento da tela inicial em menos de 2 segundos em 4G.
