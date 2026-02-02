const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/api/v1/ws";

export type WSMessage = {
  type: "item";
  feed_id: string;
  data: unknown;
};

export function createWSClient(token: string) {
  const ws = new WebSocket(`${WS_BASE}?token=${token}`);

  return {
    ws,
    subscribeFeed(feedId: string) {
      ws.send(JSON.stringify({ type: "subscribe", feed_id: feedId }));
    },
    unsubscribeFeed(feedId: string) {
      ws.send(JSON.stringify({ type: "unsubscribe", feed_id: feedId }));
    },
    onMessage(cb: (msg: WSMessage) => void) {
      ws.addEventListener("message", (e) => {
        try {
          const msg = JSON.parse(e.data) as WSMessage;
          cb(msg);
        } catch {
          // ignore invalid messages
        }
      });
    },
    close() {
      ws.close();
    },
  };
}
