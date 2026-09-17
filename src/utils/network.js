import { p2pNetwork } from './p2pNetwork.js';

// Unified network interface for GitHub Pages (P2P WebRTC)
export const network = {
  createRoom: (params) => p2pNetwork.createRoom(params),
  joinRoom: (params) => p2pNetwork.joinRoom(params),
  emit: (event, data, callback) => p2pNetwork.emit(event, data, callback),
  on: (event, callback) => p2pNetwork.on(event, callback),
  off: (event, callback) => p2pNetwork.off(event, callback),
  leaveRoom: () => p2pNetwork.leaveRoom(),
  getId: () => p2pNetwork.myId
};
