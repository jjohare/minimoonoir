<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CreatedChannel } from '$lib/nostr/channels';
  import type { ChannelSection } from '$lib/types/channel';
  import { SECTION_CONFIG } from '$lib/types/channel';

  export let channels: CreatedChannel[];
  export let isLoading: boolean;
  export let showCreateForm: boolean = false;

  // Form fields
  let formName = '';
  let formDescription = '';
  let formVisibility: 'public' | 'cohort' | 'private' = 'public';
  let formCohorts = '';
  let formEncrypted = false;
  let formSection: ChannelSection = 'Nostr-BBS-guests';

  const dispatch = createEventDispatcher<{
    create: {
      name: string;
      description?: string;
      visibility: 'public' | 'cohort' | 'private';
      cohorts: string[];
      encrypted: boolean;
      section: ChannelSection;
    };
  }>();

  function handleCreate() {
    const cohorts = formCohorts.split(',').map(c => c.trim()).filter(Boolean);

    dispatch('create', {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      visibility: formVisibility,
      cohorts,
      encrypted: formEncrypted,
      section: formSection,
    });

    // Reset form
    formName = '';
    formDescription = '';
    formVisibility = 'public';
    formCohorts = '';
    formEncrypted = false;
    formSection = 'Nostr-BBS-guests';
    showCreateForm = false;
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleDateString();
  }

  function getVisibilityBadge(visibility: string): string {
    const badges: Record<string, string> = {
      public: 'badge-success',
      cohort: 'badge-warning',
      private: 'badge-error',
    };
    return badges[visibility] || 'badge-ghost';
  }
</script>

<div class="card bg-base-200 mb-6">
  <div class="card-body">
    <div class="flex items-center justify-between">
      <h2 class="card-title">Channel Management</h2>
      <button
        class="btn btn-primary gap-2"
        on:click={() => showCreateForm = !showCreateForm}
        disabled={isLoading}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Create Channel
      </button>
    </div>

    <!-- Create Channel Form -->
    {#if showCreateForm}
      <div class="mt-4 p-4 bg-base-300 rounded-lg">
        <h3 class="font-semibold mb-4">New Channel</h3>

        <div class="form-control mb-3">
          <label class="label">
            <span class="label-text">Channel Name *</span>
          </label>
          <input
            type="text"
            placeholder="Enter channel name"
            class="input input-bordered"
            bind:value={formName}
          />
        </div>

        <div class="form-control mb-3">
          <label class="label">
            <span class="label-text">Description</span>
          </label>
          <textarea
            class="textarea textarea-bordered"
            placeholder="Channel description (optional)"
            rows="2"
            bind:value={formDescription}
          ></textarea>
        </div>

        <div class="form-control mb-3">
          <label class="label">
            <span class="label-text">Section (Area)</span>
          </label>
          <select class="select select-bordered" bind:value={formSection}>
            {#each Object.entries(SECTION_CONFIG) as [key, config]}
              <option value={key}>{config.icon} {config.name}</option>
            {/each}
          </select>
          <label class="label">
            <span class="label-text-alt text-base-content/60">
              {SECTION_CONFIG[formSection]?.description || ''}
            </span>
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Visibility</span>
            </label>
            <select class="select select-bordered" bind:value={formVisibility}>
              <option value="public">Public</option>
              <option value="cohort">Cohort Only</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Cohorts (comma-separated)</span>
            </label>
            <input
              type="text"
              placeholder="e.g., 2024, 2025"
              class="input input-bordered"
              bind:value={formCohorts}
            />
          </div>
        </div>

        <div class="form-control mb-4">
          <label class="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              class="toggle toggle-primary"
              bind:checked={formEncrypted}
            />
            <span class="label-text">Encrypted Messages</span>
          </label>
        </div>

        <div class="flex justify-end gap-2">
          <button class="btn btn-ghost" on:click={() => showCreateForm = false}>
            Cancel
          </button>
          <button
            class="btn btn-primary"
            on:click={handleCreate}
            disabled={isLoading || !formName.trim()}
          >
            {#if isLoading}
              <span class="loading loading-spinner loading-sm"></span>
            {/if}
            Create Channel
          </button>
        </div>
      </div>
    {/if}

    <!-- Channels List -->
    <div class="mt-4">
      {#if isLoading && channels.length === 0}
        <div class="text-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
          <p class="mt-2 text-base-content/70">Loading channels...</p>
        </div>
      {:else if channels.length === 0}
        <div class="text-center py-8 text-base-content/50">
          <p>No channels yet. Create your first channel above.</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each channels as channel (channel.id)}
            <div class="card bg-base-300">
              <div class="card-body p-4">
                <h3 class="font-semibold">{channel.name}</h3>
                {#if channel.description}
                  <p class="text-sm text-base-content/70 line-clamp-2">{channel.description}</p>
                {/if}
                <div class="flex flex-wrap gap-1 mt-2">
                  <span class="badge badge-neutral badge-sm" title="Section">
                    {SECTION_CONFIG[channel.section]?.icon || '👋'} {SECTION_CONFIG[channel.section]?.name || 'Guest Area'}
                  </span>
                  <span class="badge {getVisibilityBadge(channel.visibility)} badge-sm">
                    {channel.visibility}
                  </span>
                  {#if channel.encrypted}
                    <span class="badge badge-info badge-sm">Encrypted</span>
                  {/if}
                  {#each channel.cohorts as cohort}
                    <span class="badge badge-outline badge-sm">{cohort}</span>
                  {/each}
                </div>
                <div class="text-xs text-base-content/50 mt-2">
                  Created {formatTimestamp(channel.createdAt)}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
