import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../../utils/soundEffects.js';
import { Trophy, RefreshCw } from 'lucide-react';

export const ScoreModal = ({
  winner,
  players = [],
  scores = [],
  gameType,
  isHost,
  onNextRound
}) => {
  if (!winner) return null;

  useEffect(() => {
    sound.playWin();
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {}
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ background: 'rgba(229, 185, 76, 0.2)', padding: 16, borderRadius: '50%' }}>
            <Trophy size={48} color="#e5b94c" />
          </div>
        </div>

        <h2>
          {winner.name ? `${winner.name} Kazandı!` : 'Tur Tamamlandı!'}
        </h2>

        {winner.finishType && (
          <p style={{ color: '#38ef7d', fontWeight: 700, fontSize: '1.1rem', marginBottom: 16 }}>
            {winner.finishType} (+{winner.points} Puan)
          </p>
        )}

        <table className="score-table">
          <thead>
            <tr>
              <th>Oyuncu</th>
              <th>Bu Tur</th>
              <th>Toplam Skor</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, idx) => {
              if (!p) return null;
              const roundPenalty = winner.roundPenalties ? winner.roundPenalties[idx] : (winner.playerIndex === idx ? `+${winner.points}` : '0');
              const totalScore = scores[idx] !== undefined ? scores[idx] : 0;

              return (
                <tr key={idx} style={{ fontWeight: winner.playerIndex === idx ? 800 : 500 }}>
                  <td style={{ color: winner.playerIndex === idx ? '#e5b94c' : 'inherit' }}>
                    {p.name} {p.isBot ? '(Bot)' : ''}
                  </td>
                  <td style={{ color: roundPenalty > 0 ? '#f87171' : (roundPenalty < 0 ? '#38ef7d' : 'inherit') }}>
                    {roundPenalty}
                  </td>
                  <td>
                    <strong>{totalScore}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {isHost ? (
          <button className="btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={onNextRound}>
            <RefreshCw size={16} style={{ marginRight: 6 }} />
            Sonraki Eli Başlat
          </button>
        ) : (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 16 }}>
            Oda kurucusunun sonraki eli başlatması bekleniyor...
          </p>
        )}
      </div>
    </div>
  );
};
