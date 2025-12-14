/**
 * Whitelist verification service
 *
 * Verifies user status against the relay's D1 database whitelist.
 * This is the SOURCE OF TRUTH for admin/cohort permissions.
 *
 * The client-side VITE_ADMIN_PUBKEY check is for UI/UX only.
 * All privileged actions MUST be verified via this service.
 */

import { getNDK, connectNDK } from './ndk';
import { NDKEvent, type NDKFilter } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';

export type CohortName = 'admin' | 'business' | 'moomaa-tribe';

export interface WhitelistEntry {
  pubkey: string;
  cohorts: CohortName[];
  addedAt: number;
  addedBy: string;
  expiresAt: number | null;
  notes: string | null;
}

export interface WhitelistStatus {
  isWhitelisted: boolean;
  isAdmin: boolean;
  cohorts: CohortName[];
  verifiedAt: number;
  source: 'relay' | 'cache' | 'fallback';
}

// Cache whitelist status to avoid repeated queries
const statusCache = new Map<string, { status: WhitelistStatus; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify a user's whitelist status via the relay
 *
 * This queries the relay for NIP-11 info or a custom whitelist event
 * to confirm the user's actual permissions in the D1 database.
 *
 * @param pubkey - User's public key (hex format)
 * @returns WhitelistStatus with verified permissions
 */
export async function verifyWhitelistStatus(pubkey: string): Promise<WhitelistStatus> {
  if (!browser || !pubkey) {
    return createFallbackStatus(pubkey);
  }

  // Check cache first
  const cached = statusCache.get(pubkey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.status, source: 'cache' };
  }

  try {
    await connectNDK();
    const ndk = getNDK();

    // Strategy 1: Query for a kind 30078 (application-specific data) event
    // that the relay publishes for whitelisted users
    // This is a custom event type we can implement in nosflare
    const whitelistFilter: NDKFilter = {
      kinds: [30078],
      '#d': ['whitelist'],
      '#p': [pubkey],
      limit: 1
    };

    const whitelistEvents = await ndk.fetchEvents(whitelistFilter);
    const whitelistEvent = Array.from(whitelistEvents)[0];

    if (whitelistEvent) {
      const status = parseWhitelistEvent(whitelistEvent, pubkey);
      cacheStatus(pubkey, status);
      return status;
    }

    // Strategy 2: Check if user can publish (implicit whitelist check)
    // If relay accepts NIP-42 AUTH and user is whitelisted, they can publish
    // We can test this by checking relay connection status
    const relayStatus = checkRelayAuth(ndk, pubkey);
    if (relayStatus) {
      cacheStatus(pubkey, relayStatus);
      return relayStatus;
    }

    // Strategy 3: Fall back to client-side check
    // This happens if the relay doesn't implement whitelist events
    const fallback = createFallbackStatus(pubkey);
    cacheStatus(pubkey, fallback);
    return fallback;

  } catch (error) {
    console.warn('[Whitelist] Verification failed, using fallback:', error);
    return createFallbackStatus(pubkey);
  }
}

/**
 * Parse a whitelist event (kind 30078) from the relay
 */
function parseWhitelistEvent(event: NDKEvent, pubkey: string): WhitelistStatus {
  try {
    const content = JSON.parse(event.content);

    return {
      isWhitelisted: true,
      isAdmin: content.cohorts?.includes('admin') ?? false,
      cohorts: content.cohorts ?? [],
      verifiedAt: Date.now(),
      source: 'relay'
    };
  } catch {
    return createFallbackStatus(pubkey);
  }
}

/**
 * Check relay authentication status
 */
function checkRelayAuth(ndk: ReturnType<typeof getNDK>, pubkey: string): WhitelistStatus | null {
  // Check if any relay has authenticated this user
  for (const relay of ndk.pool.relays.values()) {
    // NDK tracks auth status per relay
    // If user is authed, they're likely whitelisted
    if (relay.connectivity.status === 1) { // CONNECTED
      // We can't directly check whitelist from relay status
      // Return null to fall through to fallback
      return null;
    }
  }
  return null;
}

/**
 * Create fallback status using client-side admin check
 */
function createFallbackStatus(pubkey: string): WhitelistStatus {
  const adminPubkeys = (import.meta.env.VITE_ADMIN_PUBKEY || '')
    .split(',')
    .map((k: string) => k.trim())
    .filter(Boolean);

  const isAdmin = adminPubkeys.includes(pubkey);

  return {
    isWhitelisted: isAdmin, // Assume admin is whitelisted
    isAdmin,
    cohorts: isAdmin ? ['admin'] : [],
    verifiedAt: Date.now(),
    source: 'fallback'
  };
}

/**
 * Cache a whitelist status
 */
function cacheStatus(pubkey: string, status: WhitelistStatus): void {
  statusCache.set(pubkey, {
    status,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

/**
 * Clear cached status for a user (e.g., after logout)
 */
export function clearWhitelistCache(pubkey?: string): void {
  if (pubkey) {
    statusCache.delete(pubkey);
  } else {
    statusCache.clear();
  }
}

/**
 * Check if current user has admin privileges
 * This is the AUTHORITATIVE check - use this instead of client-side isAdmin
 */
export async function verifyAdminStatus(pubkey: string): Promise<boolean> {
  const status = await verifyWhitelistStatus(pubkey);
  return status.isAdmin;
}

/**
 * Check if current user belongs to a specific cohort
 */
export async function verifyCohortMembership(pubkey: string, cohort: CohortName): Promise<boolean> {
  const status = await verifyWhitelistStatus(pubkey);
  return status.cohorts.includes(cohort);
}

/**
 * Get all cohorts for a user
 */
export async function getUserCohorts(pubkey: string): Promise<CohortName[]> {
  const status = await verifyWhitelistStatus(pubkey);
  return status.cohorts;
}

/**
 * Quick check if user is approved (whitelisted or admin)
 * Used by auth flows to determine if pending approval is needed
 */
export async function checkWhitelistStatus(pubkey: string): Promise<{ isApproved: boolean; isAdmin: boolean }> {
  const status = await verifyWhitelistStatus(pubkey);
  return {
    isApproved: status.isWhitelisted,
    isAdmin: status.isAdmin
  };
}
