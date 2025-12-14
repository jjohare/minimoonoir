<script lang="ts">
  import { onMount } from 'svelte';
  import { getAvatarUrl } from '$lib/utils/identicon';
  import { profileCache } from '$lib/stores/profiles';

  // For now, moderators are derived from admin pubkeys
  // In a full implementation, this would be fetched from relay
  export let moderators: Array<{
    pubkey: string;
    displayName: string;
    role: string;
  }> = [];

  // Admin pubkey from env
  const adminPubkey = import.meta.env.VITE_ADMIN_PUBKEY || '';

  interface ModDisplay {
    pubkey: string;
    displayName: string;
    role: string;
    avatar: string;
  }

  let displayMods: ModDisplay[] = [];

  onMount(async () => {
    if (moderators.length > 0) {
      // Prefetch provided moderator profiles
      await profileCache.prefetchProfiles(moderators.map(m => m.pubkey));
      displayMods = moderators.map(m => {
        const cached = profileCache.getCachedSync(m.pubkey);
        return {
          ...m,
          displayName: cached?.displayName || m.displayName,
          avatar: cached?.avatar || getAvatarUrl(m.pubkey, 80),
        };
      });
    } else if (adminPubkey) {
      // Use admin as default moderator
      const profile = await profileCache.getProfile(adminPubkey);
      displayMods = [{
        pubkey: adminPubkey,
        displayName: profile?.displayName || 'Admin',
        role: 'Administrator',
        avatar: profile?.avatar || getAvatarUrl(adminPubkey, 80),
      }];
    }
  });
</script>

<div class="card bg-base-200 shadow-lg">
  <div class="card-body p-4">
    <h3 class="card-title text-lg text-primary mb-3">Moderating Team</h3>

    <div class="space-y-3">
      {#each displayMods as mod}
        <div class="flex items-center gap-3">
          <div class="avatar">
            <div class="w-10 rounded-full">
              <img
                src={mod.avatar}
                alt={mod.displayName}
              />
            </div>
          </div>
          <div class="flex-1">
            <div class="font-medium text-sm">{mod.displayName}</div>
            <div class="text-xs text-base-content/60">{mod.role}</div>
          </div>
          <div class="badge badge-primary badge-sm">{mod.role.charAt(0)}</div>
        </div>
      {/each}
    </div>

    <div class="mt-3 pt-3 border-t border-base-300">
      <p class="text-xs text-base-content/50 text-center">
        Contact a moderator for help
      </p>
    </div>
  </div>
</div>
