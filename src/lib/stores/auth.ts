import { writable, derived, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { base } from '$app/paths';
import { encryptPrivateKey, decryptPrivateKey, isEncryptionAvailable } from '$lib/utils/key-encryption';
import { isPWAInstalled, checkIfPWA } from '$lib/stores/pwa';

export interface AuthState {
  state: 'unauthenticated' | 'authenticating' | 'authenticated';
  pubkey: string | null;
  isAuthenticated: boolean;
  publicKey: string | null;
  privateKey: string | null;
  mnemonic: string | null;
  nickname: string | null;
  avatar: string | null;
  isPending: boolean;
  error: string | null;
  isEncrypted: boolean;
  mnemonicBackedUp: boolean;
  isReady: boolean;
}

const initialState: AuthState = {
  state: 'unauthenticated',
  pubkey: null,
  isAuthenticated: false,
  publicKey: null,
  privateKey: null,
  mnemonic: null,
  nickname: null,
  avatar: null,
  isPending: false,
  error: null,
  isEncrypted: false,
  mnemonicBackedUp: false,
  isReady: false
};

const STORAGE_KEY = 'nostr_bbs_keys';
const SESSION_KEY = 'nostr_bbs_session';
const COOKIE_KEY = 'nostr_bbs_auth';
const KEEP_SIGNED_IN_KEY = 'nostr_bbs_keep_signed_in';
const PWA_AUTH_KEY = 'nostr_bbs_pwa_auth';

/**
 * Check if running as installed PWA
 */
function isRunningAsPWA(): boolean {
  if (!browser) return false;
  // Check current state or stored PWA mode
  return get(isPWAInstalled) || checkIfPWA() || localStorage.getItem('nostr_bbs_pwa_mode') === 'true';
}

/**
 * Cookie utilities for persistent auth
 */
function setCookie(name: string, value: string, days: number): void {
  if (!browser) return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict; Secure`;
}

function getCookie(name: string): string | null {
  if (!browser) return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name: string): void {
  if (!browser) return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict; Secure`;
}

/**
 * Check if user wants persistent login
 */
function shouldKeepSignedIn(): boolean {
  if (!browser) return false;
  return localStorage.getItem(KEEP_SIGNED_IN_KEY) !== 'false';
}


/**
 * Get or generate session encryption key
 * Session key is stored in sessionStorage (cleared on tab close)
 */
function getSessionKey(): string {
  if (!browser) return '';

  let sessionKey = sessionStorage.getItem(SESSION_KEY);
  if (!sessionKey) {
    // Generate a random session key
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    sessionKey = btoa(String.fromCharCode(...array));
    sessionStorage.setItem(SESSION_KEY, sessionKey);
  }
  return sessionKey;
}

function createAuthStore() {
  const { subscribe, set, update }: Writable<AuthState> = writable(initialState);

  // Promise that resolves when session restore is complete
  let readyPromise: Promise<void> | null = null;

  // Helper to sync state and pubkey with isAuthenticated and publicKey
  function syncStateFields(updates: Partial<AuthState>): Partial<AuthState> {
    const result = { ...updates };
    if (updates.isAuthenticated !== undefined) {
      result.state = updates.isAuthenticated ? 'authenticated' : 'unauthenticated';
    }
    if (updates.publicKey !== undefined) {
      result.pubkey = updates.publicKey;
    }
    return result;
  }

  // Restore from localStorage on init
  async function restoreSession() {
    if (!browser) {
      update(state => ({ ...state, ...syncStateFields({ isReady: true }) }));
      return;
    }

    // Check for PWA persistent auth first (no session expiry)
    const pwaAuth = localStorage.getItem(PWA_AUTH_KEY);
    if (pwaAuth && isRunningAsPWA()) {
      try {
        const pwaData = JSON.parse(pwaAuth);
        if (pwaData.publicKey && pwaData.privateKey) {
          console.log('[Auth] Restoring PWA persistent session');
          update(state => ({
            ...state,
            ...syncStateFields({
              publicKey: pwaData.publicKey,
              privateKey: pwaData.privateKey,
              nickname: pwaData.nickname || null,
              avatar: pwaData.avatar || null,
              isAuthenticated: true,
              isEncrypted: false,
              mnemonicBackedUp: pwaData.mnemonicBackedUp || false,
              isReady: true
            })
          }));
          return;
        }
      } catch {
        // Invalid PWA auth data, continue with normal flow
      }
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      update(state => ({ ...state, ...syncStateFields({ isReady: true }) }));
      return;
    }

    try {
      const parsed = JSON.parse(stored);

      // Check if data is encrypted
      if (parsed.encryptedPrivateKey && isEncryptionAvailable()) {
        const sessionKey = getSessionKey();
        try {
          const privateKey = await decryptPrivateKey(parsed.encryptedPrivateKey, sessionKey);
          update(state => ({
            ...state,
            ...syncStateFields({
              publicKey: parsed.publicKey,
              privateKey,
              nickname: parsed.nickname || null,
              avatar: parsed.avatar || null,
              isAuthenticated: true,
              isEncrypted: true,
              mnemonicBackedUp: parsed.mnemonicBackedUp || false,
              isReady: true
            })
          }));
        } catch {
          // Session key changed (new session) - need to re-authenticate
          // But if we're in PWA mode, try to use the stored keys directly
          if (isRunningAsPWA() && parsed.publicKey) {
            // For PWA, prompt user to re-enter password once to migrate
            update(state => ({
              ...state,
              ...syncStateFields({
                publicKey: parsed.publicKey,
                nickname: parsed.nickname || null,
                avatar: parsed.avatar || null,
                isAuthenticated: false,
                isEncrypted: true,
                error: 'Please unlock to enable persistent PWA login.',
                isReady: true
              })
            }));
          } else {
            update(state => ({
              ...state,
              ...syncStateFields({
                publicKey: parsed.publicKey,
                nickname: parsed.nickname || null,
                avatar: parsed.avatar || null,
                isAuthenticated: false,
                isEncrypted: true,
                error: 'Session expired. Please enter your password to unlock.',
                isReady: true
              })
            }));
          }
        }
      } else if (parsed.privateKey) {
        // Legacy unencrypted data - migrate on next save
        update(state => ({
          ...state,
          ...syncStateFields({
            ...parsed,
            isAuthenticated: true,
            isEncrypted: false,
            mnemonicBackedUp: parsed.mnemonicBackedUp || false,
            isReady: true
          })
        }));
      } else {
        update(state => ({ ...state, ...syncStateFields({ isReady: true }) }));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      update(state => ({ ...state, ...syncStateFields({ isReady: true }) }));
    }
  }

  // Initialize restoration
  if (browser) {
    readyPromise = restoreSession();
  } else {
    readyPromise = Promise.resolve();
  }

  return {
    subscribe,

    /**
     * Wait for the auth store to be ready (session restored)
     */
    waitForReady: () => readyPromise || Promise.resolve(),

    /**
     * Set keys with encryption
     */
    setKeys: async (publicKey: string, privateKey: string, mnemonic?: string) => {
      const sessionKey = getSessionKey();

      const authData: Partial<AuthState> = {
        publicKey,
        privateKey,
        mnemonic: mnemonic || null,
        isAuthenticated: true,
        isPending: false,
        error: null,
        isEncrypted: isEncryptionAvailable(),
        mnemonicBackedUp: false
      };

      if (browser) {
        const existing = localStorage.getItem(STORAGE_KEY);
        let existingData: { nickname?: string; avatar?: string; mnemonicBackedUp?: boolean } = {};
        if (existing) {
          try { existingData = JSON.parse(existing); } catch { /* ignore */ }
        }

        const storageData: Record<string, unknown> = {
          publicKey,
          nickname: existingData.nickname || null,
          avatar: existingData.avatar || null,
          mnemonicBackedUp: existingData.mnemonicBackedUp || false
        };

        // Encrypt private key if available
        if (isEncryptionAvailable()) {
          storageData.encryptedPrivateKey = await encryptPrivateKey(privateKey, sessionKey);
          // Don't store mnemonic at all after encryption is set up
        } else {
          // Fallback for environments without Web Crypto (shouldn't happen in modern browsers)
          storageData.privateKey = privateKey;
          if (mnemonic) {
            storageData.mnemonic = mnemonic;
          }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));

        // If keep signed in is enabled, also set a cookie for persistence
        if (shouldKeepSignedIn()) {
          setCookie(COOKIE_KEY, publicKey, 30); // 30 day cookie
        }

        // For PWA mode: store persistent auth that survives session changes
        if (isRunningAsPWA()) {
          const pwaAuthData = {
            publicKey,
            privateKey,
            nickname: existingData.nickname || null,
            avatar: existingData.avatar || null,
            mnemonicBackedUp: existingData.mnemonicBackedUp || false
          };
          localStorage.setItem(PWA_AUTH_KEY, JSON.stringify(pwaAuthData));
          console.log('[Auth] PWA persistent auth stored');
        }
      }

      update(state => ({ ...state, ...syncStateFields(authData) }));
    },

    /**
     * Mark mnemonic as backed up and clear it from memory
     */
    confirmMnemonicBackup: () => {
      update(state => ({
        ...state,
        mnemonic: null, // Clear mnemonic from memory
        mnemonicBackedUp: true
      }));

      if (browser) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            delete data.mnemonic; // Remove mnemonic from storage
            data.mnemonicBackedUp = true;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch { /* ignore */ }
        }
      }
    },

    /**
     * Unlock with password (for encrypted storage)
     */
    unlock: async (password: string) => {
      if (!browser) return false;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;

      try {
        const parsed = JSON.parse(stored);
        if (!parsed.encryptedPrivateKey) return false;

        const privateKey = await decryptPrivateKey(parsed.encryptedPrivateKey, password);

        // Re-encrypt with session key for this session
        const sessionKey = getSessionKey();
        const newEncrypted = await encryptPrivateKey(privateKey, sessionKey);
        parsed.encryptedPrivateKey = newEncrypted;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));

        // For PWA mode: store persistent auth that survives session changes
        if (isRunningAsPWA()) {
          const pwaAuthData = {
            publicKey: parsed.publicKey,
            privateKey,
            nickname: parsed.nickname || null,
            avatar: parsed.avatar || null,
            mnemonicBackedUp: parsed.mnemonicBackedUp || false
          };
          localStorage.setItem(PWA_AUTH_KEY, JSON.stringify(pwaAuthData));
          console.log('[Auth] PWA persistent auth stored after unlock');
        }

        update(state => ({
          ...state,
          ...syncStateFields({
            privateKey,
            publicKey: parsed.publicKey,
            isAuthenticated: true,
            error: null
          })
        }));

        return true;
      } catch {
        update(state => ({ ...state, error: 'Invalid password' }));
        return false;
      }
    },

    setProfile: (nickname: string | null, avatar: string | null) => {
      if (browser) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            data.nickname = nickname;
            data.avatar = avatar;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch { /* ignore */ }
        }
      }
      update(state => ({ ...state, nickname, avatar }));
    },

    setPending: (isPending: boolean) => {
      update(state => ({ ...state, isPending }));
    },

    setError: (error: string) => {
      update(state => ({ ...state, error }));
    },

    clearError: () => {
      update(state => ({ ...state, error: null }));
    },

    logout: async () => {
      set(initialState);
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PWA_AUTH_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        deleteCookie(COOKIE_KEY);
        const { goto } = await import('$app/navigation');
        goto(`${base}/`);
      }
    },

    reset: () => set(initialState)
  };
}

export const authStore = createAuthStore();
export const isAuthenticated = derived(authStore, $auth => $auth.isAuthenticated);
export const isReady = derived(authStore, $auth => $auth.isReady);
