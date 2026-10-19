import {
  CLOSE_INVALID,
  CLOSE_ROOM_FULL,
  CLOSE_ROOM_NOT_FOUND,
  type ClientMessage,
  type ServerMessage,
} from '@cerdas-amat/shared';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

const RETRY_DELAYS_MS = [500, 1000, 2000];
const RETRY_STEADY_MS = 4000;
const PING_INTERVAL_MS = 5000;
/** Close code dari server yang berarti mencoba lagi tidak ada gunanya. */
const FINAL_CLOSE_CODES = new Set([CLOSE_ROOM_NOT_FOUND, CLOSE_ROOM_FULL, CLOSE_INVALID]);

/**
 * Satu WebSocket ke room. Tersambung ulang otomatis (0,5 s, 1 s, 2 s, lalu tiap 4 s,
 * atau langsung saat tab kembali terlihat) sampai `close()` dipanggil atau server
 * menutup dengan close code final.
 */
export class RoomClient {
  onMessage: (msg: ServerMessage) => void = () => {};
  onStatus: (status: ConnectionStatus, closeCode?: number) => void = () => {};
  /** Dipanggil setiap kali socket terbuka, termasuk setelah tersambung ulang. */
  onOpen: () => void = () => {};

  private code = '';
  private ws: WebSocket | null = null;
  private attempt = 0;
  private stopped = true;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    document.addEventListener('visibilitychange', this.onVisible);
  }

  connect(code: string): void {
    this.close();
    this.code = code;
    this.stopped = false;
    this.attempt = 0;
    this.open('connecting');
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000);
  }

  destroy(): void {
    this.close();
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  private open(status: ConnectionStatus): void {
    this.onStatus(status);
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/${this.code}`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.onStatus('open');
      this.onOpen();
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => ws.send('ping'), PING_INTERVAL_MS);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      this.onMessage(JSON.parse(e.data as string) as ServerMessage);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return; // socket lama yang sudah diganti
      clearInterval(this.pingTimer);
      this.ws = null;
      if (this.stopped || FINAL_CLOSE_CODES.has(e.code)) {
        this.stopped = true;
        this.onStatus('closed', e.code);
        return;
      }
      this.scheduleRetry();
    };
  }

  private scheduleRetry(): void {
    const delay = RETRY_DELAYS_MS[this.attempt] ?? RETRY_STEADY_MS;
    this.attempt++;
    this.onStatus('reconnecting');
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.open('reconnecting'), delay);
  }

  private onVisible = (): void => {
    if (document.visibilityState !== 'visible' || this.stopped || this.ws) return;
    clearTimeout(this.retryTimer);
    this.open('reconnecting');
  };
}
