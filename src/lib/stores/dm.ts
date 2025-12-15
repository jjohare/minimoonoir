import { writable, derived, get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { receiveDM, sendDM, createDMFilter, type DMContent, type Relay } from '$lib/nostr/dm';
import { authStore } from './auth';
import { getPublicKey } from 'nostr-tools';
import { muteStore } from './mute';

/**
 * DM Conversation with another user
 */
export interface DMConversation {
  /** Other party's public key */
  pubkey: string;
  /** Display name or shortened pubkey */
  name: string;
  /** Avatar URL if available */
  avatar?: string;
  /** Last message preview */
  lastMessage: string;
  /** Last message timestamp */
  lastMessageTimestamp: number;
  /** Unread message count */
  unreadCount: number;
  /** Whether this conversation is pinned */
  isPinned: boolean;
}

/**
 * Individual DM message
 */
export interface DMMessage {
  /** Unique message ID */
  id: string;
  /** Sender's public key */
  senderPubkey: string;
  /** Recipient's public key */
  recipientPubkey: string;
  /** Message content */
  content: string;
  /** Message timestamp */
  timestamp: number;
  /** Whether message was sent by current user */
  isSent: boolean;
  /** Whether message has been read */
  isRead: boolean;
}

/**
 * DM store state
 */
export interface DMState {
  /** All conversations indexed by pubkey */
  conversations: Map<string, DMConversation>;
  /** Currently selected conversation pubkey */
  currentConversation: string | null;
  /** Messages for current conversation */
  messages: DMMessage[];
  /** Whether DMs are being loaded */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether real-time subscription is active */
  isSubscribed: boolean;
}

/**
 * Initial DM state
 */
const initialState: DMState = {
  conversations: new Map(),
  currentConversation: null,
  messages: [],
  isLoading: false,
  error: null,
  isSubscribed: false
};

/**
 * Creates the DM store with actions
 */
function createDMStore() {
  const { subscribe, set, update } = writable<DMState>(initialState);

  return {
    subscribe,

    /**
     * Fetch conversations and decrypt DMs from relay
     */
    fetchConversations: async (relay: Relay, userPrivkey: Uint8Array): Promise<void> => {
      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        const userPubkey = getPublicKey(userPrivkey);
        const filter = createDMFilter(userPubkey);

        // Fetch DM events from relay using NDK
        const { getNDK } = await import('$lib/nostr/ndk');
        const ndk = getNDK();
        await ndk.connect();

        const dmEvents = await ndk.fetchEvents(filter);
        const events: Event[] = Array.from(dmEvents).map(ndkEvent => ({
          id: ndkEvent.id,
          kind: ndkEvent.kind!,
          pubkey: ndkEvent.pubkey,
          created_at: ndkEvent.created_at!,
          tags: ndkEvent.tags,
          content: ndkEvent.content,
          sig: ndkEvent.sig!
        }));

        const conversationsMap = new Map<string, DMConversation>();
        const allMessages: Map<string, DMMessage[]> = new Map();

        // Process each gift-wrapped DM
        for (const event of events) {
          const dm = receiveDM(event, userPrivkey);
          if (!dm) continue;

          const otherPubkey = dm.senderPubkey;
          const message: DMMessage = {
            id: event.id,
            senderPubkey: dm.senderPubkey,
            recipientPubkey: userPubkey,
            content: dm.content,
            timestamp: dm.timestamp,
            isSent: false,
            isRead: false
          };

          // Add to messages map
          if (!allMessages.has(otherPubkey)) {
            allMessages.set(otherPubkey, []);
          }
          allMessages.get(otherPubkey)!.push(message);

          // Update or create conversation
          const existing = conversationsMap.get(otherPubkey);
          if (!existing || dm.timestamp > existing.lastMessageTimestamp) {
            conversationsMap.set(otherPubkey, {
              pubkey: otherPubkey,
              name: formatPubkey(otherPubkey),
              lastMessage: dm.content.substring(0, 50) + (dm.content.length > 50 ? '...' : ''),
              lastMessageTimestamp: dm.timestamp,
              unreadCount: (existing?.unreadCount ?? 0) + 1,
              isPinned: existing?.isPinned ?? false
            });
          }
        }

        // Store messages in browser storage for later retrieval
        if (typeof window !== 'undefined') {
          const messagesObj: Record<string, DMMessage[]> = {};
          allMessages.forEach((msgs, pubkey) => {
            messagesObj[pubkey] = msgs;
          });
          localStorage.setItem('dm_messages', JSON.stringify(messagesObj));
        }

        update(state => ({
          ...state,
          conversations: conversationsMap,
          isLoading: false
        }));
      } catch (error) {
        update(state => ({
          ...state,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch conversations'
        }));
      }
    },

    /**
     * Select a conversation and load its messages
     */
    selectConversation: (pubkey: string): void => {
      update(state => {
        const conversation = state.conversations.get(pubkey);
        if (!conversation) return state;

        // Mark all messages as read
        const updatedConversation = { ...conversation, unreadCount: 0 };
        const updatedConversations = new Map(state.conversations);
        updatedConversations.set(pubkey, updatedConversation);

        // Load messages from storage
        let messages: DMMessage[] = [];
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('dm_messages');
          if (stored) {
            try {
              const allMessages: Record<string, DMMessage[]> = JSON.parse(stored);
              messages = allMessages[pubkey] || [];
              // Sort by timestamp
              messages.sort((a, b) => a.timestamp - b.timestamp);
            } catch (e) {
              console.error('Failed to load messages:', e);
            }
          }
        }

        return {
          ...state,
          currentConversation: pubkey,
          conversations: updatedConversations,
          messages
        };
      });
    },

    /**
     * Send a DM to the current conversation
     */
    sendDM: async (
      content: string,
      relay: Relay,
      userPrivkey: Uint8Array
    ): Promise<void> => {
      const currentState = get({ subscribe });
      const recipientPubkey = currentState.currentConversation;

      if (!recipientPubkey) {
        throw new Error('No conversation selected');
      }

      try {
        const userPubkey = getPublicKey(userPrivkey);

        // Send the gift-wrapped DM using NDK-compatible relay
        const { getNDK } = await import('$lib/nostr/ndk');
        const ndk = getNDK();
        await ndk.connect();

        const ndkRelay = {
          publish: async (event: Event) => {
            const NDKEvent = (await import('@nostr-dev-kit/ndk')).NDKEvent;
            const ndkEvent = new NDKEvent(ndk, event);
            await ndkEvent.publish();
          }
        };

        await sendDM(content, recipientPubkey, userPrivkey, ndkRelay);

        // Add to local messages immediately (optimistic update)
        const newMessage: DMMessage = {
          id: `temp-${Date.now()}`,
          senderPubkey: userPubkey,
          recipientPubkey,
          content,
          timestamp: Math.floor(Date.now() / 1000),
          isSent: true,
          isRead: true
        };

        update(state => {
          const updatedMessages = [...state.messages, newMessage];

          // Update conversation last message
          const conversation = state.conversations.get(recipientPubkey);
          if (conversation) {
            const updatedConversation: DMConversation = {
              ...conversation,
              lastMessage: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
              lastMessageTimestamp: newMessage.timestamp
            };
            const updatedConversations = new Map(state.conversations);
            updatedConversations.set(recipientPubkey, updatedConversation);

            // Update localStorage
            if (typeof window !== 'undefined') {
              const stored = localStorage.getItem('dm_messages');
              let allMessages: Record<string, DMMessage[]> = {};
              if (stored) {
                try {
                  allMessages = JSON.parse(stored);
                } catch (e) {
                  console.error('Failed to parse stored messages:', e);
                }
              }
              allMessages[recipientPubkey] = updatedMessages;
              localStorage.setItem('dm_messages', JSON.stringify(allMessages));
            }

            return {
              ...state,
              conversations: updatedConversations,
              messages: updatedMessages
            };
          }

          return { ...state, messages: updatedMessages };
        });
      } catch (error) {
        update(state => ({
          ...state,
          error: error instanceof Error ? error.message : 'Failed to send message'
        }));
        throw error;
      }
    },

    /**
     * Start a new conversation
     */
    startConversation: (pubkey: string, name?: string): void => {
      update(state => {
        const existing = state.conversations.get(pubkey);
        if (existing) {
          // Already exists, just select it
          return {
            ...state,
            currentConversation: pubkey,
            messages: []
          };
        }

        // Create new conversation
        const newConversation: DMConversation = {
          pubkey,
          name: name ?? formatPubkey(pubkey),
          lastMessage: '',
          lastMessageTimestamp: 0,
          unreadCount: 0,
          isPinned: false
        };

        const updatedConversations = new Map(state.conversations);
        updatedConversations.set(pubkey, newConversation);

        return {
          ...state,
          conversations: updatedConversations,
          currentConversation: pubkey,
          messages: []
        };
      });
    },

    /**
     * Subscribe to real-time DMs
     */
    subscribeToIncoming: async (userPrivkey: Uint8Array): Promise<() => void> => {
      const userPubkey = getPublicKey(userPrivkey);
      const filter = createDMFilter(userPubkey);

      const { getNDK } = await import('$lib/nostr/ndk');
      const ndk = getNDK();
      await ndk.connect();

      const subscription = ndk.subscribe(filter, { closeOnEose: false });

      subscription.on('event', (ndkEvent: import('@nostr-dev-kit/ndk').NDKEvent) => {
        const event: Event = {
          id: ndkEvent.id,
          kind: ndkEvent.kind!,
          pubkey: ndkEvent.pubkey,
          created_at: ndkEvent.created_at!,
          tags: ndkEvent.tags,
          content: ndkEvent.content,
          sig: ndkEvent.sig!
        };

        // Handle the incoming DM
        const dm = receiveDM(event, userPrivkey);
        if (dm) {
          const otherPubkey = dm.senderPubkey;

          update(state => {
            const newMessage: DMMessage = {
              id: event.id,
              senderPubkey: dm.senderPubkey,
              recipientPubkey: userPubkey,
              content: dm.content,
              timestamp: dm.timestamp,
              isSent: false,
              isRead: state.currentConversation === otherPubkey
            };

            // Update messages if this conversation is open
            const updatedMessages = state.currentConversation === otherPubkey
              ? [...state.messages, newMessage]
              : state.messages;

            // Update localStorage
            if (typeof window !== 'undefined') {
              const stored = localStorage.getItem('dm_messages');
              let allMessages: Record<string, DMMessage[]> = {};
              if (stored) {
                try {
                  allMessages = JSON.parse(stored);
                } catch (e) {
                  console.error('Failed to parse stored messages:', e);
                }
              }
              if (!allMessages[otherPubkey]) {
                allMessages[otherPubkey] = [];
              }
              allMessages[otherPubkey].push(newMessage);
              localStorage.setItem('dm_messages', JSON.stringify(allMessages));
            }

            // Update conversation
            const conversation = state.conversations.get(otherPubkey);
            const updatedConversation: DMConversation = conversation
              ? {
                  ...conversation,
                  lastMessage: dm.content.substring(0, 50) + (dm.content.length > 50 ? '...' : ''),
                  lastMessageTimestamp: dm.timestamp,
                  unreadCount: state.currentConversation === otherPubkey
                    ? conversation.unreadCount
                    : conversation.unreadCount + 1
                }
              : {
                  pubkey: otherPubkey,
                  name: formatPubkey(otherPubkey),
                  lastMessage: dm.content.substring(0, 50) + (dm.content.length > 50 ? '...' : ''),
                  lastMessageTimestamp: dm.timestamp,
                  unreadCount: 1,
                  isPinned: false
                };

            const updatedConversations = new Map(state.conversations);
            updatedConversations.set(otherPubkey, updatedConversation);

            return {
              ...state,
              conversations: updatedConversations,
              messages: updatedMessages,
              isSubscribed: true
            };
          });
        }
      });

      update(state => ({ ...state, isSubscribed: true }));

      // Return unsubscribe function
      return () => {
        subscription.stop();
        update(state => ({ ...state, isSubscribed: false }));
      };
    },

    /**
     * Handle incoming DM event
     */
    handleIncomingDM: (event: Event, userPrivkey: Uint8Array): void => {
      const dm = receiveDM(event, userPrivkey);
      if (!dm) return;

      const userPubkey = getPublicKey(userPrivkey);
      const otherPubkey = dm.senderPubkey;

      update(state => {
        const newMessage: DMMessage = {
          id: event.id,
          senderPubkey: dm.senderPubkey,
          recipientPubkey: userPubkey,
          content: dm.content,
          timestamp: dm.timestamp,
          isSent: false,
          isRead: state.currentConversation === otherPubkey
        };

        // Update messages if this conversation is open
        const updatedMessages = state.currentConversation === otherPubkey
          ? [...state.messages, newMessage]
          : state.messages;

        // Update conversation
        const conversation = state.conversations.get(otherPubkey);
        const updatedConversation: DMConversation = conversation
          ? {
              ...conversation,
              lastMessage: dm.content.substring(0, 50) + (dm.content.length > 50 ? '...' : ''),
              lastMessageTimestamp: dm.timestamp,
              unreadCount: state.currentConversation === otherPubkey
                ? conversation.unreadCount
                : conversation.unreadCount + 1
            }
          : {
              pubkey: otherPubkey,
              name: formatPubkey(otherPubkey),
              lastMessage: dm.content.substring(0, 50) + (dm.content.length > 50 ? '...' : ''),
              lastMessageTimestamp: dm.timestamp,
              unreadCount: 1,
              isPinned: false
            };

        const updatedConversations = new Map(state.conversations);
        updatedConversations.set(otherPubkey, updatedConversation);

        return {
          ...state,
          conversations: updatedConversations,
          messages: updatedMessages
        };
      });
    },

    /**
     * Clear current conversation
     */
    clearConversation: (): void => {
      update(state => ({
        ...state,
        currentConversation: null,
        messages: []
      }));
    },

    /**
     * Clear error
     */
    clearError: (): void => {
      update(state => ({ ...state, error: null }));
    },

    /**
     * Reset to initial state
     */
    reset: (): void => {
      set(initialState);
    }
  };
}

/**
 * Format pubkey for display (show first 8 and last 8 characters)
 */
function formatPubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 8)}`;
}

export const dmStore = createDMStore();

/**
 * Derived store for sorted conversations (pinned first, then by last message time)
 * Filters out conversations with muted users
 */
export const sortedConversations = derived([dmStore, muteStore], ([$dm, $mute]) => {
  const conversations = Array.from($dm.conversations.values()).filter(
    conv => !$mute.mutedUsers.has(conv.pubkey)
  );
  return conversations.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.lastMessageTimestamp - a.lastMessageTimestamp;
  });
});

/**
 * Derived store for muted conversations
 * Shows conversations with muted users separately
 */
export const mutedConversations = derived([dmStore, muteStore], ([$dm, $mute]) => {
  const conversations = Array.from($dm.conversations.values()).filter(
    conv => $mute.mutedUsers.has(conv.pubkey)
  );
  return conversations.sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
});

/**
 * Derived store for total unread count
 */
export const totalUnread = derived(dmStore, $dm => {
  let total = 0;
  for (const conversation of $dm.conversations.values()) {
    total += conversation.unreadCount;
  }
  return total;
});

/**
 * Derived store for current conversation details
 */
export const currentConversation = derived(dmStore, $dm => {
  if (!$dm.currentConversation) return null;
  return $dm.conversations.get($dm.currentConversation) ?? null;
});
