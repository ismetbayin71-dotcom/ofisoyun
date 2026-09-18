import assert from 'assert';
import { extractYouTubeVideoId } from '../src/utils/mediaUtils.js';
import { Room } from '../src/game/Room.js';

console.log('--- Testing extractYouTubeVideoId ---');

// Test standard watch URL
assert.strictEqual(
  extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  'dQw4w9WgXcQ',
  'Should parse standard watch URL'
);

// Test watch URL with extra params
assert.strictEqual(
  extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=xyz'),
  'dQw4w9WgXcQ',
  'Should parse watch URL with extra params'
);

// Test short youtu.be URL
assert.strictEqual(
  extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=abcdef'),
  'dQw4w9WgXcQ',
  'Should parse youtu.be short URL'
);

// Test YouTube Shorts URL
assert.strictEqual(
  extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
  'dQw4w9WgXcQ',
  'Should parse shorts URL'
);

// Test YouTube Music URL
assert.strictEqual(
  extractYouTubeVideoId('https://music.youtube.com/watch?v=dQw4w9WgXcQ'),
  'dQw4w9WgXcQ',
  'Should parse YouTube Music URL'
);

// Test raw 11-char ID
assert.strictEqual(
  extractYouTubeVideoId('dQw4w9WgXcQ'),
  'dQw4w9WgXcQ',
  'Should accept raw 11-char ID'
);

// Test invalid URLs
assert.strictEqual(extractYouTubeVideoId('https://google.com'), null, 'Should return null for non-YouTube');
assert.strictEqual(extractYouTubeVideoId(''), null, 'Should return null for empty string');
assert.strictEqual(extractYouTubeVideoId(null), null, 'Should return null for null');

console.log('✓ extractYouTubeVideoId tests passed!');

console.log('--- Testing Room Media Queue Management ---');

const room = new Room('1234', 'Masa 1', '101', {}, { id: 'host-1', name: 'İsmet' });

// Verify initial state
assert.strictEqual(room.mediaState.currentTrack, null);
assert.strictEqual(room.mediaState.queue.length, 0);

// Add first track (should become currentTrack immediately)
const track1 = { id: 't1', videoId: 'vid1', title: 'Şarkı 1', addedBy: 'İsmet' };
room.addMediaTrack(track1);
assert.strictEqual(room.mediaState.currentTrack.id, 't1');
assert.strictEqual(room.mediaState.queue.length, 0);
assert.strictEqual(room.mediaState.isPlaying, true);

// Add second track (should go to queue)
const track2 = { id: 't2', videoId: 'vid2', title: 'Şarkı 2', addedBy: 'Ahmet' };
room.addMediaTrack(track2);
assert.strictEqual(room.mediaState.currentTrack.id, 't1');
assert.strictEqual(room.mediaState.queue.length, 1);
assert.strictEqual(room.mediaState.queue[0].id, 't2');

// Add third track (should go to queue)
const track3 = { id: 't3', videoId: 'vid3', title: 'Şarkı 3', addedBy: 'Ayşe' };
room.addMediaTrack(track3);
assert.strictEqual(room.mediaState.queue.length, 2);

// Remove track 2 from queue
room.removeMediaTrack('t2');
assert.strictEqual(room.mediaState.queue.length, 1);
assert.strictEqual(room.mediaState.queue[0].id, 't3');

// Skip current track (track3 should become currentTrack)
room.skipMediaTrack();
assert.strictEqual(room.mediaState.currentTrack.id, 't3');
assert.strictEqual(room.mediaState.queue.length, 0);

// Skip last track (queue empty -> currentTrack should become null)
room.skipMediaTrack();
assert.strictEqual(room.mediaState.currentTrack, null);
assert.strictEqual(room.mediaState.isPlaying, false);

// Test Play / Pause Synchronization
const track4 = { id: 't4', videoId: 'vid4', title: 'Senkron Testi', addedBy: 'Can' };
room.addMediaTrack(track4);
assert.strictEqual(room.mediaState.isPlaying, true, 'Newly added track should start playing');

// Player 1 pauses the TV for everyone
room.toggleMediaPlay(false);
assert.strictEqual(room.mediaState.isPlaying, false, 'Should be paused for everyone');

// Player 2 unpauses the TV
room.toggleMediaPlay(true);
assert.strictEqual(room.mediaState.isPlaying, true, 'Should resume playing for everyone');

// Toggle without argument
room.toggleMediaPlay();
assert.strictEqual(room.mediaState.isPlaying, false, 'Should toggle to paused');

console.log('✓ Room media queue & synchronized play/pause tests passed!');

