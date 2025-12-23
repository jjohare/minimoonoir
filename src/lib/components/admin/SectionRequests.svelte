<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SectionAccessRequest } from '$lib/types/channel';
  import { SECTION_CONFIG } from '$lib/types/channel';
  import UserDisplay from '$lib/components/user/UserDisplay.svelte';

  export let pendingRequests: SectionAccessRequest[];
  export let isLoading: boolean;

  const dispatch = createEventDispatcher<{
    approve: SectionAccessRequest;
    deny: SectionAccessRequest;
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
        Pending Section Access Requests
        {#if pendingRequests.length > 0}
          <span class="badge badge-warning">{pendingRequests.length}</span>
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

    {#if isLoading && pendingRequests.length === 0}
      <div class="text-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
        <p class="mt-2 text-base-content/70">Loading pending requests...</p>
      </div>
    {:else if pendingRequests.length === 0}
      <div class="text-center py-8 text-base-content/50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>No pending section access requests</p>
        <p class="text-sm mt-1">New users requesting section access will appear here</p>
      </div>
    {:else}
      <div class="overflow-x-auto mt-4">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>User</th>
              <th>Section</th>
              <th>Message</th>
              <th>Requested</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each pendingRequests as request (request.id)}
              <tr>
                <td>
                  <UserDisplay
                    pubkey={request.requesterPubkey}
                    showAvatar={true}
                    showName={true}
                    avatarSize="sm"
                    clickable={false}
                  />
                </td>
                <td>
                  <span class="badge badge-primary">
                    {SECTION_CONFIG[request.section]?.icon || ''} {SECTION_CONFIG[request.section]?.name || request.section}
                  </span>
                </td>
                <td>
                  {#if request.message}
                    <span class="text-sm text-base-content/70 line-clamp-2">{request.message}</span>
                  {:else}
                    <span class="text-xs text-base-content/50">No message</span>
                  {/if}
                </td>
                <td>
                  <span class="text-sm">{formatRelativeTime(request.requestedAt)}</span>
                </td>
                <td>
                  <div class="flex justify-end gap-2">
                    <button
                      class="btn btn-success btn-sm"
                      on:click={() => dispatch('approve', request)}
                      disabled={isLoading}
                    >
                      Approve
                    </button>
                    <button
                      class="btn btn-error btn-sm btn-outline"
                      on:click={() => dispatch('deny', request)}
                      disabled={isLoading}
                    >
                      Deny
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
