<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { UserRegistrationRequest } from '$lib/nostr/groups';
  import UserDisplay from '$lib/components/user/UserDisplay.svelte';

  export let pendingUserRegistrations: UserRegistrationRequest[];
  export let isLoading: boolean;

  const dispatch = createEventDispatcher<{
    approve: UserRegistrationRequest;
    reject: UserRegistrationRequest;
    refresh: void;
  }>();

  function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }
</script>

<div class="card bg-base-200 mb-6">
  <div class="card-body">
    <div class="flex items-center justify-between">
      <h2 class="card-title">
        Pending User Registrations
        {#if pendingUserRegistrations.length > 0}
          <span class="badge badge-error">{pendingUserRegistrations.length}</span>
        {/if}
      </h2>
      <button
        class="btn btn-ghost btn-sm"
        on:click={() => dispatch('refresh')}
        disabled={isLoading}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>
    </div>

    {#if isLoading && pendingUserRegistrations.length === 0}
      <div class="text-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
        <p class="mt-2 text-base-content/70">Loading user registrations...</p>
      </div>
    {:else if pendingUserRegistrations.length === 0}
      <div class="text-center py-8 text-base-content/50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        <p>No pending user registrations</p>
        <p class="text-sm mt-1">New users signing up will appear here for approval</p>
      </div>
    {:else}
      <div class="overflow-x-auto mt-4">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>User</th>
              <th>Message</th>
              <th>Requested</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each pendingUserRegistrations as registration (registration.id)}
              <tr>
                <td>
                  <UserDisplay
                    pubkey={registration.pubkey}
                    showAvatar={true}
                    showName={true}
                    showFullName={true}
                    avatarSize="sm"
                    clickable={false}
                  />
                </td>
                <td>
                  {#if registration.message}
                    <span class="text-sm text-base-content/70 line-clamp-2">{registration.message}</span>
                  {:else}
                    <span class="text-xs text-base-content/50">No message</span>
                  {/if}
                </td>
                <td>
                  <span class="text-sm">{formatRelativeTime(registration.createdAt)}</span>
                </td>
                <td>
                  <div class="flex justify-end gap-2">
                    <button
                      class="btn btn-success btn-sm"
                      on:click={() => dispatch('approve', registration)}
                      disabled={isLoading}
                    >
                      Approve
                    </button>
                    <button
                      class="btn btn-error btn-sm btn-outline"
                      on:click={() => dispatch('reject', registration)}
                      disabled={isLoading}
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
