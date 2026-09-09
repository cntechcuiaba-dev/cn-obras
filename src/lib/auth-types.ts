export type Papel = "lideranca" | "executor";

export interface UsuarioAtual {
  _id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
}
