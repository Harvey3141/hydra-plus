import { WebSocketServer } from "ws";
const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });
wss.on("connection", (socket) => {
  console.log(`[relay] client connected (total: ${wss.clients.size})`);
  socket.on("message", (message) => {
    console.log(
      `[relay] message received (${message.length} bytes), forwarding to ${wss.clients.size - 1} client(s)`,
    );
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === 1) {
        client.send(message.toString());
      }
    }
  });
  socket.on("close", () =>
    console.log(`[relay] client disconnected (total: ${wss.clients.size})`),
  );
});
console.log(
  `[hydra-plus relay] WebSocket server running on ws://0.0.0.0:${PORT}`,
);
