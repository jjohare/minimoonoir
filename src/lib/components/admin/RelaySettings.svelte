<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getRelayUrls } from '$lib/nostr/relay';

  export let isPrivateMode: boolean;
  export let isSwitchingMode: boolean;

  const dispatch = createEventDispatcher<{
    modeChange: void;
  }>();

  function handleToggle() {
    dispatch('modeChange');
  }
</script>

<div class="card bg-base-200 mb-6">
  <div class="card-body">
    <h2 class="card-title">Relay Settings</h2>
    <p class="text-sm text-base-content/70 mb-4">
      Control whether the app connects only to your private relay or federates with the wider Nostr network.
    </p>

    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-4">
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-lg"
          bind:checked={isPrivateMode}
          on:change={handleToggle}
          disabled={isSwitchingMode}
        />
        <div>
          <span class="label-text font-semibold text-lg">
            {isPrivateMode ? 'Private Mode' : 'Federated Mode'}
          </span>
          <p class="text-sm text-base-content/60">
            {#if isPrivateMode}
              Only connected to local relay. Messages stay private.
            {:else}
              Connected to public Nostr relays. Messages are federated.
            {/if}
          </p>
        </div>
        {#if isSwitchingMode}
          <span class="loading loading-spinner loading-sm ml-2"></span>
        {/if}
      </label>
    </div>

    <div class="mt-4 p-3 bg-base-300 rounded-lg">
      <div class="text-sm font-medium mb-2">Active Relays:</div>
      <div class="flex flex-wrap gap-2">
        {#each getRelayUrls() as relay}
          <span class="badge badge-outline">{relay}</span>
        {/each}
      </div>
    </div>

    {#if !isPrivateMode}
      <div class="alert alert-warning mt-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Federated mode connects to public relays. Messages will be visible on the wider Nostr network.</span>
      </div>
    {/if}
  </div>
</div>
