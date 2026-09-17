import { Room } from './Room.js';

export class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
  }

  // Generate 4-digit readable room code
  generateRoomCode() {
    let code;
    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (this.rooms.has(code));
    return code;
  }

  // Create room
  createRoom(name, gameType = 'classic', options = {}, host) {
    const code = this.generateRoomCode();
    const room = new Room(code, name, gameType, options, host);
    this.rooms.set(code, room);
    return room;
  }

  // Get room
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // Find room a socket is currently in
  findRoomBySocketId(socketId) {
    for (const room of this.rooms.values()) {
      if (room.seats.some(s => s && s.id === socketId)) {
        return room;
      }
    }
    return null;
  }

  // List public rooms
  listRooms() {
    return Array.from(this.rooms.values()).map(r => ({
      id: r.id,
      name: r.name,
      gameType: r.gameType,
      playerCount: r.seats.filter(s => s !== null).length,
      status: r.status
    }));
  }

  // Cleanup room if completely empty
  cleanRoomIfEmpty(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const hasHumans = room.seats.some(s => s && !s.isBot);
    if (!hasHumans) {
      this.rooms.delete(roomId);
    }
  }
}
