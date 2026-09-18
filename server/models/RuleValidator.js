export class RuleValidator {
  /**
   * Checks if a tile is the wild card Okey
   */
  static isWildOkey(tile, okeyInfo) {
    if (!tile || !okeyInfo) return false;
    return !tile.isFakeJoker && tile.color === okeyInfo.color && tile.value === okeyInfo.value;
  }

  /**
   * Calculates the value of a tile for 101 scoring
   */
  static getTileScore(tile) {
    if (!tile) return 0;
    return tile.value || 0;
  }

  /**
   * Validates if a group of tiles forms a valid Run (Seri)
   * e.g., Red 4, 5, 6 or Blue 11, 12, 13, 1
   * Allows Okey as wildcard.
   */
  static isValidRun(tiles, okeyInfo, gameType = 'classic') {
    if (!tiles || tiles.length < 3 || tiles.length > 14) return false;

    // Determine the base color (from non-wildcard tiles)
    const nonWild = tiles.filter(t => !this.isWildOkey(t, okeyInfo));
    if (nonWild.length === 0) return true; // All wildcards

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

    // Wrap check: Last tile is 1 (or wildcard), preceding tiles end at 13 (Allowed ONLY in Classic/Düz Okey, NOT in 101)
    if (gameType !== '101') {
      const lastTile = tiles[tiles.length - 1];
      const isLastOne = this.isWildOkey(lastTile, okeyInfo) || lastTile.value === 1;

      if (isLastOne) {
        const prefixLength = tiles.length - 1;
        const startVal = 13 - prefixLength + 1; // e.g. for [11, 12, 13, 1], prefixLength is 3, startVal is 11
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
    }

    return false;
  }

  /**
   * Validates if a group of tiles forms a valid Set / Group (Grup)
   * e.g., Red 7, Blue 7, Black 7 (same value, different colors, 3 or 4 tiles)
   */
  static isValidGroup(tiles, okeyInfo) {
    if (!tiles || tiles.length < 3 || tiles.length > 4) return false;

    const nonWild = tiles.filter(t => !this.isWildOkey(t, okeyInfo));
    if (nonWild.length === 0) return true;

    const baseValue = nonWild[0].value;
    const colorsUsed = new Set();

    for (const t of nonWild) {
      if (t.value !== baseValue) return false;
      if (colorsUsed.has(t.color)) return false; // Duplicate color not allowed in a group
      colorsUsed.add(t.color);
    }

    return true;
  }

  /**
   * Validates if a group of tiles is a valid Per (either Run or Group)
   */
  static isValidPer(tiles, okeyInfo, gameType = 'classic') {
    return this.isValidRun(tiles, okeyInfo, gameType) || this.isValidGroup(tiles, okeyInfo);
  }

  /**
   * Validates if two tiles form a Pair (Çift)
   */
  static isPair(tileA, tileB, okeyInfo) {
    if (!tileA || !tileB) return false;
    if (this.isWildOkey(tileA, okeyInfo) || this.isWildOkey(tileB, okeyInfo)) return true;
    return tileA.color === tileB.color && tileA.value === tileB.value;
  }

  /**
   * Calculates total points of a single Per in 101 Okey
   */
  static getPerPoints(tiles, okeyInfo, gameType = '101') {
    if (!this.isValidPer(tiles, okeyInfo, gameType)) return 0;

    // Resolve wildcards if needed
    let total = 0;
    if (this.isValidGroup(tiles, okeyInfo)) {
      const nonWild = tiles.find(t => !this.isWildOkey(t, okeyInfo));
      const val = nonWild ? nonWild.value : (okeyInfo ? okeyInfo.value : 10);
      total = val * tiles.length;
    } else {
      // It's a run: calculate per position
      // Find one fixed non-wild position to deduce sequence
      const nonWildIndex = tiles.findIndex(t => !this.isWildOkey(t, okeyInfo));
      if (nonWildIndex === -1) {
        // All wild (unlikely but safe fallback)
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

  /**
   * Validates if a collection of pers meets the 101 opening threshold
   */
  static validate101Opening(pers, okeyInfo, minPoints = 101) {
    if (!pers || pers.length === 0) return { valid: false, reason: 'Hiç per seçilmedi.' };

    let totalPoints = 0;
    for (const per of pers) {
      if (!this.isValidPer(per, okeyInfo, '101')) {
        return { valid: false, reason: 'Geçersiz per var. (101 Okeyde 12-13-1 serisi geçerli değildir, seriler en fazla 11-12-13 olabilir)' };
      }
      totalPoints += this.getPerPoints(per, okeyInfo, '101');
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
   * Validates if a player has at least 5 pairs to open pairs in 101
   */
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

  /**
   * Checks if a 14-tile hand is a winning hand in Classic Düz Okey
   * Either:
   * 1. 7 Pairs
   * 2. All 14 tiles cleanly partitioned into valid pers (groups of 3, 4, 5, etc.)
   */
  static checkClassicWin(hand, okeyInfo) {
    if (hand.length !== 14) return false;

    // Check 7 pairs
    if (this.canFormPairs(hand, okeyInfo, 7)) {
      return { win: true, type: 'pairs' };
    }

    // Check complete partition into valid pers
    if (this.canPartitionIntoPers(hand, okeyInfo)) {
      return { win: true, type: 'runs' };
    }

    return { win: false };
  }

  /**
   * Helper to check if hand can form N pairs
   */
  static canFormPairs(hand, okeyInfo, targetPairs = 7) {
    const wildcards = hand.filter(t => this.isWildOkey(t, okeyInfo));
    const normals = hand.filter(t => !this.isWildOkey(t, okeyInfo));

    // Group normals by color & value
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

    // Wildcards can pair with singles, or with other wildcards
    let wildCount = wildcards.length;
    while (wildCount > 0 && singles > 0) {
      pairs++;
      singles--;
      wildCount--;
    }
    pairs += Math.floor(wildCount / 2);

    return pairs >= targetPairs;
  }

  /**
   * Recursive partition check to see if hand can be split into valid pers
   */
  static canPartitionIntoPers(hand, okeyInfo) {
    // Generate all valid 3, 4, and 5-tile pers from the hand
    const allPers = [];
    const n = hand.length;

    // Combinations of size 3, 4, 5
    const getCombinations = (arr, size, start = 0, current = []) => {
      if (current.length === size) {
        // Check if current form is a valid per in some permutation
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

    // Backtracking search to find an exact cover of 14 tiles
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

  /**
   * Checks if any permutation of given tiles forms a valid run
   */
  static isValidRunPermutation(tiles, okeyInfo, gameType = 'classic') {
    if (tiles.length < 3) return false;
    // Sort tiles by value and check
    const sorted = [...tiles].sort((a, b) => a.value - b.value);
    if (this.isValidRun(sorted, okeyInfo, gameType)) return true;

    // Also check 1 at the end (e.g. 11, 12, 13, 1) - ONLY in Classic/Düz Okey, NOT in 101!
    if (gameType !== '101') {
      const hasOne = sorted.find(t => t.value === 1 && !this.isWildOkey(t, okeyInfo));
      if (hasOne) {
        const rest = sorted.filter(t => t !== hasOne);
        if (this.isValidRun([...rest, hasOne], okeyInfo, gameType)) return true;
      }
    }

    return false;
  }

  /**
   * Checks if a tile can be processed (işleme) onto an existing open per
   */
  static canProcessTile(tile, openPer, okeyInfo, gameType = '101') {
    if (!tile || !openPer || openPer.length === 0) return null;

    // Check if openPer is a group (same value, different colors)
    if (this.isValidGroup(openPer, okeyInfo)) {
      if (openPer.length >= 4) return null;
      const test = [...openPer, tile];
      if (this.isValidGroup(test, okeyInfo)) {
        return { type: 'group', newPer: test };
      }
    }

    // Check if openPer is a run (consecutive numbers, same color)
    if (this.isValidRun(openPer, okeyInfo, gameType)) {
      // Can we prepend?
      const prepend = [tile, ...openPer];
      if (this.isValidRun(prepend, okeyInfo, gameType)) {
        return { type: 'run-prepend', newPer: prepend };
      }
      // Can we append?
      const append = [...openPer, tile];
      if (this.isValidRun(append, okeyInfo, gameType)) {
        return { type: 'run-append', newPer: append };
      }
    }

    return null;
  }

  /**
   * Automatically organizes a player's rack into runs & sets or pairs
   */
  static autoArrangeRuns(hand, okeyInfo) {
    // Sort by color first, then value
    const sorted = [...hand].sort((a, b) => {
      if (a.color === b.color) {
        return a.value - b.value;
      }
      return a.color.localeCompare(b.color);
    });
    return sorted;
  }

  static autoArrangePairs(hand, okeyInfo) {
    // Group pairs together
    const pairs = [];
    const remaining = [];
    const used = new Set();

    for (let i = 0; i < hand.length; i++) {
      if (used.has(hand[i].id)) continue;
      let matched = false;
      for (let j = i + 1; j < hand.length; j++) {
        if (used.has(hand[j].id)) continue;
        if (this.isPair(hand[i], hand[j], okeyInfo)) {
          pairs.push(hand[i], hand[j]);
          used.add(hand[i].id);
          used.add(hand[j].id);
          matched = true;
          break;
        }
      }
      if (!matched) {
        remaining.push(hand[i]);
      }
    }

    return [...pairs, ...remaining];
  }
}
