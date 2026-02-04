import {
  Keypair,
  Networks,
  TransactionBuilder,
  Contract,
  SorobanRpc,
} from '@stellar/stellar-sdk';
import { generateCommitment, generateBlindingFactor } from './crypto/commitment';
import { generatePaymentProof } from './crypto/groth16';
import type {
  ZKPayrollConfig,
  Company,
  Employee,
  PaymentResult,
  ViewKey,
  AuditReport,
  AddEmployeeParams,
  ProcessPaymentParams,
  ProcessPayrollParams,
  GenerateViewKeyParams,
  GenerateAuditReportParams,
} from './types';

export class ZKPayroll {
  private readonly server: SorobanRpc.Server;
  private readonly keypair: Keypair;
  private readonly networkPassphrase: string;
  private readonly contractAddresses: {
    registry: string;
    commitment: string;
    verifier: string;
    executor: string;
  };

  // Store blinding factors locally (never sent on-chain)
  private readonly blindingFactors: Map<string, Uint8Array> = new Map();

  constructor(config: ZKPayrollConfig) {
    this.networkPassphrase =
      config.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

    const rpcUrl =
      config.network === 'mainnet'
        ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
        : 'https://soroban-testnet.stellar.org';

    this.server = new SorobanRpc.Server(rpcUrl);
    this.keypair = Keypair.fromSecret(config.secretKey);

    this.contractAddresses = config.contractAddresses ?? {
      registry: '', // Will be set after deployment
      commitment: '',
      verifier: '',
      executor: '',
    };
  }

  // ============================================
  // Company Management
  // ============================================

  async registerCompany(params: {
    companyId: string;
    treasuryAddress: string;
  }): Promise<Company> {
    const contract = new Contract(this.contractAddresses.registry);

    // Build and submit transaction
    const tx = await this.buildTransaction(
      contract.call(
        'register_company',
        ...[params.companyId, this.keypair.publicKey(), params.treasuryAddress]
      )
    );

    await this.submitTransaction(tx);

    return {
      id: params.companyId,
      admin: this.keypair.publicKey(),
      treasury: params.treasuryAddress,
      employeeCount: 0,
      isActive: true,
    };
  }

  async getCompany(companyId: string): Promise<Company> {
    const contract = new Contract(this.contractAddresses.registry);

    const result = await this.server.simulateTransaction(
      await this.buildTransaction(contract.call('get_company', companyId))
    );

    // Parse result
    return this.parseCompanyResult(result);
  }

  // ============================================
  // Employee Management
  // ============================================

  async addEmployee(params: AddEmployeeParams): Promise<Employee> {
    // Generate blinding factor (kept secret)
    const blindingFactor = generateBlindingFactor();

    // Generate commitment = Poseidon(salary, blindingFactor)
    const commitment = await generateCommitment(params.salary, blindingFactor);

    // Store blinding factor locally
    const key = `${params.companyId}:${params.employeeAddress}`;
    this.blindingFactors.set(key, blindingFactor);

    // Submit commitment on-chain
    const contract = new Contract(this.contractAddresses.registry);

    const tx = await this.buildTransaction(
      contract.call(
        'add_employee',
        params.companyId,
        params.employeeAddress,
        commitment
      )
    );

    await this.submitTransaction(tx);

    return {
      address: params.employeeAddress,
      companyId: params.companyId,
      salaryCommitment: commitment,
      isActive: true,
      lastPaymentTimestamp: 0,
    };
  }

  async updateSalary(params: {
    companyId: string;
    employeeAddress: string;
    newSalary: number;
  }): Promise<void> {
    // Generate new blinding factor
    const blindingFactor = generateBlindingFactor();
    const commitment = await generateCommitment(params.newSalary, blindingFactor);

    // Update stored blinding factor
    const key = `${params.companyId}:${params.employeeAddress}`;
    this.blindingFactors.set(key, blindingFactor);

    // Update commitment on-chain
    const contract = new Contract(this.contractAddresses.registry);

    const tx = await this.buildTransaction(
      contract.call(
        'update_salary_commitment',
        params.companyId,
        params.employeeAddress,
        commitment
      )
    );

    await this.submitTransaction(tx);
  }

  async deactivateEmployee(params: {
    companyId: string;
    employeeAddress: string;
  }): Promise<void> {
    const contract = new Contract(this.contractAddresses.registry);

    const tx = await this.buildTransaction(
      contract.call(
        'deactivate_employee',
        params.companyId,
        params.employeeAddress
      )
    );

    await this.submitTransaction(tx);

    // Clear stored blinding factor
    const key = `${params.companyId}:${params.employeeAddress}`;
    this.blindingFactors.delete(key);
  }

  // ============================================
  // Payroll Processing
  // ============================================

  async processPayment(params: ProcessPaymentParams): Promise<PaymentResult> {
    const key = `${params.companyId}:${params.employeeAddress}`;
    const blindingFactor = this.blindingFactors.get(key);

    if (!blindingFactor) {
      throw new Error('Blinding factor not found. Was employee added via this SDK?');
    }

    // Get stored commitment
    const employee = await this.getEmployee(params.employeeAddress);

    // Generate ZK proof
    const proof = await generatePaymentProof({
      salary: params.amount,
      blindingFactor,
      recipient: params.employeeAddress,
      commitment: employee.salaryCommitment,
    });

    // Submit payment with proof
    const contract = new Contract(this.contractAddresses.executor);

    const tx = await this.buildTransaction(
      contract.call(
        'execute_payment',
        params.companyId,
        params.employeeAddress,
        params.amount,
        proof.a,
        proof.b,
        proof.c,
        proof.nullifier,
        params.period
      )
    );

    await this.submitTransaction(tx);

    return {
      success: true,
      transactionHash: '', // Get from tx result
      period: params.period,
      employeeAddress: params.employeeAddress,
    };
  }

  async processPayroll(params: ProcessPayrollParams): Promise<PaymentResult[]> {
    // Get all active employees if not specified
    const employees = params.employees ?? await this.getActiveEmployees(params.companyId);

    const results: PaymentResult[] = [];

    for (const employeeAddress of employees) {
      try {
        const key = `${params.companyId}:${employeeAddress}`;
        const blindingFactor = this.blindingFactors.get(key);

        if (!blindingFactor) {
          console.warn(`Skipping ${employeeAddress}: no blinding factor`);
          continue;
        }

        // Get salary from local storage (you'd store this when adding employee)
        const salary = await this.getEmployeeSalary(params.companyId, employeeAddress);

        const result = await this.processPayment({
          companyId: params.companyId,
          employeeAddress,
          amount: salary,
          period: params.period,
        });

        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: String(error),
          period: params.period,
          employeeAddress,
        });
      }
    }

    return results;
  }

  async isPaymentComplete(params: {
    employeeAddress: string;
    period: number;
  }): Promise<boolean> {
    const contract = new Contract(this.contractAddresses.executor);

    const result = await this.server.simulateTransaction(
      await this.buildTransaction(
        contract.call('is_paid', params.employeeAddress, params.period)
      )
    );

    return this.parseBoolResult(result);
  }

  // ============================================
  // Audit & Compliance
  // ============================================

  async generateViewKey(params: GenerateViewKeyParams): Promise<ViewKey> {
    const contract = new Contract(this.contractAddresses.executor);

    const scopeValue = this.mapAuditScope(params.scope, params.timeRange);

    const tx = await this.buildTransaction(
      contract.call(
        'generate_view_key',
        params.companyId,
        this.keypair.publicKey(),
        params.auditorAddress,
        scopeValue,
        params.durationDays
      )
    );

    await this.submitTransaction(tx);

    // Parse result to get view key
    return {} as ViewKey; // Placeholder
  }

  async generateAuditReport(params: GenerateAuditReportParams): Promise<AuditReport> {
    const contract = new Contract(this.contractAddresses.executor);

    const result = await this.server.simulateTransaction(
      await this.buildTransaction(
        contract.call(
          'generate_aggregate_report',
          params.viewKeyId,
          this.keypair.publicKey(),
          params.periodStart.getTime() / 1000,
          params.periodEnd.getTime() / 1000
        )
      )
    );

    return this.parseAuditReportResult(result);
  }

  async revokeViewKey(keyId: string): Promise<void> {
    const contract = new Contract(this.contractAddresses.executor);

    const tx = await this.buildTransaction(
      contract.call('revoke_view_key', this.keypair.publicKey(), keyId)
    );

    await this.submitTransaction(tx);
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async buildTransaction(operation: any): Promise<any> {
    const account = await this.server.getAccount(this.keypair.publicKey());

    return new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();
  }

  private async submitTransaction(tx: any): Promise<any> {
    tx.sign(this.keypair);
    return await this.server.sendTransaction(tx);
  }

  private async getEmployee(address: string): Promise<Employee> {
    const contract = new Contract(this.contractAddresses.registry);

    const result = await this.server.simulateTransaction(
      await this.buildTransaction(contract.call('get_employee', address))
    );

    return this.parseEmployeeResult(result);
  }

  private async getActiveEmployees(companyId: string): Promise<string[]> {
    // TODO: Implement - get all active employees for a company
    return [];
  }

  private async getEmployeeSalary(companyId: string, employee: string): Promise<number> {
    // TODO: Implement - retrieve stored salary
    return 0;
  }

  private mapAuditScope(scope: string, timeRange?: { start: Date; end: Date }): any {
    switch (scope) {
      case 'full':
        return { FullCompany: {} };
      case 'aggregate':
        return { AggregateOnly: {} };
      case 'timeRange':
        if (!timeRange) throw new Error('timeRange required for timeRange scope');
        return {
          TimeRange: [
            Math.floor(timeRange.start.getTime() / 1000),
            Math.floor(timeRange.end.getTime() / 1000),
          ],
        };
      default:
        throw new Error(`Unknown scope: ${scope}`);
    }
  }

  // Result parsers (placeholders)
  private parseCompanyResult(result: any): Company {
    return {} as Company;
  }

  private parseEmployeeResult(result: any): Employee {
    return {} as Employee;
  }

  private parseBoolResult(result: any): boolean {
    return false;
  }

  private parseAuditReportResult(result: any): AuditReport {
    return {} as AuditReport;
  }
}
