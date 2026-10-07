import { DurableObject } from 'cloudflare:workers';

/**
 * One instance per feed post (`idFromName(String(postId))`). Holds the open
 * WebSockets of everyone viewing that post's comments and fans out a
 * "comments changed" signal when one is written.
 *
 * The signal carries no comment data: each client refetches through the
 * normal comments endpoint, which applies blocks, reports and moderation for
 * that viewer. Uses the hibernation API so idle rooms cost nothing.
 */
export class PostLiveRoom extends DurableObject {
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (!client || !server) return new Response('WebSocket unavailable', { status: 500 });
    // Answered by the runtime without waking the object, so client keepalives are free.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Tells every open socket that the post's comments changed. */
  async broadcast(message: string): Promise<number> {
    const sockets = this.ctx.getWebSockets();
    for (const socket of sockets) {
      try {
        socket.send(message);
      } catch {
        // Socket already closing; the runtime drops it on its own.
      }
    }
    return sockets.length;
  }

  override async webSocketMessage(): Promise<void> {
    // Clients only listen; anything other than the auto-answered ping is ignored.
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close(1000, 'Closing');
    } catch {
      // Already closed by the peer.
    }
  }
}
