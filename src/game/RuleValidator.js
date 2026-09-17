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
   * Intelligently determines if a set of tiles can form a valid run (including wildcards and wrap),
   * and returns the tiles in their canonical sequence order, or null if invalid.
   */
  static getValidRunOrder(tiles, okeyInfo) {
    if (!tiles || tiles.length < 3 || tiles.length > 13) return null;

    const wildcards = tiles.filter(t => this.isWildOkey(t, okeyInfo));
    const normals = tiles.filter(t => !this.isWildOkey(t, okeyInfo));

    // If there are normals, all normals must have the exact same color
    if (normals.length > 0) {
      const color = normals[0].color;
      for (const t of normals) {
        if (t.color !== color) return null;
      }
      // No duplicate values among normals in the same run
      const valSet = new Set();
      for (const t of normals) {
        if (valSet.has(t.value)) return null;
        valSet.add(t.value);
      }
    }

    const L = tiles.length;
    const candidatePatterns = [];

    // 1. Wrap run ending with 1: e.g. [11, 12, 13, 1] or [12, 13, 1]
    const wrapPattern = [];
    for (let k = 0; k < L - 1; k++) {
      wrapPattern.push(13 - (L - 2) + k);
    }
    wrapPattern.push(1);
    if (wrapPattern[0] >= 1) {
      candidatePatterns.push(wrapPattern);
    }

    // 2. Standard consecutive runs: e.g. [1, 2, 3] to [11, 12, 13]
    for (let startVal = 1; startVal <= 14 - L; startVal++) {
      const pat = [];
      for (let k = 0; k < L; k++) pat.push(startVal + k);
      candidatePatterns.push(pat);
    }

    // Test each candidate pattern against the non-wild tiles
    for (const pat of candidatePatterns) {
      let possible = true;
      const normalMap = new Map();
      for (const t of normals) {
        const idx = pat.indexOf(t.value);
        if (idx === -1 || normalMap.has(idx)) {
          possible = false;
          break;
        }
        normalMap.set(idx, t);
      }

      if (possible) {
        const result = new Array(L);
        let wildIdx = 0;
        for (let i = 0; i < L; i++) {
          if (normalMap.has(i)) {
            result[i] = normalMap.get(i);
          } else {
            if (wildIdx < wildcards.length) {
              result[i] = wildcards[wildIdx++];
            } else {
              possible = false;
              break;
            }
          }
        }

        if (possible && this.isValidRun(result, okeyInfo)) {
          return result;
        }
      }
    }

    return null;
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
        } else {
          const orderedRun = this.getValidRunOrder(current, okeyInfo);
          if (orderedRun) {
            candidatePers.push({
              tiles: orderedRun,
              pts: this.getPerPoints(orderedRun, okeyInfo)
            });
          }
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
    return this.getValidRunOrder(tiles, okeyInfo) !== null;
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
  /**
   * Smartly organizes hand into detected runs/groups with gaps between pers,
   * keeping colors together and placing leftovers cleanly.
   */
  static autoArrangeRuns(hand, okeyInfo) {
    if (!hand || hand.length === 0) return Array(30).fill(null);

    const usedIds = new Set();
    const detectedPers = [];

    const normals = hand.filter(t => !this.isWildOkey(t, okeyInfo));
    const wildcards = hand.filter(t => this.isWildOkey(t, okeyInfo));

    // 1. Natural consecutive runs of 3+ (same color)
    const byColor = { red: [], yellow: [], blue: [], black: [] };
    for (const t of normals) {
      if (byColor[t.color]) byColor[t.color].push(t);
    }
    for (const c in byColor) {
      byColor[c].sort((a, b) => a.value - b.value);
      const tiles = byColor[c];
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
            continue; // duplicate number, keep in reserve
          } else {
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

    // 2. Wrap runs: 11-12-13-1 or 12-13-1
    for (const c in byColor) {
      const tiles = byColor[c].filter(t => !usedIds.has(t.id));
      const hasOne = tiles.find(t => t.value === 1);
      const hasThirteen = tiles.find(t => t.value === 13);
      const hasTwelve = tiles.find(t => t.value === 12);
      if (hasOne && hasThirteen && hasTwelve) {
        const hasEleven = tiles.find(t => t.value === 11);
        const wrapPer = hasEleven ? [hasEleven, hasTwelve, hasThirteen, hasOne] : [hasTwelve, hasThirteen, hasOne];
        detectedPers.push(wrapPer);
        wrapPer.forEach(t => usedIds.add(t.id));
      }
    }

    // 3. Groups of same number, different colors (3 or 4)
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

    // 4. Wildcard runs or groups: check if any wildcard can form a 3-tile per with unused tiles
    let wildIdx = 0;
    while (wildIdx < wildcards.length) {
      const wild = wildcards[wildIdx];
      if (usedIds.has(wild.id)) {
        wildIdx++;
        continue;
      }

      let formed = false;
      const unusedNormals = normals.filter(t => !usedIds.has(t.id));
      for (let i = 0; i < unusedNormals.length && !formed; i++) {
        for (let j = i + 1; j < unusedNormals.length && !formed; j++) {
          const a = unusedNormals[i];
          const b = unusedNormals[j];
          const candidate = [a, b, wild];
          const ordered = this.getValidRunOrder(candidate, okeyInfo);
          if (ordered) {
            detectedPers.push(ordered);
            ordered.forEach(t => usedIds.add(t.id));
            formed = true;
            break;
          }
          if (this.isValidGroup(candidate, okeyInfo)) {
            detectedPers.push(candidate);
            candidate.forEach(t => usedIds.add(t.id));
            formed = true;
            break;
          }
        }
      }
      wildIdx++;
    }

    // 5. Sort pers: runs first (by color, start value), groups second (by value)
    const colorRank = { red: 0, yellow: 1, blue: 2, black: 3 };
    detectedPers.sort((a, b) => {
      const aIsRun = a.length > 0 && a[0].color === a[a.length - 1].color;
      const bIsRun = b.length > 0 && b[0].color === b[b.length - 1].color;
      if (aIsRun && !bIsRun) return -1;
      if (!aIsRun && bIsRun) return 1;
      if (aIsRun && bIsRun) {
        const rankA = colorRank[a[0].color] ?? 99;
        const rankB = colorRank[b[0].color] ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        return a[0].value - b[0].value;
      }
      return a[0].value - b[0].value;
    });

    // 6. Build row1 (15 slots) and row2 (15 slots) with 1 gap between pers
    const row1 = Array(15).fill(null);
    const row2 = Array(15).fill(null);

    let r1Idx = 0;
    let r2Idx = 0;
    const remainingPers = [];

    for (const per of detectedPers) {
      const needed = r1Idx === 0 ? per.length : (1 + per.length);
      if (r1Idx + needed <= 15) {
        if (r1Idx > 0) r1Idx++; // Empty slot gap
        for (const t of per) {
          row1[r1Idx++] = t;
        }
      } else {
        remainingPers.push(per);
      }
    }

    for (const per of remainingPers) {
      const needed = r2Idx === 0 ? per.length : (1 + per.length);
      if (r2Idx + needed <= 15) {
        if (r2Idx > 0) r2Idx++; // Empty slot gap
        for (const t of per) {
          row2[r2Idx++] = t;
        }
      } else {
        for (const t of per) {
          if (r2Idx < 15) row2[r2Idx++] = t;
          else if (r1Idx < 15) row1[r1Idx++] = t;
        }
      }
    }

    // 7. Leftover tiles (not in pers)
    const remainingNormals = normals.filter(t => !usedIds.has(t.id));
    const remainingWildcards = wildcards.filter(t => !usedIds.has(t.id));

    const colorOrder = ['red', 'yellow', 'blue', 'black'];
    const leftoverGroups = {};
    for (const c of colorOrder) leftoverGroups[c] = [];
    for (const t of remainingNormals) {
      if (leftoverGroups[t.color]) leftoverGroups[t.color].push(t);
      else leftoverGroups[t.color] = [t];
    }
    for (const c of colorOrder) {
      leftoverGroups[c].sort((a, b) => a.value - b.value);
    }

    const sortedLeftovers = [...remainingWildcards];
    for (const c of colorOrder) {
      sortedLeftovers.push(...leftoverGroups[c]);
    }

    // 8. Place leftovers
    if (r2Idx > 0 && r2Idx < 15 && sortedLeftovers.length > 0 && (r2Idx + 1 + sortedLeftovers.length <= 15)) {
      r2Idx++; // gap after overflowing per on row 2
    }

    let leftoverIdx = 0;
    while (r2Idx < 15 && leftoverIdx < sortedLeftovers.length) {
      row2[r2Idx++] = sortedLeftovers[leftoverIdx++];
    }

    if (leftoverIdx < sortedLeftovers.length) {
      if (r1Idx > 0 && r1Idx < 14) {
        r1Idx++; // gap after row 1 pers
      }
      while (r1Idx < 15 && leftoverIdx < sortedLeftovers.length) {
        row1[r1Idx++] = sortedLeftovers[leftoverIdx++];
      }
    }

    return [...row1, ...row2];
  }

  /**
   * Smartly organizes hand into pairs (Çift Diz) with gaps between pairs
   */
  static autoArrangePairs(hand, okeyInfo) {
    if (!hand || hand.length === 0) return Array(30).fill(null);

    const { pairs } = this.find101Pairs(hand, okeyInfo);
    const usedIds = new Set();
    pairs.forEach(p => {
      usedIds.add(p[0].id);
      usedIds.add(p[1].id);
    });

    const row1 = Array(15).fill(null);
    const row2 = Array(15).fill(null);

    let r1Idx = 0;
    let r2Idx = 0;
    const remainingPairs = [];

    // Place pairs on Row 1 with 1 gap between each pair (up to 5 pairs = 14 slots)
    for (const pair of pairs) {
      const needed = r1Idx === 0 ? 2 : 3;
      if (r1Idx + needed <= 15) {
        if (r1Idx > 0) r1Idx++; // gap
        row1[r1Idx++] = pair[0];
        row1[r1Idx++] = pair[1];
      } else {
        remainingPairs.push(pair);
      }
    }

    for (const pair of remainingPairs) {
      const needed = r2Idx === 0 ? 2 : 3;
      if (r2Idx + needed <= 15) {
        if (r2Idx > 0) r2Idx++;
        row2[r2Idx++] = pair[0];
        row2[r2Idx++] = pair[1];
      } else {
        if (r2Idx < 14) {
          row2[r2Idx++] = pair[0];
          row2[r2Idx++] = pair[1];
        }
      }
    }

    // Leftovers
    const wildcards = hand.filter(t => !usedIds.has(t.id) && this.isWildOkey(t, okeyInfo));
    const normalLeftovers = hand.filter(t => !usedIds.has(t.id) && !this.isWildOkey(t, okeyInfo));
    const colorOrder = ['red', 'yellow', 'blue', 'black'];
    const leftoverGroups = {};
    for (const c of colorOrder) leftoverGroups[c] = [];
    for (const t of normalLeftovers) {
      if (leftoverGroups[t.color]) leftoverGroups[t.color].push(t);
      else leftoverGroups[t.color] = [t];
    }
    for (const c of colorOrder) {
      leftoverGroups[c].sort((a, b) => a.value - b.value);
    }
    const sortedLeftovers = [...wildcards];
    for (const c of colorOrder) {
      sortedLeftovers.push(...leftoverGroups[c]);
    }

    if (r2Idx > 0 && r2Idx < 15 && sortedLeftovers.length > 0 && (r2Idx + 1 + sortedLeftovers.length <= 15)) {
      r2Idx++;
    }

    let leftoverIdx = 0;
    while (r2Idx < 15 && leftoverIdx < sortedLeftovers.length) {
      row2[r2Idx++] = sortedLeftovers[leftoverIdx++];
    }

    if (leftoverIdx < sortedLeftovers.length) {
      if (r1Idx > 0 && r1Idx < 14) r1Idx++;
      while (r1Idx < 15 && leftoverIdx < sortedLeftovers.length) {
        row1[r1Idx++] = sortedLeftovers[leftoverIdx++];
      }
    }

    return [...row1, ...row2];
  }
}
