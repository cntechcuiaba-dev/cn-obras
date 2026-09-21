// Endereço do formulário de abertura de demanda.
//
// Vive separado porque é o único endereço do sistema que sai daqui para fora:
// vai em cartaz, grupo de WhatsApp e boca a boca. "/nova" era curto demais e
// se confundia com o endereço do próprio app — quem recebia não sabia se ia
// cair no formulário ou numa tela de login.
export const ROTA_PUBLICA = "/solicitar";

// URL completa, para copiar e divulgar. Depende do navegador, então só é
// chamada em tela.
export function urlPublica(): string {
  return `${window.location.origin}${ROTA_PUBLICA}`;
}
