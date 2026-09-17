import React, { useState, useEffect } from 'react';
import { network } from './utils/network.js';
import { LobbyView } from './components/Lobby/LobbyView.jsx';
import { WaitingRoom } from './components/Lobby/WaitingRoom.jsx';
import { GameBoard } from './components/Game/GameBoard.jsx';

function App() {
  const [currentScreen, setCurrentScreen] = useState('lobby'); // 'lobby' | 'waiting' | 'game'
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [myPeerId, setMyPeerId] = useState(null);

  // Saved nickname
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('okey_player_name') || 'Oyuncu';
  });

  useEffect(() => {
    localStorage.setItem('okey_player_name', playerName);
  }, [playerName]);

  // Network listeners
  useEffect(() => {
    const handleConnect = (id) => {
      setMyPeerId(id);
    };

    const handleRoomState = (state) => {
      setRoomState(state);
      if (state.status === 'playing') {
        setCurrentScreen('game');
      } else if (currentScreen !== 'game') {
        setCurrentScreen('waiting');
      }
    };

    const handleGameState = (state) => {
      setGameState(state);
      setCurrentScreen('game');
    };

    network.on('connect', handleConnect);
    network.on('room:state', handleRoomState);
    network.on('game:state', handleGameState);

    return () => {
      network.off('connect', handleConnect);
      network.off('room:state', handleRoomState);
      network.off('game:state', handleGameState);
    };
  }, [currentScreen]);

  // Handle joining room
  const handleRoomJoined = (roomId) => {
    setCurrentRoomId(roomId);
    setMyPeerId(network.getId());
    setCurrentScreen('waiting');
  };

  // Handle leaving room
  const handleLeaveRoom = () => {
    network.leaveRoom();
    setCurrentRoomId(null);
    setRoomState(null);
    setGameState(null);
    setCurrentScreen('lobby');
  };

  return (
    <div className="app-container">
      {currentScreen === 'lobby' && (
        <LobbyView
          onRoomJoined={handleRoomJoined}
          playerName={playerName}
          setPlayerName={setPlayerName}
        />
      )}

      {currentScreen === 'waiting' && roomState && (
        <WaitingRoom
          roomState={roomState}
          currentSocketId={myPeerId || network.getId()}
          onLeave={handleLeaveRoom}
        />
      )}

      {currentScreen === 'game' && gameState && (
        <GameBoard
          gameState={gameState}
          currentSocketId={myPeerId || network.getId()}
          chatMessages={roomState?.chatMessages || []}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
    </div>
  );
}

export default App;
