// Máscaras de digitação (telefone/WhatsApp e valores em R$).
// Datas usam <input type="date"> nativo, que já aplica sua própria máscara.

export function mascararTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);
  if (digitos.length <= 2) return ddd ? `(${ddd}` : "";
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (digitos.length <= 10) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

// Digitação "de trás para frente": os dígitos são sempre lidos como centavos.
export function mascararMoeda(valor: string): string {
  const digitos = valor.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digitos) return "";
  const centavos = digitos.padStart(3, "0");
  const inteiro = centavos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimal = centavos.slice(-2);
  return `${inteiro},${decimal}`;
}

export function valorMoedaParaNumero(valor: string): number {
  if (!valor) return 0;
  return Number(valor.replace(/\./g, "").replace(",", ".")) || 0;
}
