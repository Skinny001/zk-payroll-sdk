import * as snarkjs from 'snarkjs';
import { generateNullifier } from './commitment';
import type { Groth16Proof, GenerateProofParams } from '../types';

// Circuit artifacts paths (will be bundled or fetched)
const CIRCUIT_WASM_PATH = './circuits/payment.wasm';
const CIRCUIT_ZKEY_PATH = './circuits/payment_final.zkey';

/**
 * Generate a Groth16 proof for a payment
 * 
 * The circuit proves:
 * 1. The prover knows the salary and blinding factor that hash to the commitment
 * 2. The payment amount equals the committed salary
 * 3. The nullifier is correctly computed
 */
export async function generatePaymentProof(
  params: GenerateProofParams
): Promise<Groth16Proof> {
  const { salary, blindingFactor, recipient, commitment } = params;

  // Generate nullifier
  const nullifier = await generateNullifier(
    commitment,
    Date.now(), // Use current time as part of nullifier
    blindingFactor
  );

  // Prepare circuit inputs
  const circuitInputs = {
    // Private inputs (known only to prover)
    salary: salary.toString(),
    blindingFactor: bytesToFieldElement(blindingFactor),
    
    // Public inputs (verified on-chain)
    commitment: bytesToFieldElement(commitment),
    nullifier: bytesToFieldElement(nullifier),
    recipientHash: hashAddress(recipient),
  };

  try {
    // Generate the proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      CIRCUIT_WASM_PATH,
      CIRCUIT_ZKEY_PATH
    );

    // Convert proof to contract format
    return {
      a: encodeG1Point(proof.pi_a),
      b: encodeG2Point(proof.pi_b),
      c: encodeG1Point(proof.pi_c),
      nullifier,
    };
  } catch (error) {
    throw new Error(`Proof generation failed: ${error}`);
  }
}

/**
 * Verify a proof locally (for testing)
 */
export async function verifyProofLocally(
  proof: Groth16Proof,
  publicInputs: {
    commitment: Uint8Array;
    nullifier: Uint8Array;
    recipientHash: string;
  }
): Promise<boolean> {
  const vkeyPath = './circuits/verification_key.json';

  try {
    const snarkProof = {
      pi_a: decodeG1Point(proof.a),
      pi_b: decodeG2Point(proof.b),
      pi_c: decodeG1Point(proof.c),
    };

    const signals = [
      bytesToFieldElement(publicInputs.commitment),
      bytesToFieldElement(publicInputs.nullifier),
      publicInputs.recipientHash,
    ];

    return await snarkjs.groth16.verify(
      vkeyPath,
      signals,
      snarkProof
    );
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}

/**
 * Export verification key for on-chain verifier initialization
 */
export async function exportVerificationKey(): Promise<{
  alpha: Uint8Array;
  beta: Uint8Array;
  gamma: Uint8Array;
  delta: Uint8Array;
  ic: Uint8Array[];
}> {
  // Load verification key
  const vkey = await import('./circuits/verification_key.json');

  return {
    alpha: encodeG1Point(vkey.vk_alpha_1),
    beta: encodeG2Point(vkey.vk_beta_2),
    gamma: encodeG2Point(vkey.vk_gamma_2),
    delta: encodeG2Point(vkey.vk_delta_2),
    ic: vkey.IC.map((point: any) => encodeG1Point(point)),
  };
}

// ============================================
// Encoding Helpers
// ============================================

/**
 * Encode G1 point to 64 bytes (BN254)
 */
function encodeG1Point(point: [string, string, string]): Uint8Array {
  const x = BigInt(point[0]);
  const y = BigInt(point[1]);
  
  const result = new Uint8Array(64);
  result.set(bigIntToBytes32(x), 0);
  result.set(bigIntToBytes32(y), 32);
  
  return result;
}

/**
 * Encode G2 point to 128 bytes (BN254)
 */
function encodeG2Point(point: [[string, string], [string, string], [string, string]]): Uint8Array {
  const x0 = BigInt(point[0][0]);
  const x1 = BigInt(point[0][1]);
  const y0 = BigInt(point[1][0]);
  const y1 = BigInt(point[1][1]);
  
  const result = new Uint8Array(128);
  result.set(bigIntToBytes32(x0), 0);
  result.set(bigIntToBytes32(x1), 32);
  result.set(bigIntToBytes32(y0), 64);
  result.set(bigIntToBytes32(y1), 96);
  
  return result;
}

/**
 * Decode G1 point from 64 bytes
 */
function decodeG1Point(bytes: Uint8Array): [string, string, string] {
  const x = bytes32ToBigInt(bytes.slice(0, 32));
  const y = bytes32ToBigInt(bytes.slice(32, 64));
  
  return [x.toString(), y.toString(), '1'];
}

/**
 * Decode G2 point from 128 bytes
 */
function decodeG2Point(bytes: Uint8Array): [[string, string], [string, string], [string, string]] {
  const x0 = bytes32ToBigInt(bytes.slice(0, 32));
  const x1 = bytes32ToBigInt(bytes.slice(32, 64));
  const y0 = bytes32ToBigInt(bytes.slice(64, 96));
  const y1 = bytes32ToBigInt(bytes.slice(96, 128));
  
  return [
    [x0.toString(), x1.toString()],
    [y0.toString(), y1.toString()],
    ['1', '0'],
  ];
}

// ============================================
// Utility Functions
// ============================================

function bytesToFieldElement(bytes: Uint8Array): string {
  let result = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    result = (result << BigInt(8)) | BigInt(bytes[i]);
  }
  return result.toString();
}

function bigIntToBytes32(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let temp = value;
  
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(temp & BigInt(0xff));
    temp = temp >> BigInt(8);
  }
  
  return bytes;
}

function bytes32ToBigInt(bytes: Uint8Array): bigint {
  let result = BigInt(0);
  for (let i = 0; i < 32; i++) {
    result = (result << BigInt(8)) | BigInt(bytes[i]);
  }
  return result;
}

function hashAddress(address: string): string {
  // Simple hash for demo - use proper Poseidon in production
  let hash = BigInt(0);
  for (let i = 0; i < address.length; i++) {
    hash = (hash * BigInt(31) + BigInt(address.charCodeAt(i))) % BigInt(2) ** BigInt(254);
  }
  return hash.toString();
}
