import { buildPoseidon } from 'circomlibjs';

let poseidonInstance: any = null;

/**
 * Initialize Poseidon hash function
 */
async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

/**
 * Generate a cryptographically secure blinding factor
 */
export function generateBlindingFactor(): Uint8Array {
  const buffer = new Uint8Array(32);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
  } else {
    // Node.js environment
    const nodeCrypto = require('crypto');
    const randomBytes = nodeCrypto.randomBytes(32);
    buffer.set(randomBytes);
  }
  
  return buffer;
}

/**
 * Generate a Poseidon hash commitment
 * commitment = Poseidon(salary, blindingFactor)
 */
export async function generateCommitment(
  salary: number,
  blindingFactor: Uint8Array
): Promise<Uint8Array> {
  const poseidon = await getPoseidon();
  
  // Convert salary to field element
  const salaryBigInt = BigInt(salary);
  
  // Convert blinding factor to field element
  const blindingBigInt = bytesToBigInt(blindingFactor);
  
  // Compute Poseidon hash
  const hash = poseidon([salaryBigInt, blindingBigInt]);
  
  // Convert to bytes
  return bigIntToBytes(poseidon.F.toObject(hash));
}

/**
 * Verify a commitment matches a value
 */
export async function verifyCommitment(
  commitment: Uint8Array,
  salary: number,
  blindingFactor: Uint8Array
): Promise<boolean> {
  const computed = await generateCommitment(salary, blindingFactor);
  return areEqual(commitment, computed);
}

/**
 * Generate a nullifier for a payment
 * nullifier = Poseidon(commitment, period, secret)
 */
export async function generateNullifier(
  commitment: Uint8Array,
  period: number,
  secret: Uint8Array
): Promise<Uint8Array> {
  const poseidon = await getPoseidon();
  
  const commitmentBigInt = bytesToBigInt(commitment);
  const periodBigInt = BigInt(period);
  const secretBigInt = bytesToBigInt(secret);
  
  const hash = poseidon([commitmentBigInt, periodBigInt, secretBigInt]);
  
  return bigIntToBytes(poseidon.F.toObject(hash));
}

// ============================================
// Utility Functions
// ============================================

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    result = (result << BigInt(8)) | BigInt(bytes[i]);
  }
  return result;
}

function bigIntToBytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let temp = value;
  
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(temp & BigInt(0xff));
    temp = temp >> BigInt(8);
  }
  
  return bytes;
}

function areEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
