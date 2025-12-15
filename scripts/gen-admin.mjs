#!/usr/bin/env node
import { generateMnemonic, mnemonicToSeed } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { getPublicKey, nip19 } from 'nostr-tools';

// Generate 128 bits of entropy (12 words)
const mnemonic = generateMnemonic(wordlist, 128);

// Derive keys using NIP-06 path
const seed = await mnemonicToSeed(mnemonic, '');
const root = HDKey.fromMasterSeed(seed);
const path = "m/44'/1237'/0'/0/0"; // NIP-06 standard
const derived = root.derive(path);

if (!derived.privateKey) {
  throw new Error('Failed to derive private key');
}

const privkeyHex = bytesToHex(derived.privateKey);
const pubkeyHex = getPublicKey(hexToBytes(privkeyHex));

// Convert to Nostr formats (following project pattern from src/lib/nostr/keys.ts)
const nsec = nip19.nsecEncode(hexToBytes(privkeyHex));
const npub = nip19.npubEncode(pubkeyHex);

console.log('=== NEW ADMIN CREDENTIALS ===');
console.log('');
console.log('MNEMONIC (12 words - BACKUP SECURELY):');
console.log(mnemonic);
console.log('');
console.log('PUBLIC KEY (hex):');
console.log(pubkeyHex);
console.log('');
console.log('NPUB (public key bech32):');
console.log(npub);
console.log('');
console.log('NSEC (private key bech32 - NEVER SHARE):');
console.log(nsec);
console.log('');
console.log('PRIVATE KEY (hex - NEVER SHARE):');
console.log(privkeyHex);
console.log('');
console.log('========================================');
console.log('DEPLOYMENT TARGETS');
console.log('========================================');
console.log('');
console.log('GCP Secret Manager:');
console.log(`  admin-mnemonic: ${mnemonic}`);
console.log(`  admin-pubkey: ${pubkeyHex}`);
console.log(`  admin-provkey: ${nsec}`);
console.log('');
console.log('.env file:');
console.log(`VITE_ADMIN_PUBKEY=${pubkeyHex}`);
console.log('');
console.log('GitHub Repository Variable:');
console.log(`ADMIN_PUBKEY=${pubkeyHex}`);
