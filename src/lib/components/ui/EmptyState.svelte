<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  export let icon = '';
  export let title = 'Nothing here yet';
  export let description = '';
  export let actionLabel = '';

  const dispatch = createEventDispatcher<{ action: void }>();
</script>

<div
  class="flex flex-col items-center justify-center py-12 px-4 text-center"
  in:fade={{ duration: 200 }}
>
  {#if icon}
    <div
      class="text-5xl mb-4"
      in:scale={{ duration: 300, delay: 100 }}
    >
      {icon}
    </div>
  {/if}

  <h3 class="text-lg font-semibold text-base-content mb-2">{title}</h3>

  {#if description}
    <p class="text-base-content/60 mb-6 max-w-sm">{description}</p>
  {/if}

  {#if actionLabel}
    <button
      class="btn btn-primary btn-sm"
      on:click={() => dispatch('action')}
    >
      {actionLabel}
    </button>
  {/if}
</div>
