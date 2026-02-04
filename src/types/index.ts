// ============================================
// Configuration
// ============================================

export interface ZKPayrollConfig {
  network: 'testnet' | 'mainnet';
  secretKey: string;
  contractAddresses?: {
    registry: string;
    commitment: string;
    verifier: string;
    executor: string;
  };
  tokenAddress?: string;
}

// ============================================
// Company
// ============================================

export interface Company {
  id: string;
  admin: string;
  treasury: string;
  employeeCount: number;
  isActive: boolean;
}

export interface RegisterCompanyParams {
  companyId: string;
  treasuryAddress: string;
}

// ============================================
// Employee
// ============================================

export interface Employee {
  address: string;
  companyId: string;
  salaryCommitment: Uint8Array;
  isActive: boolean;
  lastPaymentTimestamp: number;
}

export interface AddEmployeeParams {
  companyId: string;
  employeeAddress: string;
  salary: number; // In smallest unit (e.g., cents)
}

export interface UpdateSalaryParams {
  companyId: string;
  employeeAddress: string;
  newSalary: number;
}

export interface DeactivateEmployeeParams {
  companyId: string;
  employeeAddress: string;
}

// ============================================
// Payment
// ============================================

export interface ProcessPaymentParams {
  companyId: string;
  employeeAddress: string;
  amount: number;
  period: number;
}

export interface ProcessPayrollParams {
  companyId: string;
  period: number;
  employees?: string[]; // Optional: specific employees only
}

export interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  period: number;
  employeeAddress: string;
}

export interface PaymentRecord {
  companyId: string;
  employee: string;
  proofHash: Uint8Array;
  timestamp: number;
  period: number;
}

// ============================================
// Proofs
// ============================================

export interface Groth16Proof {
  a: Uint8Array; // 64 bytes - G1 point
  b: Uint8Array; // 128 bytes - G2 point
  c: Uint8Array; // 64 bytes - G1 point
  nullifier: Uint8Array; // 32 bytes
}

export interface GenerateProofParams {
  salary: number;
  blindingFactor: Uint8Array;
  recipient: string;
  commitment: Uint8Array;
}

// ============================================
// Audit
// ============================================

export type AuditScope = 'full' | 'aggregate' | 'timeRange' | 'employeeList';

export interface ViewKey {
  id: Uint8Array;
  companyId: string;
  auditor: string;
  grantedBy: string;
  createdAt: number;
  expiresAt: number;
  scope: AuditScope;
}

export interface GenerateViewKeyParams {
  companyId: string;
  auditorAddress: string;
  scope: AuditScope;
  durationDays: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface AuditReport {
  companyId: string;
  totalEmployees: number;
  totalPaid: bigint;
  periodStart: number;
  periodEnd: number;
  verified: boolean;
}

export interface GenerateAuditReportParams {
  viewKeyId: string;
  periodStart: Date;
  periodEnd: Date;
}

// ============================================
// Errors
// ============================================

export enum ErrorCodes {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  ALREADY_PAID = 'ALREADY_PAID',
  INVALID_PROOF = 'INVALID_PROOF',
  EMPLOYEE_NOT_FOUND = 'EMPLOYEE_NOT_FOUND',
  COMPANY_NOT_FOUND = 'COMPANY_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  VIEW_KEY_EXPIRED = 'VIEW_KEY_EXPIRED',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export class ZKPayrollError extends Error {
  constructor(
    public code: ErrorCodes,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ZKPayrollError';
  }
}

// ============================================
// Events
// ============================================

export interface PaymentProcessedEvent {
  companyId: string;
  employeeAddress: string;
  period: number;
  transactionHash: string;
  timestamp: Date;
}

export interface ProofGeneratedEvent {
  duration: number; // milliseconds
  proofSize: number;
}
