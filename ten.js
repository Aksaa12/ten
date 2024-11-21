const WebSocket = require('ws');
const { promisify } = require('util');
const fs = require('fs');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

let socket = null;
let pingInterval;
let retryDelay = 1000;

async function getLocalStorage() {
  try {
    const data = await readFileAsync('localStorage.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function setLocalStorage(data) {
  const currentData = await getLocalStorage();
  const newData = { ...currentData, ...data };
  await writeFileAsync('localStorage.json', JSON.stringify(newData));
}

async function connectWebSocket(userId) {
  if (socket) return;

  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;

  socket = new WebSocket(wsUrl);

  socket.onopen = async () => {
    console.log("WebSocket connected");
    retryDelay = 1000;
    startPinging();
  };

  socket.onmessage = async (event) => {
    console.log("Received message:", event.data);
  };

  socket.onclose = () => {
    console.log("WebSocket disconnected. Reconnecting...");
    stopPinging();
    socket = null;
    setTimeout(() => connectWebSocket(userId), retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

function disconnectWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
    stopPinging();
  }
}

function startPinging() {
  stopPinging();
  pingInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "PING" }));
    }
  }, 10000);
}

function stopPinging() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

async function main() {
  const localStorageData = await getLocalStorage();
  const userId = localStorageData.userId;

  if (!userId) {
    console.error("User ID not found. Please set your User ID in 'localStorage.json'.");
    process.exit(1);
  }

  await connectWebSocket(userId);
}

process.on('SIGINT', () => {
  console.log('Received SIGINT. Disconnecting...');
  disconnectWebSocket();
  process.exit(0);
});

main();
