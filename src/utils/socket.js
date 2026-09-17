import { io } from 'socket.io-client';

// Use same host as browser, with port 3001 if dev, or standard proxy
const isDev = window.location.port === '3000';
const SOCKET_URL = isDev
  ? `http://${window.location.hostname}:3001`
  : window.location.origin;

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

socket.on('connect', () => {
  console.log('Connected to Okey Server:', socket.id);
});

socket.on('connect_error', (err) => {
  console.warn('Socket connection error:', err.message);
});
