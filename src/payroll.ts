import { PayrollContract } from "./contract";
import { ZKProofGenerator } from "./crypto/proofs";

interface Transaction {
  amount: bigint;
  [key: string]: unknown;
}

interface FilterCriteria {
  minAmount: bigint;
}

export class PayrollService {
  constructor(private contract: PayrollContract) {}

  async processPayment(recipient: string, amount: bigint): Promise<string> {
    const _proof = await ZKProofGenerator.generateProof({ recipient, amount });
    return this.contract.deposit(amount);
  }

  filterTransactions(transactions: Transaction[], criteria: FilterCriteria): Transaction[] {
    return transactions.filter((t) => t.amount > criteria.minAmount);
  }
}
