<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { JoinRequest } from '$lib/nostr/groups';
  import UserDisplay from '$lib/components/user/UserDisplay.svelte';

  export let pendingChannelJoinRequests: JoinRequest[];
  export let isLoading: boolean;
  export let getChannelName: (channelId: string) => string;

  const dispatch = createEventDispatcher<{
    approve: JoinRequest;
    reject: JoinRequest;
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
        Pending Channel Join Requests
        {#if pendingChannelJoinRequests.length > 0}
          <span class="badge badge-info">{pendingChannelJoinRequests.length}</span>
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

    {#if isLoading && pendingChannelJoinRequests.length === 0}
      <div class="text-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
        <p class="mt-2 text-base-content/70">Loading channel join requests...</p>
      </div>
    {:else if pendingChannelJoinRequests.length === 0}
      <div class="text-center py-8 text-base-content/50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p>No pending channel join requests</p>
        <p class="text-sm mt-1">Users requesting to join specific channels will appear here</p>
      </div>
    {:else}
      <div class="overflow-x-auto mt-4">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>User</th>
              <th>Channel</th>
              <th>Message</th>
              <th>Requested</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each pendingChannelJoinRequests as request (request.id)}
              <tr>
                <td>
                  <UserDisplay
                    pubkey={request.pubkey}
                    showAvatar={true}
                    showName={true}
                    avatarSize="sm"
                    clickable={false}
                  />
                </td>
                <td>
                  <span class="badge badge-secondary">
                    # {getChannelName(request.channelId)}
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
                  <span class="text-sm">{formatRelativeTime(request.createdAt)}</span>
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
                      on:click={() => dispatch('reject', request)}
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
