import { WebSocket } from 'ws';
import { Database, NostrEvent } from './db';
import { Whitelist } from './whitelist';
import crypto from 'crypto';
import { schnorr } from '@noble/secp256k1';

export class NostrHandlers {
  private db: Database;
  private whitelist: Whitelist;
  private subscriptions: Map<string, Map<string, any[]>>;

  constructor(db: Database, whitelist: Whitelist) {
    this.db = db;
    this.whitelist = whitelist;
    this.subscriptions = new Map();
  }

  async handleMessage(ws: WebSocket, message: string): Promise<void> {
    try {
      const parsed = JSON.parse(message);

      if (!Array.isArray(parsed) || parsed.length < 2) {
        this.sendNotice(ws, 'Invalid message format');
        return;
      }

      const [type, ...args] = parsed;

      switch (type) {
        case 'EVENT':
          await this.handleEvent(ws, args[0]);
          break;
        case 'REQ':
          await this.handleReq(ws, args[0], args.slice(1));
          break;
        case 'CLOSE':
          this.handleClose(ws, args[0]);
          break;
        default:
          this.sendNotice(ws, `Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendNotice(ws, 'Error processing message');
    }
  }

  private async handleEvent(ws: WebSocket, event: NostrEvent): Promise<void> {
    // Validate event structure
    if (!this.validateEvent(event)) {
      this.sendOK(ws, event.id, false, 'invalid: event validation failed');
      return;
    }

    // Check whitelist
    if (!this.whitelist.isAllowed(event.pubkey)) {
      this.sendOK(ws, event.id, false, 'blocked: pubkey not whitelisted');
      return;
    }

    // Verify event ID
    if (!this.verifyEventId(event)) {
      this.sendOK(ws, event.id, false, 'invalid: event id verification failed');
      return;
    }

    // Verify Schnorr signature
    if (!await this.verifySignature(event)) {
      this.sendOK(ws, event.id, false, 'invalid: signature verification failed');
      return;
    }

    // Save to database
    const saved = await this.db.saveEvent(event);

    if (saved) {
      this.sendOK(ws, event.id, true, '');
      // Broadcast to subscribers
      this.broadcastEvent(event);
    } else {
      this.sendOK(ws, event.id, false, 'error: failed to save event');
    }
  }

  private async handleReq(ws: WebSocket, subscriptionId: string, filters: any[]): Promise<void> {
    // Store subscription
    if (!this.subscriptions.has(ws as any)) {
      this.subscriptions.set(ws as any, new Map());
    }
    this.subscriptions.get(ws as any)!.set(subscriptionId, filters);

    // Query and send matching events
    const events = await this.db.queryEvents(filters);

    for (const event of events) {
      this.send(ws, ['EVENT', subscriptionId, event]);
    }

    // Send EOSE (End of Stored Events)
    this.send(ws, ['EOSE', subscriptionId]);
  }

  private handleClose(ws: WebSocket, subscriptionId: string): void {
    const wsSubscriptions = this.subscriptions.get(ws as any);
    if (wsSubscriptions) {
      wsSubscriptions.delete(subscriptionId);
    }
  }

  private validateEvent(event: NostrEvent): boolean {
    return (
      typeof event.id === 'string' &&
      typeof event.pubkey === 'string' &&
      typeof event.created_at === 'number' &&
      typeof event.kind === 'number' &&
      Array.isArray(event.tags) &&
      typeof event.content === 'string' &&
      typeof event.sig === 'string' &&
      event.id.length === 64 &&
      event.pubkey.length === 64 &&
      event.sig.length === 128
    );
  }

  private verifyEventId(event: NostrEvent): boolean {
    // NIP-01: Event ID is SHA256 of serialized event data
    const serialized = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content,
    ]);

    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    return hash === event.id;
  }

  private async verifySignature(event: NostrEvent): Promise<boolean> {
    try {
      // Convert hex strings to Uint8Array as required by @noble/secp256k1
      // event.id is the message hash (32 bytes)
      // event.sig is the Schnorr signature (64 bytes)
      // event.pubkey is the public key (32 bytes)
      const messageHash = this.hexToBytes(event.id);
      const signature = this.hexToBytes(event.sig);
      const publicKey = this.hexToBytes(event.pubkey);

      // Verify Schnorr signature according to NIP-01
      const isValid = await schnorr.verify(signature, messageHash, publicKey);
      return isValid;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  private hexToBytes(hex: string): Uint8Array {
    // Convert hex string to Uint8Array
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  private broadcastEvent(event: NostrEvent): void {
    for (const [ws, subscriptions] of this.subscriptions.entries()) {
      for (const [subId, filters] of subscriptions.entries()) {
        if (this.eventMatchesFilters(event, filters)) {
          this.send(ws as any, ['EVENT', subId, event]);
        }
      }
    }
  }

  private eventMatchesFilters(event: NostrEvent, filters: any[]): boolean {
    for (const filter of filters) {
      if (filter.ids && !filter.ids.includes(event.id)) continue;
      if (filter.authors && !filter.authors.includes(event.pubkey)) continue;
      if (filter.kinds && !filter.kinds.includes(event.kind)) continue;
      if (filter.since && event.created_at < filter.since) continue;
      if (filter.until && event.created_at > filter.until) continue;

      return true;
    }
    return false;
  }

  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendOK(ws: WebSocket, eventId: string, success: boolean, message: string): void {
    this.send(ws, ['OK', eventId, success, message]);
  }

  private sendNotice(ws: WebSocket, message: string): void {
    this.send(ws, ['NOTICE', message]);
  }

  handleDisconnect(ws: WebSocket): void {
    this.subscriptions.delete(ws as any);
  }
}
