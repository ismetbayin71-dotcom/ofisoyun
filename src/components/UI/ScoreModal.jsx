import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../../utils/soundEffects.js';
import { Trophy, RefreshCw } from 'lucide-react';
import { PlayerAvatar } from './PlayerAvatar.jsx';

export const ScoreModal = ({
  winner,
  players = [],
  scores = [],
  gameType,
  isHost,
  onNextRound,
  currentRound = 1,
  roundHistory = [],
  isManualView = false
}) => {
  if (!winner) return null;

  useEffect(() => {
    if (!isManualView) {
      sound.playWin();
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    }
  }, [isManualView]);

  const cleanPlayerName = (name) => {
    if (!name) return 'Oyuncu';
    return name.replace(/\s*\((?:bot|Bot)\)/gi, '').trim();
  };

  // Build history rows: if roundHistory is available use it, otherwise show current round
  const historyList = (roundHistory && roundHistory.length > 0)
    ? roundHistory
    : [{
        round: currentRound || 1,
        penalties: winner.roundPenalties || players.map((_, idx) => (idx === winner.playerIndex ? (winner.points ? `+${winner.points}` : 0) : 0)),
        winnerIdx: winner.playerIndex,
        finishType: winner.finishType || 'Tur Tamamlandı',
        scores: [...scores]
      }];

  // Determine current match leader
  let leaderIdx = 0;
  if (gameType === '101') {
    let minScore = Infinity;
    scores.forEach((s, idx) => {
      if (players[idx] && s < minScore) {
        minScore = s;
        leaderIdx = idx;
      }
    });
  } else {
    let maxScore = -Infinity;
    scores.forEach((s, idx) => {
      if (players[idx] && s > maxScore) {
        maxScore = s;
        leaderIdx = idx;
      }
    });
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content score-cetele-modal">
        {/* Winner Trophy Banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ background: 'rgba(229, 185, 76, 0.2)', padding: 10, borderRadius: '50%' }}>
            <Trophy size={36} color="#e5b94c" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#e5b94c' }}>
              {winner.name ? `${cleanPlayerName(winner.name)} Bu Eli Kazandı!` : 'Tur Tamamlandı!'}
            </h2>
            {winner.finishType && (
              <span style={{ color: '#38ef7d', fontWeight: 800, fontSize: '0.92rem' }}>
                {winner.finishType} {winner.points ? `(+${winner.points} Puan)` : ''}
              </span>
            )}
          </div>
        </div>

        {/* 101 / Okey Çetele Puan Tablosu */}
        <div className="cetele-table-container">
          <table className="cetele-table">
            <thead>
              <tr>
                <th style={{ width: '75px', textAlign: 'center' }}>EL / TUR</th>
                {players.map((p, idx) => {
                  if (!p) return null;
                  const isWinner = winner.playerIndex === idx;
                  return (
                    <th key={idx} style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <PlayerAvatar
                          avatar={p.avatar}
                          isBot={p.isBot}
                          name={cleanPlayerName(p.name)}
                          size={28}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                          <span style={{ fontWeight: 800, color: isWinner ? '#e5b94c' : '#f1f5f9', fontSize: '0.85rem' }}>
                            {cleanPlayerName(p.name)}
                          </span>
                          {p.isBot && <span className="bot-pill-mini">BOT</span>}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {historyList.map((entry, rIdx) => (
                <tr key={rIdx}>
                  <td style={{ fontWeight: 800, color: '#e5b94c', background: 'rgba(0,0,0,0.25)' }}>
                    {entry.round}. El
                  </td>
                  {players.map((p, pIdx) => {
                    if (!p) return null;
                    const penalty = entry.penalties ? entry.penalties[pIdx] : '-';
                    const isRoundWinner = entry.winnerIdx === pIdx;
                    const penaltyNum = Number(penalty);

                    let penaltyClass = 'cetele-penalty-normal';
                    if (isRoundWinner || penaltyNum < 0 || (typeof penalty === 'string' && penalty.startsWith('+'))) {
                      penaltyClass = 'cetele-penalty-winner';
                    } else if (penaltyNum >= 101) {
                      penaltyClass = 'cetele-penalty-bad';
                    }

                    return (
                      <td key={pIdx} className={penaltyClass}>
                        {penalty}
                        {isRoundWinner && ' 🏆'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="cetele-total-row">
                <td>
                  TOPLAM
                </td>
                {players.map((p, idx) => {
                  if (!p) return null;
                  const totalScore = scores[idx] !== undefined ? scores[idx] : 0;
                  const isLeader = leaderIdx === idx;
                  return (
                    <td key={idx} style={{ color: isLeader ? '#e5b94c' : '#ffffff' }}>
                      <strong>{totalScore}</strong>
                      {isLeader && (
                        <span className="cetele-leader-badge" title="Şu anki lider">
                          👑 LİDER
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Sonraki El veya Kapat Butonu */}
        {isManualView ? (
          <button className="btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={onNextRound}>
            Kapat
          </button>
        ) : isHost ? (
          <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={onNextRound}>
            <RefreshCw size={16} style={{ marginRight: 6 }} />
            Sonraki Eli Başlat
          </button>
        ) : (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 8 }}>
            Oda kurucusunun sonraki eli başlatması bekleniyor...
          </p>
        )}
      </div>
    </div>
  );
};
