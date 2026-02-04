# ZK Payroll SDK

TypeScript SDK for integrating ZK Payroll into your application.

## Overview

ZK Payroll SDK provides a simple interface for companies to manage private payroll on Stellar. Generate ZK proofs client-side and submit payments without exposing salary data on-chain.

## Features

- 🔐 **Client-side proof generation** — Salaries never leave your server
- 🚀 **Simple API** — Intuitive methods for common operations
- 📦 **TypeScript first** — Full type safety and IntelliSense
- ⚡ **Batch support** — Process multiple payments efficiently
- 🔍 **Audit helpers** — Generate view keys for compliance

## Installation

```bash
npm install @zkpayroll/sdk
# or
yarn add @zkpayroll/sdk
# or
pnpm add @zkpayroll/sdk
```

## Quick Start

```typescript
import { ZKPayroll } from '@zkpayroll/sdk';

// Initialize client
const zkPayroll = new ZKPayroll({
  network: 'testnet',
  secretKey: 'S...', // Company treasury key
});

// Register company
await zkPayroll.registerCompany({
  companyId: 'ACME',
  treasuryAddress: 'G...',
});

// Add employee with private salary
await zkPayroll.addEmployee({
  companyId: 'ACME',
  employeeAddress: 'G...',
  salary: 5000_00, // $5,000 in cents
});

// Process payroll
await zkPayroll.processPayroll({
  companyId: 'ACME',
  period: 202601, // January 2026
});
```

## API Reference

### Initialization

```typescript
const zkPayroll = new ZKPayroll({
  network: 'testnet' | 'mainnet',
  secretKey: string,           // Admin/treasury secret key
  contractAddresses?: {        // Optional custom addresses
    registry: string,
    commitment: string,
    verifier: string,
    executor: string,
  },
});
```

### Company Management

```typescript
// Register a new company
await zkPayroll.registerCompany({
  companyId: string,
  treasuryAddress: string,
});

// Get company details
const company = await zkPayroll.getCompany(companyId);
```

### Employee Management

```typescript
// Add employee with salary commitment
await zkPayroll.addEmployee({
  companyId: string,
  employeeAddress: string,
  salary: number,              // In smallest unit (cents)
});

// Update salary (e.g., for raises)
await zkPayroll.updateSalary({
  companyId: string,
  employeeAddress: string,
  newSalary: number,
});

// Deactivate employee
await zkPayroll.deactivateEmployee({
  companyId: string,
  employeeAddress: string,
});
```

### Payroll Processing

```typescript
// Process single payment
const result = await zkPayroll.processPayment({
  companyId: string,
  employeeAddress: string,
  period: number,
});

// Process batch payroll
const results = await zkPayroll.processPayroll({
  companyId: string,
  period: number,
  employees?: string[],        // Optional: specific employees only
});

// Check payment status
const isPaid = await zkPayroll.isPaymentComplete({
  employeeAddress: string,
  period: number,
});
```

### Audit & Compliance

```typescript
// Generate view key for auditor
const viewKey = await zkPayroll.generateViewKey({
  companyId: string,
  auditorAddress: string,
  scope: 'full' | 'aggregate' | 'timeRange',
  durationDays: number,
  timeRange?: { start: Date, end: Date },
});

// Generate audit report
const report = await zkPayroll.generateAuditReport({
  viewKeyId: string,
  periodStart: Date,
  periodEnd: Date,
});

// Revoke view key
await zkPayroll.revokeViewKey(keyId);
```

### Proof Generation

```typescript
// Generate commitment (internal use)
const commitment = zkPayroll.generateCommitment(salary, blindingFactor);

// Generate payment proof (internal use)
const proof = await zkPayroll.generatePaymentProof({
  salary: number,
  blindingFactor: Uint8Array,
  recipient: string,
});
```

## Advanced Usage

### Custom Token

```typescript
const zkPayroll = new ZKPayroll({
  network: 'mainnet',
  secretKey: 'S...',
  tokenAddress: 'CUSDC...', // Custom USDC address
});
```

### Error Handling

```typescript
import { ZKPayrollError, ErrorCodes } from '@zkpayroll/sdk';

try {
  await zkPayroll.processPayment({ ... });
} catch (error) {
  if (error instanceof ZKPayrollError) {
    switch (error.code) {
      case ErrorCodes.INSUFFICIENT_FUNDS:
        // Handle insufficient treasury balance
        break;
      case ErrorCodes.ALREADY_PAID:
        // Payment already made for this period
        break;
      case ErrorCodes.INVALID_PROOF:
        // Proof verification failed
        break;
    }
  }
}
```

### Events

```typescript
zkPayroll.on('paymentProcessed', (event) => {
  console.log(`Paid ${event.employeeAddress} for period ${event.period}`);
});

zkPayroll.on('proofGenerated', (event) => {
  console.log(`Proof generated in ${event.duration}ms`);
});
```

## Project Structure

```
zk-payroll-sdk/
├── src/
│   ├── index.ts              # Main exports
│   ├── client.ts             # ZKPayroll client class
│   ├── contracts/            # Contract interactions
│   │   ├── registry.ts
│   │   ├── commitment.ts
│   │   ├── verifier.ts
│   │   └── executor.ts
│   ├── crypto/               # Cryptographic operations
│   │   ├── poseidon.ts
│   │   ├── groth16.ts
│   │   └── commitment.ts
│   ├── types/                # TypeScript types
│   │   └── index.ts
│   └── utils/                # Helper functions
│       └── index.ts
├── tests/
│   └── ...
├── package.json
└── README.md
```

## Requirements

- Node.js 18+
- Stellar account with XLM for fees
- USDC (or payment token) in treasury

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Issues labeled `stellar-wave` are eligible for Wave Program rewards.

## License

MIT License — see [LICENSE](LICENSE)
