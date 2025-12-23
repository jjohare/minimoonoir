<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import { whitelistStatusStore } from '$lib/stores/user';
  import { verifyWhitelistStatus } from '$lib/nostr/whitelist';
  import { ndk, connectRelay, isConnected, reconnectRelay } from '$lib/nostr/relay';
  import { RELAY_URL } from '$lib/config';
  import { createChannel, fetchChannels, type CreatedChannel } from '$lib/nostr/channels';
  import { settingsStore } from '$lib/stores/settings';
  import type { ChannelSection, SectionAccessRequest } from '$lib/types/channel';
  import { SECTION_CONFIG } from '$lib/types/channel';
  import { sectionStore } from '$lib/stores/sections';
  import { subscribeAccessRequests, approveSectionAccess } from '$lib/nostr/sections';
  import { KIND_JOIN_REQUEST, KIND_ADD_USER, KIND_DELETION, KIND_USER_REGISTRATION, type JoinRequest, type UserRegistrationRequest } from '$lib/nostr/groups';
  import { approveUserRegistration } from '$lib/nostr/whitelist';
  import { NDKEvent, type NDKSubscription, type NDKFilter } from '@nostr-dev-kit/ndk';
  import { channelStore } from '$lib/stores/channelStore';

  // Component imports
  import AdminStats from '$lib/components/admin/AdminStats.svelte';
  import RelaySettings from '$lib/components/admin/RelaySettings.svelte';
  import ChannelManagement from '$lib/components/admin/ChannelManagement.svelte';
  import UserRegistrations from '$lib/components/admin/UserRegistrations.svelte';
  import SectionRequests from '$lib/components/admin/SectionRequests.svelte';
  import ChannelJoinRequests from '$lib/components/admin/ChannelJoinRequests.svelte';
  import QuickActions from '$lib/components/admin/QuickActions.svelte';

  // State
  let pendingRequests: SectionAccessRequest[] = [];
  let pendingChannelJoinRequests: JoinRequest[] = [];
  let pendingUserRegistrations: UserRegistrationRequest[] = [];
  let requestSubscription: NDKSubscription | null = null;
  let joinRequestSubscription: NDKSubscription | null = null;
  let registrationSubscription: NDKSubscription | null = null;

  let stats = {
    totalUsers: 0,
    totalChannels: 0,
    totalMessages: 0,
    pendingApprovals: 0
  };

  $: stats.pendingApprovals = pendingRequests.length + pendingChannelJoinRequests.length + pendingUserRegistrations.length;

  let channels: CreatedChannel[] = [];
  let isLoading = false;
  let error: string | null = null;
  let successMessage: string | null = null;
  let relayStatus = 'disconnected';

  // Relay settings
  let isPrivateMode = $settingsStore.relayMode === 'private';
  let isSwitchingMode = false;

  async function handleRelayModeChange() {
    isSwitchingMode = true;
    const newMode = isPrivateMode ? 'private' : 'federated';
    settingsStore.setRelayMode(newMode);

    try {
      await reconnectRelay();
      if ($authStore.privateKey) {
        await connectRelay(RELAY_URL, $authStore.privateKey);
      }
      relayStatus = 'connected';
    } catch (e) {
      console.error('Failed to reconnect:', e);
      relayStatus = 'error';
    } finally {
      isSwitchingMode = false;
    }
  }

  async function initializeAdmin() {
    if (!$authStore.privateKey) {
      error = 'Please login first to access admin features';
      return;
    }

    try {
      isLoading = true;
      error = null;

      if (!isConnected()) {
        await connectRelay(RELAY_URL, $authStore.privateKey);
      }
      relayStatus = 'connected';

      channels = await fetchChannels();
      stats.totalChannels = channels.length;

      await loadPendingRequests();
      await loadChannelJoinRequests();
      await loadUserRegistrations();

      requestSubscription = subscribeAccessRequests((request) => {
        if (!pendingRequests.find(r => r.id === request.id)) {
          pendingRequests = [request, ...pendingRequests];
        }
      });

      joinRequestSubscription = subscribeChannelJoinRequests();
      registrationSubscription = subscribeUserRegistrations();

    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to initialize admin';
      relayStatus = 'error';
    } finally {
      isLoading = false;
    }
  }

  async function loadPendingRequests() {
    try {
      const { fetchPendingRequests } = await import('$lib/nostr/sections');
      pendingRequests = await fetchPendingRequests();
    } catch (e) {
      console.error('Failed to load pending requests:', e);
    }
  }

  async function loadChannelJoinRequests() {
    try {
      const ndkInstance = ndk();
      if (!ndkInstance) return;

      const filter: NDKFilter = { kinds: [KIND_JOIN_REQUEST], limit: 100 };
      const events = await ndkInstance.fetchEvents(filter);

      const approvalFilter: NDKFilter = { kinds: [KIND_ADD_USER], limit: 500 };
      const approvalEvents = await ndkInstance.fetchEvents(approvalFilter);

      const approvedSet = new Set<string>();
      for (const event of approvalEvents) {
        const channelId = event.tags.find(t => t[0] === 'h')?.[1];
        const userPubkey = event.tags.find(t => t[0] === 'p')?.[1];
        if (channelId && userPubkey) {
          approvedSet.add(`${channelId}:${userPubkey}`);
        }
      }

      const deletionFilter: NDKFilter = { kinds: [KIND_DELETION], limit: 500 };
      const deletionEvents = await ndkInstance.fetchEvents(deletionFilter);
      const deletedRequestIds = new Set<string>();
      for (const event of deletionEvents) {
        const deletedIds = event.tags.filter(t => t[0] === 'e').map(t => t[1]);
        deletedIds.forEach(id => deletedRequestIds.add(id));
      }

      const requests: JoinRequest[] = [];
      for (const event of events) {
        if (deletedRequestIds.has(event.id)) continue;

        const channelId = event.tags.find(t => t[0] === 'h')?.[1] || '';
        if (approvedSet.has(`${channelId}:${event.pubkey}`)) continue;

        requests.push({
          id: event.id,
          pubkey: event.pubkey,
          channelId,
          createdAt: (event.created_at || 0) * 1000,
          status: 'pending',
          message: event.content || undefined
        });
      }

      requests.sort((a, b) => b.createdAt - a.createdAt);
      pendingChannelJoinRequests = requests;

      if (import.meta.env.DEV) {
        console.log('[Admin] Loaded channel join requests:', requests.length);
      }
    } catch (e) {
      console.error('Failed to load channel join requests:', e);
    }
  }

  function subscribeChannelJoinRequests(): NDKSubscription | null {
    try {
      const ndkInstance = ndk();
      if (!ndkInstance) return null;

      const filter: NDKFilter = {
        kinds: [KIND_JOIN_REQUEST],
        since: Math.floor(Date.now() / 1000)
      };

      const sub = ndkInstance.subscribe(filter, { closeOnEose: false });

      sub.on('event', (event: NDKEvent) => {
        const channelId = event.tags.find(t => t[0] === 'h')?.[1] || '';

        const newRequest: JoinRequest = {
          id: event.id,
          pubkey: event.pubkey,
          channelId,
          createdAt: (event.created_at || 0) * 1000,
          status: 'pending',
          message: event.content || undefined
        };

        if (!pendingChannelJoinRequests.find(r => r.id === newRequest.id)) {
          pendingChannelJoinRequests = [newRequest, ...pendingChannelJoinRequests];
        }
      });

      return sub;
    } catch (e) {
      console.error('Failed to subscribe to channel join requests:', e);
      return null;
    }
  }

  async function loadUserRegistrations() {
    try {
      const ndkInstance = ndk();
      if (!ndkInstance) return;

      const filter: NDKFilter = {
        kinds: [KIND_USER_REGISTRATION as number],
        limit: 100
      };

      const events = await ndkInstance.fetchEvents(filter);

      const deletionFilter: NDKFilter = { kinds: [KIND_DELETION], limit: 500 };
      const deletionEvents = await ndkInstance.fetchEvents(deletionFilter);
      const deletedRequestIds = new Set<string>();
      for (const event of deletionEvents) {
        const deletedIds = event.tags.filter(t => t[0] === 'e').map(t => t[1]);
        deletedIds.forEach(id => deletedRequestIds.add(id));
      }

      const registrations: UserRegistrationRequest[] = [];
      for (const event of events) {
        if (deletedRequestIds.has(event.id)) continue;

        const displayNameTag = event.tags.find(t => t[0] === 'name');

        registrations.push({
          id: event.id,
          pubkey: event.pubkey,
          createdAt: (event.created_at || 0) * 1000,
          status: 'pending',
          displayName: displayNameTag?.[1] || undefined,
          message: event.content || undefined
        });
      }

      registrations.sort((a, b) => b.createdAt - a.createdAt);
      pendingUserRegistrations = registrations;

      if (import.meta.env.DEV) {
        console.log('[Admin] Loaded user registrations:', registrations.length);
      }
    } catch (e) {
      console.error('Failed to load user registrations:', e);
    }
  }

  function subscribeUserRegistrations(): NDKSubscription | null {
    try {
      const ndkInstance = ndk();
      if (!ndkInstance) return null;

      const filter: NDKFilter = {
        kinds: [KIND_USER_REGISTRATION as number],
        since: Math.floor(Date.now() / 1000)
      };

      const sub = ndkInstance.subscribe(filter, { closeOnEose: false });

      sub.on('event', (event: NDKEvent) => {
        const displayNameTag = event.tags.find(t => t[0] === 'name');

        const newRegistration: UserRegistrationRequest = {
          id: event.id,
          pubkey: event.pubkey,
          createdAt: (event.created_at || 0) * 1000,
          status: 'pending',
          displayName: displayNameTag?.[1] || undefined,
          message: event.content || undefined
        };

        if (!pendingUserRegistrations.find(r => r.id === newRegistration.id)) {
          pendingUserRegistrations = [newRegistration, ...pendingUserRegistrations];
        }
      });

      return sub;
    } catch (e) {
      console.error('Failed to subscribe to user registrations:', e);
      return null;
    }
  }

  async function handleApproveUserRegistration(registration: UserRegistrationRequest) {
    try {
      isLoading = true;
      error = null;
      successMessage = null;

      const result = await approveUserRegistration(registration.pubkey, $authStore.publicKey || '');

      if (!result.success) {
        console.warn('[Admin] Whitelist API failed:', result.error);
      }

      const ndkInstance = ndk();
      if (!ndkInstance || !ndkInstance.signer) {
        throw new Error('No signer available');
      }

      const deleteEvent = new NDKEvent(ndkInstance);
      deleteEvent.kind = KIND_DELETION;
      deleteEvent.tags = [['e', registration.id]];
      deleteEvent.content = 'Approved';
      await deleteEvent.publish();

      pendingUserRegistrations = pendingUserRegistrations.filter(r => r.id !== registration.id);

      successMessage = `Approved user registration. User can now access the system.`;
      setTimeout(() => { successMessage = null; }, 5000);

      if (import.meta.env.DEV) {
        console.log('[Admin] Approved user registration:', registration.pubkey.slice(0, 8) + '...');
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to approve registration';
    } finally {
      isLoading = false;
    }
  }

  async function handleRejectUserRegistration(registration: UserRegistrationRequest) {
    try {
      isLoading = true;
      error = null;

      const ndkInstance = ndk();
      if (!ndkInstance || !ndkInstance.signer) {
        throw new Error('No signer available');
      }

      const deleteEvent = new NDKEvent(ndkInstance);
      deleteEvent.kind = KIND_DELETION;
      deleteEvent.tags = [['e', registration.id]];
      deleteEvent.content = 'Rejected by admin';
      await deleteEvent.publish();

      pendingUserRegistrations = pendingUserRegistrations.filter(r => r.id !== registration.id);

      if (import.meta.env.DEV) {
        console.log('[Admin] Rejected user registration:', registration.id);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to reject registration';
    } finally {
      isLoading = false;
    }
  }

  async function handleApproveRequest(request: SectionAccessRequest) {
    try {
      isLoading = true;
      error = null;
      successMessage = null;
      const result = await approveSectionAccess(request);
      if (result.success) {
        pendingRequests = pendingRequests.filter(r => r.id !== request.id);
        const sectionName = SECTION_CONFIG[request.section]?.name || request.section;
        successMessage = `Approved access to ${sectionName}. User has been notified.`;
        setTimeout(() => { successMessage = null; }, 5000);
      } else {
        error = result.error || 'Failed to approve request';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to approve request';
    } finally {
      isLoading = false;
    }
  }

  async function handleDenyRequest(request: SectionAccessRequest) {
    try {
      isLoading = true;
      await sectionStore.denyRequest(request, 'Access denied by admin');
      pendingRequests = pendingRequests.filter(r => r.id !== request.id);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to deny request';
    } finally {
      isLoading = false;
    }
  }

  async function handleApproveChannelJoin(request: JoinRequest) {
    try {
      isLoading = true;
      error = null;
      successMessage = null;

      const ndkInstance = ndk();
      if (!ndkInstance || !ndkInstance.signer) {
        throw new Error('No signer available');
      }

      const addUserEvent = new NDKEvent(ndkInstance);
      addUserEvent.kind = KIND_ADD_USER;
      addUserEvent.tags = [
        ['h', request.channelId],
        ['p', request.pubkey]
      ];
      addUserEvent.content = '';
      await addUserEvent.publish();

      const deleteEvent = new NDKEvent(ndkInstance);
      deleteEvent.kind = KIND_DELETION;
      deleteEvent.tags = [['e', request.id]];
      deleteEvent.content = 'Approved';
      await deleteEvent.publish();

      channelStore.approveMember(request.channelId, request.pubkey);
      pendingChannelJoinRequests = pendingChannelJoinRequests.filter(r => r.id !== request.id);

      const channel = channels.find(c => c.id === request.channelId);
      const channelName = channel?.name || request.channelId.slice(0, 8) + '...';

      successMessage = `Approved join request for channel "${channelName}". User has been added.`;
      setTimeout(() => { successMessage = null; }, 5000);

      if (import.meta.env.DEV) {
        console.log('[Admin] Approved channel join request:', {
          channelId: request.channelId,
          user: request.pubkey.slice(0, 8) + '...'
        });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to approve join request';
    } finally {
      isLoading = false;
    }
  }

  async function handleRejectChannelJoin(request: JoinRequest) {
    try {
      isLoading = true;
      error = null;

      const ndkInstance = ndk();
      if (!ndkInstance || !ndkInstance.signer) {
        throw new Error('No signer available');
      }

      const deleteEvent = new NDKEvent(ndkInstance);
      deleteEvent.kind = KIND_DELETION;
      deleteEvent.tags = [['e', request.id]];
      deleteEvent.content = 'Rejected by admin';
      await deleteEvent.publish();

      pendingChannelJoinRequests = pendingChannelJoinRequests.filter(r => r.id !== request.id);

      if (import.meta.env.DEV) {
        console.log('[Admin] Rejected channel join request:', request.id);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to reject join request';
    } finally {
      isLoading = false;
    }
  }

  function getChannelName(channelId: string): string {
    const channel = channels.find(c => c.id === channelId);
    return channel?.name || channelId.slice(0, 12) + '...';
  }

  async function handleCreateChannel(event: CustomEvent) {
    try {
      isLoading = true;
      error = null;

      const newChannel = await createChannel(event.detail);
      channels = [newChannel, ...channels];
      stats.totalChannels = channels.length;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create channel';
    } finally {
      isLoading = false;
    }
  }

  onMount(async () => {
    await authStore.waitForReady();

    if (!$authStore.publicKey) {
      goto(`${base}/chat`);
      return;
    }

    try {
      isLoading = true;
      const status = await verifyWhitelistStatus($authStore.publicKey);
      whitelistStatusStore.set(status);

      if (!status.isAdmin) {
        error = 'Access denied: Admin privileges required';
        setTimeout(() => goto(`${base}/chat`), 2000);
        return;
      }

      initializeAdmin();
    } catch (e) {
      error = 'Failed to verify admin status';
      setTimeout(() => goto(`${base}/chat`), 2000);
    }
  });

  onDestroy(() => {
    if (requestSubscription) {
      requestSubscription.stop();
      requestSubscription = null;
    }
    if (joinRequestSubscription) {
      joinRequestSubscription.stop();
      joinRequestSubscription = null;
    }
    if (registrationSubscription) {
      registrationSubscription.stop();
      registrationSubscription = null;
    }
  });
</script>

<svelte:head>
  <title>Admin Dashboard - Nostr-BBS</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-6xl">
  <div class="mb-6">
    <h1 class="text-4xl font-bold gradient-text mb-2">Admin Dashboard</h1>
    <p class="text-base-content/70">System overview and management</p>
    <div class="mt-2 flex items-center gap-2">
      <span class="badge {relayStatus === 'connected' ? 'badge-success' : relayStatus === 'error' ? 'badge-error' : 'badge-warning'}">
        {relayStatus}
      </span>
      <span class="text-sm text-base-content/50">Relay Status</span>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{error}</span>
      <button class="btn btn-ghost btn-sm" on:click={() => error = null}>Dismiss</button>
    </div>
  {/if}

  {#if successMessage}
    <div class="alert alert-success mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{successMessage}</span>
      <button class="btn btn-ghost btn-sm" on:click={() => successMessage = null}>Dismiss</button>
    </div>
  {/if}

  <AdminStats {stats} />

  <RelaySettings bind:isPrivateMode {isSwitchingMode} on:modeChange={handleRelayModeChange} />

  <ChannelManagement {channels} {isLoading} on:create={handleCreateChannel} />

  <UserRegistrations
    {pendingUserRegistrations}
    {isLoading}
    on:approve={(e) => handleApproveUserRegistration(e.detail)}
    on:reject={(e) => handleRejectUserRegistration(e.detail)}
    on:refresh={loadUserRegistrations}
  />

  <SectionRequests
    {pendingRequests}
    {isLoading}
    on:approve={(e) => handleApproveRequest(e.detail)}
    on:deny={(e) => handleDenyRequest(e.detail)}
    on:refresh={loadPendingRequests}
  />

  <ChannelJoinRequests
    {pendingChannelJoinRequests}
    {isLoading}
    {getChannelName}
    on:approve={(e) => handleApproveChannelJoin(e.detail)}
    on:reject={(e) => handleRejectChannelJoin(e.detail)}
    on:refresh={loadChannelJoinRequests}
  />

  <QuickActions />
</div>
