export class RuleValidator {
  static isWildOkey(tile, okeyInfo) {
    if (!tile || !okeyInfo) return false;
    return !tile.isFakeJoker && tile.color === okeyInfo.color && tile.value === okeyInfo.value;
  }

  static getTileScore(tile) {
    if (!tile) return 0;
    return tile.value || 0;
  }

  static isValidRun(tiles, okeyInfo) {
    if (!tiles || tiles.length < 3 || tiles.length > 14) return false;

    const nonWild = tiles.filter(t => !this.isWildOkey(t, okeyInfo));
    if (nonWild.length === 0) return true;

    const baseColor = nonWild[0].color;
    for (const t of nonWild) {
      if (t.color !== baseColor) return false;
    }

    // Standard run check without wrap
    for (let startVal = 1; startVal <= 14 - tiles.length; startVal++) {
      let match = true;
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if (!this.isWildOkey(t, okeyInfo) && t.value !== startVal + i) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }

    // Wrap check: Last tile is 1, preceding tiles end at 13
    const lastTile = tiles[tiles.length - 1];
    const isLastOne = this.isWildOkey(lastTile, okeyInfo) || lastTile.value === 1;

    if (isLastOne) {
      const prefixLength = tiles.length - 1;
      const startVal = 13 - prefixLength + 1;
      if (startVal >= 1) {
        let match = true;
        for (let i = 0; i < prefixLength; i++) {
          const t = tiles[i];
          if (!this.isWildOkey(t, okeyInfo) && t.value !== startVal + i) {
            match = false;
            break;
          }
        }
        if (match) return true;
      }
    }

    return false;
  }

  static isValidGroup(tiles, okeyInfo) {
    if (!tiles || tiles.length < 3 || tiles.length > 4) return false;

    const nonWild = tiles.filter(t => !this.isWildOkey(t, okeyInfo));
    if (nonWild.length === 0) return true;

    const baseValue = nonWild[0].value;
    const colorsUsed = new Set();

    for (const t of nonWild) {
      if (t.value !== baseValue) return false;
      if (colorsUsed.has(t.color)) return false;
      colorsUsed.add(t.color);
    }

    return true;
  }

  static isValidPer(tiles, okeyInfo) {
    return this.isValidRun(tiles, okeyInfo) || this.isValidGroup(tiles, okeyInfo);
  }

  static isPair(tileA, tileB, okeyInfo) {
    if (!tileA || !tileB) return false;
    if (this.isWildOkey(tileA, okeyInfo) || this.isWildOkey(tileB, okeyInfo)) return true;
    return tileA.color === tileB.color && tileA.value === tileB.value;
  }

  static getPerPoints(tiles, okeyInfo) {
    if (!this.isValidPer(tiles, okeyInfo)) return 0;

    let total = 0;
    if (this.isValidGroup(tiles, okeyInfo)) {
      const nonWild = tiles.find(t => !this.isWildOkey(t, okeyInfo));
      const val = nonWild ? nonWild.value : (okeyInfo ? okeyInfo.value : 10);
      total = val * tiles.length;
    } else {
      const nonWildIndex = tiles.findIndex(t => !this.isWildOkey(t, okeyInfo));
      if (nonWildIndex === -1) {
        total = tiles.length * 10;
      } else {
        const baseVal = tiles[nonWildIndex].value;
        for (let i = 0; i < tiles.length; i++) {
          if (tiles[i].value === 1 && i === tiles.length - 1 && baseVal > 1) {
            total += 1;
          } else {
            let deduced = baseVal - nonWildIndex + i;
            if (deduced === 14) deduced = 1;
            total += deduced;
          }
        }
      }
    }
    return total;
  }

  static validate101Opening(pers, okeyInfo, minPoints = 101) {
    if (!pers || pers.length === 0) return { valid: false, reason: 'Hiç per seçilmedi.' };

    let totalPoints = 0;
    for (const per of pers) {
      if (!this.isValidPer(per, okeyInfo)) {
        return { valid: false, reason: 'Geçersiz per var.' };
      }
      totalPoints += this.getPerPoints(per, okeyInfo);
    }

    if (totalPoints < minPoints) {
      return {
        valid: false,
        points: totalPoints,
        reason: `Toplam puanınız (${totalPoints}) barajı (${minPoints}) geçmiyor.`
      };
    }

    return { valid: true, points: totalPoints };
  }

  /**
   * Scans a collection of tiles and finds non-overlapping valid pers (runs/groups)
   * that maximize the total 101 point score.
   */
  static findBest101Pers(tiles, okeyInfo) {
    if (!tiles || tiles.length < 3) return { pers: [], totalPoints: 0 };

    const candidatePers = [];
    const n = tiles.length;

    // Generate valid 3, 4, 5-tile combinations
    const getCombinations = (arr, size, start = 0, current = []) => {
      if (current.length === size) {
        if (this.isValidGroup(current, okeyInfo)) {
          candidatePers.push({
            tiles: [...current],
            pts: this.getPerPoints(current, okeyInfo)
          });
        } else if (this.isValidRunPermutation(current, okeyInfo)) {
          // Sort run into canonical order
          const sorted = [...current].sort((a, b) => a.value - b.value);
          const hasOne = sorted.find(t => t.value === 1 && !this.isWildOkey(t, okeyInfo));
          let orderedRun = sorted;
          if (hasOne && !this.isValidRun(sorted, okeyInfo)) {
            const rest = sorted.filter(t => t !== hasOne);
            orderedRun = [...rest, hasOne];
          }
          candidatePers.push({
            tiles: orderedRun,
            pts: this.getPerPoints(orderedRun, okeyInfo)
          });
        }
        return;
      }
      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        getCombinations(arr, size, i + 1, current);
        current.pop();
      }
    };

    for (let size = 3; size <= Math.min(5, n); size++) {
      getCombinations(tiles, size);
    }

    // Sort candidate pers descending by points
    candidatePers.sort((a, b) => b.pts - a.pts);

    let bestPers = [];
    let maxScore = 0;

    const backtrack = (startIdx, currentPers, usedIds, currentScore) => {
      if (currentScore > maxScore) {
        maxScore = currentScore;
        bestPers = currentPers.map(p => [...p]);
      }

      for (let i = startIdx; i < candidatePers.length; i++) {
        const cand = candidatePers[i];
        let hasOverlap = false;
        for (const t of cand.tiles) {
          if (usedIds.has(t.id)) {
            hasOverlap = true;
            break;
          }
        }

        if (!hasOverlap) {
          for (const t of cand.tiles) usedIds.add(t.id);
          currentPers.push(cand.tiles);

          backtrack(i + 1, currentPers, usedIds, currentScore + cand.pts);

          currentPers.pop();
          for (const t of cand.tiles) usedIds.delete(t.id);
        }
      }
    };

    backtrack(0, [], new Set(), 0);

    return { pers: bestPers, totalPoints: maxScore };
  }

  /**
   * Finds all non-overlapping pairs in a collection of tiles
   */
  static find101Pairs(tiles, okeyInfo) {
    if (!tiles || tiles.length < 2) return { pairs: [], pairCount: 0 };

    const pairs = [];
    const usedIds = new Set();
    const wildcards = tiles.filter(t => this.isWildOkey(t, okeyInfo));
    const normals = tiles.filter(t => !this.isWildOkey(t, okeyInfo));

    for (let i = 0; i < normals.length; i++) {
      const a = normals[i];
      if (usedIds.has(a.id)) continue;
      for (let j = i + 1; j < normals.length; j++) {
        const b = normals[j];
        if (usedIds.has(b.id)) continue;
        if (a.color === b.color && a.value === b.value) {
          pairs.push([a, b]);
          usedIds.add(a.id);
          usedIds.add(b.id);
          break;
        }
      }
    }

    const remainingNormals = normals.filter(t => !usedIds.has(t.id));
    let wildIdx = 0;
    while (wildIdx < wildcards.length && remainingNormals.length > 0) {
      pairs.push([remainingNormals.shift(), wildcards[wildIdx++]]);
    }

    return { pairs, pairCount: pairs.length };
  }

  static validate101Pairs(pairs, okeyInfo) {
    if (!pairs || pairs.length < 5) {
      return { valid: false, reason: 'Çift açmak için en az 5 çift gereklidir.' };
    }
    for (const pair of pairs) {
      if (pair.length !== 2 || !this.isPair(pair[0], pair[1], okeyInfo)) {
        return { valid: false, reason: 'Geçersiz çift bulundu.' };
      }
    }
    return { valid: true };
  }

  static checkClassicWin(hand, okeyInfo) {
    if (hand.length !== 14) return { win: false };

    if (this.canFormPairs(hand, okeyInfo, 7)) {
      return { win: true, type: 'pairs' };
    }

    if (this.canPartitionIntoPers(hand, okeyInfo)) {
      return { win: true, type: 'runs' };
    }

    return { win: false };
  }

  static canFormPairs(hand, okeyInfo, targetPairs = 7) {
    const wildcards = hand.filter(t => this.isWildOkey(t, okeyInfo));
    const normals = hand.filter(t => !this.isWildOkey(t, okeyInfo));

    const counts = {};
    for (const t of normals) {
      const key = `${t.color}-${t.value}`;
      counts[key] = (counts[key] || 0) + 1;
    }

    let pairs = 0;
    let singles = 0;
    for (const key in counts) {
      pairs += Math.floor(counts[key] / 2);
      singles += counts[key] % 2;
    }

    let wildCount = wildcards.length;
    while (wildCount > 0 && singles > 0) {
      pairs++;
      singles--;
      wildCount--;
    }
    pairs += Math.floor(wildCount / 2);

    return pairs >= targetPairs;
  }

  static canPartitionIntoPers(hand, okeyInfo) {
    const allPers = [];
    const n = hand.length;

    const getCombinations = (arr, size, start = 0, current = []) => {
      if (current.length === size) {
        if (this.isValidGroup(current, okeyInfo) || this.isValidRunPermutation(current, okeyInfo)) {
          allPers.push([...current]);
        }
        return;
      }
      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        getCombinations(arr, size, i + 1, current);
        current.pop();
      }
    };

    for (let size = 3; size <= Math.min(5, n); size++) {
      getCombinations(hand, size);
    }

    const targetTileIds = new Set(hand.map(t => t.id));

    const backtrack = (usedIds, startIdx) => {
      if (usedIds.size === targetTileIds.size) return true;

      for (let i = startIdx; i < allPers.length; i++) {
        const per = allPers[i];
        const perIds = per.map(t => t.id);

        let overlap = false;
        for (const id of perIds) {
          if (usedIds.has(id)) {
            overlap = true;
            break;
          }
        }

        if (!overlap) {
          for (const id of perIds) usedIds.add(id);
          if (backtrack(usedIds, i + 1)) return true;
          for (const id of perIds) usedIds.delete(id);
        }
      }

      return false;
    };

    return backtrack(new Set(), 0);
  }

  static isValidRunPermutation(tiles, okeyInfo) {
    if (tiles.length < 3) return false;
    const sorted = [...tiles].sort((a, b) => a.value - b.value);
    if (this.isValidRun(sorted, okeyInfo)) return true;

    const hasOne = sorted.find(t => t.value === 1 && !this.isWildOkey(t, okeyInfo));
    if (hasOne) {
      const rest = sorted.filter(t => t !== hasOne);
      if (this.isValidRun([...rest, hasOne], okeyInfo)) return true;
    }

    return false;
  }

  static canProcessTile(tile, openPer, okeyInfo) {
    if (!tile || !openPer || openPer.length === 0) return null;

    if (this.isValidGroup(openPer, okeyInfo)) {
      if (openPer.length >= 4) return null;
      const test = [...openPer, tile];
      if (this.isValidGroup(test, okeyInfo)) {
        return { type: 'group', newPer: test };
      }
    }

    if (this.isValidRun(openPer, okeyInfo)) {
      const prepend = [tile, ...openPer];
      if (this.isValidRun(prepend, okeyInfo)) {
        return { type: 'run-prepend', newPer: prepend };
      }
      const append = [...openPer, tile];
      if (this.isValidRun(append, okeyInfo)) {
        return { type: 'run-append', newPer: append };
      }
    }

    return null;
  }

  /**
   * Smartly organizes hand into detected runs/groups with gaps
   * Returns an array of tiles organized into logical sequences
   */
  static autoArrangeRuns(hand, okeyInfo) {
    if (!hand || hand.length === 0) return [];

    const wildcards = hand.filter(t => this.isWildOkey(t, okeyInfo));
    const normals = hand.filter(t => !this.isWildOkey(t, okeyInfo));

    // Group by color and sort by value
    const byColor = { red: [], blue: [], black: [], yellow: [] };
    for (const t of normals) {
      if (byColor[t.color]) byColor[t.color].push(t);
    }
    for (const c in byColor) {
      byColor[c].sort((a, b) => a.value - b.value);
    }

    const detectedPers = [];
    const usedIds = new Set();

    // 1. Find consecutive runs of 3+
    for (const color of ['red', 'blue', 'black', 'yellow']) {
      const tiles = byColor[color];
      let currentRun = [];

      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        if (usedIds.has(t.id)) continue;

        if (currentRun.length === 0) {
          currentRun.push(t);
        } else {
          const prev = currentRun[currentRun.length - 1];
          if (t.value === prev.value + 1) {
            currentRun.push(t);
          } else if (t.value === prev.value) {
            // Duplicate number in same color, skip for now
            continue;
          } else {
            // Break in sequence
            if (currentRun.length >= 3) {
              detectedPers.push([...currentRun]);
              currentRun.forEach(item => usedIds.add(item.id));
            }
            currentRun = [t];
          }
        }
      }

      if (currentRun.length >= 3) {
        detectedPers.push([...currentRun]);
        currentRun.forEach(item => usedIds.add(item.id));
      }
    }

    // 2. Find groups of same number, different colors
    const byValue = {};
    for (const t of normals) {
      if (usedIds.has(t.id)) continue;
      byValue[t.value] = byValue[t.value] || [];
      byValue[t.value].push(t);
    }

    for (const val in byValue) {
      const list = byValue[val];
      const uniqueColors = [];
      const seen = new Set();
      for (const t of list) {
        if (!seen.has(t.color)) {
          uniqueColors.push(t);
          seen.add(t.color);
        }
      }
      if (uniqueColors.length >= 3) {
        detectedPers.push([...uniqueColors]);
        uniqueColors.forEach(item => usedIds.add(item.id));
      }
    }

    // 3. Assemble result: complete pers first, then remaining tiles, then wildcards
    const remaining = normals.filter(t => !usedIds.has(t.id)).sort((a, b) => {
      if (a.color === b.color) return a.value - b.value;
      return a.color.localeCompare(b.color);
    });

    const result = [];
    for (const per of detectedPers) {
      result.push(...per);
      result.push(null); // Gap between pers!
    }

    if (result.length > 0 && result[result.length - 1] === null) {
      // Keep gap
    }

    result.push(...wildcards);
    if (wildcards.length > 0) result.push(null);
    result.push(...remaining);

    return result;
  }

  /**
   * Smartly organizes hand into pairs (Çift Diz)
   */
  static autoArrangePairs(hand, okeyInfo) {
    if (!hand || hand.length === 0) return [];

    const wildcards = hand.filter(t => this.isWildOkey(t, okeyInfo));
    const normals = hand.filter(t => !this.isWildOkey(t, okeyInfo));

    const pairs = [];
    const usedIds = new Set();

    // Find identical normals
    for (let i = 0; i < normals.length; i++) {
      const a = normals[i];
      if (usedIds.has(a.id)) continue;

      for (let j = i + 1; j < normals.length; j++) {
        const b = normals[j];
        if (usedIds.has(b.id)) continue;

        if (a.color === b.color && a.value === b.value) {
          pairs.push([a, b]);
          usedIds.add(a.id);
          usedIds.add(b.id);
          break;
        }
      }
    }

    // Pair remaining with wildcards if any
    const remainingNormals = normals.filter(t => !usedIds.has(t.id));
    let wildIndex = 0;
    while (wildIndex < wildcards.length && remainingNormals.length > 0) {
      const normal = remainingNormals.shift();
      const wild = wildcards[wildIndex++];
      pairs.push([normal, wild]);
      usedIds.add(normal.id);
      usedIds.add(wild.id);
    }

    // Pair remaining wildcards with each other
    while (wildIndex + 1 < wildcards.length) {
      pairs.push([wildcards[wildIndex], wildcards[wildIndex + 1]]);
      usedIds.add(wildcards[wildIndex].id);
      usedIds.add(wildcards[wildIndex + 1].id);
      wildIndex += 2;
    }

    const leftovers = hand.filter(t => !usedIds.has(t.id)).sort((a, b) => {
      if (a.color === b.color) return a.value - b.value;
      return a.color.localeCompare(b.color);
    });

    const result = [];
    for (const pair of pairs) {
      result.push(pair[0], pair[1]);
      result.push(null); // Space between pairs
    }
    result.push(...leftovers);

    return result;
  }
}
