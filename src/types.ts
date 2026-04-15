export type PaymentType = "mensal" | "provisorio" | "temporario";
export type PaymentStatus = "pago" | "pendente" | "atrasado";

export interface PaymentEntry {
  id: string;
  person: string;
  category: PaymentType;
  description: string;
  amount: number;
  dueDay: number;
  monthLabel: string;
  status: PaymentStatus;
  note?: string;
}
