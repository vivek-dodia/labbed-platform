import type { WSMessage } from "@/types/api";
import { getAccessToken } from "./auth";

type MessageHandler = (data: unknown) => void;
type StatusHandler = (status: WSConnectionStatus) => void;

export type WSConnectionStatus = "connected" | "connecting" | "disconnected";

function getWsBase(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window === "undefined") return "ws://localhost:8080";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}

export class LabWebSocket {
  private ws: WebSocket | null = null;
  private subs = new Map<string, Set<MessageHandler>>();
  private reconnectDelay = 1000;
  private maxDelay = 30000;
  private shouldReconnect = true;
  private statusHandlers = new Set<StatusHandler>();
  private _status: WSConnectionStatus = "disconnected";

  get status(): WSConnectionStatus {
    return this._status;
  }

  private setStatus(s: WSConnectionStatus) {
    this._status = s;
    this.statusHandlers.forEach((h) => h(s));
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    return () => { this.statusHandlers.delete(handler); };
  }

  connect() {
    const token = getAccessToken();
    if (!token) return;

    this.setStatus("connecting");
    this.ws = new WebSocket(`${getWsBase()}/ws?token=${token}`);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.setStatus("connected");
      // re-subscribe to all active channels
      for (const channel of this.subs.keys()) {
        this.send({ type: "subscribe", channel });
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        const handlers = this.subs.get(msg.channel);
        if (handlers) {
          handlers.forEach((h) => h(msg.data));
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.setStatus("disconnected");
      if (this.shouldReconnect) {
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          this.maxDelay
        );
      }
    };
  }

  subscribe(channel: string, handler: MessageHandler) {
    if (!this.subs.has(channel)) {
      this.subs.set(channel, new Set());
      this.send({ type: "subscribe", channel });
    }
    this.subs.get(channel)!.add(handler);
  }

  unsubscribe(channel: string, handler: MessageHandler) {
    const handlers = this.subs.get(channel);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.subs.delete(channel);
      this.send({ type: "unsubscribe", channel });
    }
  }

  sendShellInput(channel: string, input: string) {
    this.send({ type: "shell:data", channel, data: { input } });
  }

  private send(msg: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.ws?.close();
    this.subs.clear();
  }
}

// singleton
let instance: LabWebSocket | null = null;

export function getWS(): LabWebSocket {
  if (!instance) {
    instance = new LabWebSocket();
    instance.connect();
  }
  return instance;
}
