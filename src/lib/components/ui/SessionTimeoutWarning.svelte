<script lang="ts">
  /**
   * SessionTimeoutWarning - Modal warning when session is about to expire
   *
   * Shows countdown and allows user to extend session or logout immediately.
   */
  import { sessionStore, formatRemainingTime } from '$lib/stores/session';
  import { authStore } from '$lib/stores/auth';

  $: showWarning = $sessionStore.showWarning;
  $: remainingTime = formatRemainingTime($sessionStore.remainingMs);

  function handleExtend() {
    sessionStore.extend();
  }

  function handleLogout() {
    authStore.logout();
  }
</script>

{#if showWarning}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Session Expiring Soon
      </h3>

      <div class="py-4">
        <p class="text-base-content/80 mb-4">
          Your session will expire due to inactivity.
        </p>

        <div class="alert alert-warning mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="font-mono text-lg">{remainingTime}</span>
        </div>

        <p class="text-sm text-base-content/60">
          Click "Stay Logged In" to continue your session, or you'll be automatically logged out.
        </p>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" on:click={handleLogout}>
          Logout Now
        </button>
        <button class="btn btn-primary" on:click={handleExtend}>
          Stay Logged In
        </button>
      </div>
    </div>
    <div class="modal-backdrop bg-black/50"></div>
  </div>
{/if}
