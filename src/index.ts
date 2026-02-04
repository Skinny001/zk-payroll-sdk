// Main client
export { ZKPayroll } from './client';

// Types
export type {
  ZKPayrollConfig,
  Company,
  Employee,
  PaymentResult,
  PaymentRecord,
  ViewKey,
  AuditReport,
  AuditScope,
  Groth16Proof,
  AddEmployeeParams,
  UpdateSalaryParams,
  DeactivateEmployeeParams,
  ProcessPaymentParams,
  ProcessPayrollParams,
  GenerateViewKeyParams,
  GenerateAuditReportParams,
  RegisterCompanyParams,
  GenerateProofParams,
  PaymentProcessedEvent,
  ProofGeneratedEvent,
} from './types';

// Errors
export { ZKPayrollError, ErrorCodes } from './types';

// Crypto utilities (for advanced usage)
export {
  generateCommitment,
  verifyCommitment,
  generateBlindingFactor,
  generateNullifier,
} from './crypto/commitment';

export {
  generatePaymentProof,
  verifyProofLocally,
  exportVerificationKey,
} from './crypto/groth16';
