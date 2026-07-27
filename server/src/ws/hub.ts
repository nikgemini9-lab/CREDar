import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

let wss: WebSocketServer | undefined;

export function attachWebSocketHub(server: HttpServer): void {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "hello", payload: { message: "connected to CREDAR" } }));
  });
}

export function broadcast(type: string, payload: unknown): void {
  if (!wss) return;
  const message = JSON.stringify({ type, payload });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
