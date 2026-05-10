// Hey Culligan Man Game
// This file implements the complete logic for a playable browser game based on
// the board game "Hey Culligan Man" (identical to Switchboard). The game
// supports up to four players with an optional CPU opponent. It implements
// dynamic board expansion, pathfinding, tile shifting and rotation, bumping
// mechanics, and a simple CPU strategy.

(() => {
  const DEFAULT_SIGNALING_URL = window.CULLIGAN_SIGNALING_URL || readPersistedValue("culliganSignalingUrl") || "";
  const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
  const TILE_BOUNDS = window.HCM_TILE_BOUNDS || {};
  const ASSET_VERSION = window.CULLIGAN_ASSET_VERSION || "20260509-prelaunch";

  function assetUrl(path) {
    return `${path}?v=${ASSET_VERSION}`;
  }

  /**
   * Master tile data. Each object describes one tile on the initial board.
   * Properties:
   *  - tile_number: string coordinate "row-col" (1-indexed)
   *  - top, left, middle, right, bottom: connection colours. "S" = Soft
   *    water (green), "H" = Hard water (purple), "N" = Neutral (blue), or
   *    "" if no pipe exists at that point.
   *  - connections: adjacency list describing which points connect to which
   *    within the tile.
   */
  const TILE_DATA = [
    { tile_number: "1-1", top: "S", left: "", middle: "N", right: "N", bottom: "H", connections: { top: ["middle"], middle: ["top", "right", "bottom"], right: ["middle"], bottom: ["middle"] } },
    { tile_number: "1-2", top: "", left: "", middle: "N", right: "N", bottom: "N", connections: { middle: ["right", "bottom"], right: ["middle"], bottom: ["middle"] } },
    { tile_number: "1-3", top: "", left: "N", middle: "N", right: "N", bottom: "", connections: { left: ["middle"], middle: ["left", "right"], right: ["middle"] } },
    { tile_number: "1-4", top: "", left: "S", middle: "S", right: "S", bottom: "", connections: { left: ["middle"], middle: ["left", "right"], right: ["middle"] } },
    { tile_number: "1-5", top: "", left: "N", middle: "N", right: "N", bottom: "", connections: { left: ["middle"], middle: ["left", "right"], right: ["middle"] } },
    { tile_number: "1-6", top: "", left: "H", middle: "H", right: "", bottom: "H", connections: { left: ["middle"], middle: ["left", "bottom"], bottom: ["middle"] } },
    { tile_number: "2-1", top: "N", left: "", middle: "N", right: "", bottom: "N", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "2-2", top: "S", left: "S", middle: "N", right: "H", bottom: "H", connections: { top: ["middle"], left: ["middle"], middle: ["top", "left", "right", "bottom"], right: ["middle"], bottom: ["middle"] } },
    { tile_number: "2-3", top: "", left: "", middle: "N", right: "N", bottom: "N", connections: { middle: ["right", "bottom"], right: ["middle"], bottom: ["middle"] } },
    { tile_number: "2-4", top: "", left: "N", middle: "N", right: "N", bottom: "", connections: { left: ["middle"], middle: ["left", "right"], right: ["middle"] } },
    { tile_number: "2-5", top: "", left: "S", middle: "S", right: "", bottom: "S", connections: { left: ["middle"], middle: ["left", "bottom"], bottom: ["middle"] } },
    { tile_number: "2-6", top: "N", left: "", middle: "N", right: "", bottom: "N", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "3-1", top: "H", left: "", middle: "H", right: "", bottom: "H", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "3-2", top: "N", left: "", middle: "N", right: "", bottom: "N", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "3-3", top: "S", left: "S", middle: "N", right: "H", bottom: "H", connections: { top: ["middle"], left: ["middle"], middle: ["top", "left", "right", "bottom"], right: ["middle"], bottom: ["middle"] } },
    { tile_number: "3-4", top: "", left: "", middle: "N", right: "", bottom: "N", connections: { middle: ["bottom"], bottom: ["middle"] } },
    { tile_number: "3-5", top: "N", left: "", middle: "N", right: "", bottom: "N", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "3-6", top: "S", left: "", middle: "S", right: "", bottom: "S", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "4-1", top: "N", left: "", middle: "N", right: "", bottom: "N", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "4-2", top: "H", left: "", middle: "H", right: "", bottom: "H", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "4-3", top: "N", left: "", middle: "N", right: "N", bottom: "", connections: { top: ["middle"], middle: ["top", "right"], right: ["middle"] } },
    { tile_number: "4-4", top: "H", left: "H", middle: "N", right: "S", bottom: "S", connections: { top: ["middle"], left: ["middle"], middle: ["top", "left", "right", "bottom"], right: ["middle"], bottom: ["middle"] } },
    { tile_number: "4-5", top: "H", left: "", middle: "H", right: "", bottom: "H", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "4-6", top: "N", left: "", middle: "N", right: "", bottom: "N", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "5-1", top: "S", left: "", middle: "S", right: "", bottom: "S", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "5-2", top: "N", left: "", middle: "N", right: "N", bottom: "", connections: { top: ["middle"], middle: ["top", "right"], right: ["middle"] } },
    { tile_number: "5-3", top: "", left: "S", middle: "S", right: "S", bottom: "", connections: { left: ["middle"], middle: ["left", "right"], right: ["middle"] } },
    { tile_number: "5-4", top: "", left: "N", middle: "N", right: "N", bottom: "", connections: { left: ["middle"], middle: ["left", "right"], right: ["middle"] } },
    { tile_number: "5-5", top: "H", left: "H", middle: "N", right: "S", bottom: "S", connections: { top: ["middle"], left: ["middle"], middle: ["top", "left", "right", "bottom"], right: ["middle"], bottom: ["middle"] } },
    { tile_number: "5-6", top: "H", left: "", middle: "H", right: "", bottom: "H", connections: { top: ["middle"], middle: ["top", "bottom"], bottom: ["middle"] } },
    { tile_number: "6-1", top: "N", left: "", middle: "N", right: "N", bottom: "", connections: { top: ["middle"], middle: ["top", "right"], right: ["middle"] } },
    { tile_number: "6-2", top: "", left: "H", middle: "H", right: "H", bottom: "", connections: { left: ["middle"], middle: ["left", "right"], right: ["middle"] } },
    { tile_number: "6-3", top: "", left: "N", middle: "N", right: "N", bottom: "", connections: { left: ["middle"], middle: ["left", "right"], right: ["middle"] } },
    { tile_number: "6-4", top: "", left: "S", middle: "S", right: "S", bottom: "", connections: { left: ["middle"], middle: ["left", "right"], right: ["middle"] } },
    { tile_number: "6-5", top: "", left: "N", middle: "N", right: "N", bottom: "", connections: { left: ["middle"], middle: ["left", "right"], right: ["middle"] } },
    { tile_number: "6-6", top: "H", left: "H", middle: "N", right: "S", bottom: "S", connections: { top: ["middle"], left: ["middle"], middle: ["top", "left", "right", "bottom"], right: ["middle"], bottom: ["middle"] } }
  ];

  /**
   * Deep copy of an object. JSON-based for simplicity since our tile
   * definitions do not contain functions.
   * @param {Object} obj
   */
  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Rotate a tile 90 degrees clockwise. Returns a new tile object with
   * rotated connections and side colours. Rotation cycles through top→right→bottom→left.
   * The tile_number property is preserved unchanged because it refers to
   * the initial board coordinate, not current coordinate.
   * @param {Object} tile
   */
  function rotateTile(tile) {
    const rotated = deepCopy(tile);
    rotated.top = tile.left;
    rotated.right = tile.top;
    rotated.bottom = tile.right;
    rotated.left = tile.bottom;
    // rotate connections
    rotated.connections = {};
    // mapping for rotated points
    const mapping = { top: "right", right: "bottom", bottom: "left", left: "top", middle: "middle" };
    for (const [key, arr] of Object.entries(tile.connections)) {
      const newKey = mapping[key];
      rotated.connections[newKey] = arr.map((p) => mapping[p]);
    }
    rotated.middle = tile.middle;
    rotated.rotation = ((tile.rotation || 0) + 1) % 4;
    return rotated;
  }

  /**
   * Given a colour code (S, H, N or ''), return a CSS class for styling the space.
   * @param {string} code
   */
  function getColourClass(code) {
    if (code === "S") return "soft";
    if (code === "H") return "hard";
    if (code === "N") return "neutral";
    return "";
  }

  /**
   * Compute the shortest number of steps required to reach the finish tile
   * from a given position. This function performs a breadth-first search
   * over the network of tile connection points. If the finish is unreachable,
   * returns Infinity. The finish is the center point of the HEY CULLIGAN MAN
   * tile (tile 3-4), so players must land there by exact count. This serves as a
   * heuristic for CPU shift decisions.
   * @param {Object|null} startPos Current player position (null if off-board)
   * @returns {number} Minimum steps to reach finish or Infinity
   */
  function shortestPathLength(startPos) {
    // If starting off-board, the first counted space is the current top-middle
    // entrance of tile 1-1. If that side is blocked, off-board players cannot
    // enter until the start is reopened.
    const start = startPos ? { row: startPos.row, col: startPos.col, space: startPos.space } : getStartEntryPos();
    if (!start) return Infinity;
    const visited = new Set();
    const queue = [];
    queue.push({ pos: start, steps: 0 });
    visited.add(`${start.row},${start.col},${start.space}`);
    while (queue.length > 0) {
      const { pos, steps } = queue.shift();
      if (isFinishSpace(pos)) {
        return steps;
      }
      const neighbors = getNeighbors(pos);
      neighbors.forEach((n) => {
        const key = `${n.row},${n.col},${n.space}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ pos: n, steps: steps + 1 });
        }
      });
    }
    return Infinity;
  }

  function pathDistanceScore(oldDist, newDist) {
    if (oldDist === Infinity && newDist === Infinity) return 0;
    if (oldDist === Infinity && newDist !== Infinity) return 60;
    if (oldDist !== Infinity && newDist === Infinity) return -60;
    return oldDist - newDist;
  }

  function boundedDistanceDelta(oldDist, newDist) {
    if (oldDist === Infinity && newDist === Infinity) return 0;
    if (oldDist === Infinity && newDist !== Infinity) return 36;
    if (oldDist !== Infinity && newDist === Infinity) return -42;
    return Math.max(-24, Math.min(24, oldDist - newDist));
  }

  const DICE_TOTAL_WEIGHTS = [
    { total: 2, combos: 1 },
    { total: 3, combos: 2 },
    { total: 4, combos: 3 },
    { total: 5, combos: 4 },
    { total: 6, combos: 5 },
    { total: 7, combos: 6 },
    { total: 8, combos: 5 },
    { total: 9, combos: 4 },
    { total: 10, combos: 3 },
    { total: 11, combos: 2 },
    { total: 12, combos: 1 },
  ];
  const DICE_COMBO_COUNT = 36;

  function cpuShiftThreshold(plan) {
    if (!plan || !plan.shift) return Infinity;
    if (plan.ridesFinish) return -Infinity;
    const improvesWin = plan.newWinningCombos > plan.oldWinningCombos;
    const blocksThreat = plan.blocksImmediateThreat;
    if (plan.oldWinningCombos > 0 && !improvesWin && !blocksThreat) return Infinity;
    const placement = plan.shift.placement;
    const inPlace = placement && placement.row === plan.shift.row && placement.col === plan.shift.col;
    let threshold = inPlace ? 24 : 18;
    if (plan.oldDistance === Infinity) threshold -= 8;
    if (Number.isFinite(plan.oldDistance) && plan.oldDistance <= 12 && !improvesWin && !blocksThreat) threshold += 28;
    return threshold;
  }

  function shouldCpuUseShift(plan) {
    return Boolean(plan && plan.shift && plan.score >= cpuShiftThreshold(plan));
  }

  function posKey(pos) {
    return `${pos.row},${pos.col},${pos.space}`;
  }

  function samePos(a, b) {
    return Boolean(a && b && a.row === b.row && a.col === b.col && a.space === b.space);
  }

  function isOccupiedPos(pos, excludedIndex = -1) {
    return players.some((player, index) => (
      index !== excludedIndex &&
      player.pos &&
      samePos(player.pos, pos)
    ));
  }

  function findTileCoordByNumber(tileNumber) {
    let found = null;
    boardState.forEach((tile, key) => {
      if (!found && tile && tile.tile_number === tileNumber) {
        const [row, col] = key.split(",").map((n) => parseInt(n, 10));
        found = { row, col, tile };
      }
    });
    return found;
  }

  function getStartEntryPos() {
    const startTile = findTileCoordByNumber("1-1");
    if (!startTile || !startTile.tile || !startTile.tile.top) return null;
    return { row: startTile.row, col: startTile.col, space: "top" };
  }

  const TILE_SIDES = ["top", "right", "bottom", "left"];
  const SIDE_DELTAS = {
    top: { row: -1, col: 0 },
    right: { row: 0, col: 1 },
    bottom: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
  };

  function isSideOpenToTable(row, col, side) {
    const delta = SIDE_DELTAS[side];
    return Boolean(delta && !boardState.has(`${row + delta.row},${col + delta.col}`));
  }

  function chooseQueueSideForStartTile(tile, row = 0, col = 0, respectBoard = true) {
    const exposedPipeSide = TILE_SIDES.find((side) => (
      tile[side] && (!respectBoard || isSideOpenToTable(row, col, side))
    ));
    const fallbackBlankSide = TILE_SIDES.find((side) => !tile[side]);
    const fallbackPipeSide = TILE_SIDES.find((side) => tile[side]);
    return {
      side: exposedPipeSide || fallbackBlankSide || fallbackPipeSide || "top",
      onTileBlank: !exposedPipeSide && Boolean(fallbackBlankSide),
      blocked: !exposedPipeSide,
    };
  }

  function getStartQueueAnchor() {
    const startTile = findTileCoordByNumber("1-1");
    if (!startTile || !startTile.tile) return null;
    const { row, col, tile } = startTile;
    return { row, col, ...chooseQueueSideForStartTile(tile, row, col, true) };
  }

  function queueTokenPointForSide(row, col, side, queueIndex, tileSize, extMinR = 0, extMinC = 0) {
    const spacing = tileSize * 0.24;
    const offset = tileSize * 0.16;
    const tileLeft = (col - extMinC) * tileSize;
    const tileTop = (row - extMinR) * tileSize;
    const centerX = tileLeft + tileSize * 0.5;
    const centerY = tileTop + tileSize * 0.5;
    switch (side) {
      case "right":
        return { x: tileLeft + tileSize + offset + queueIndex * spacing, y: centerY };
      case "bottom":
        return { x: centerX, y: tileTop + tileSize + offset + queueIndex * spacing };
      case "left":
        return { x: tileLeft - offset - queueIndex * spacing, y: centerY };
      case "top":
      default:
        return { x: centerX, y: tileTop - offset - queueIndex * spacing };
    }
  }

  function blankQueueTokenPointForSide(row, col, side, queueIndex, queueCount, tileSize, extMinR = 0, extMinC = 0) {
    const tileLeft = (col - extMinC) * tileSize;
    const tileTop = (row - extMinR) * tileSize;
    const centerIndex = (Math.max(1, queueCount) - 1) / 2;
    const spread = tileSize * 0.18;
    const offset = (queueIndex - centerIndex) * spread;
    const slot = {
      top: { x: 0.5, y: 0.17, axis: "x" },
      right: { x: 0.83, y: 0.5, axis: "y" },
      bottom: { x: 0.5, y: 0.83, axis: "x" },
      left: { x: 0.17, y: 0.5, axis: "y" },
    }[side] || { x: 0.5, y: 0.17, axis: "x" };
    return {
      x: tileLeft + tileSize * slot.x + (slot.axis === "x" ? offset : 0),
      y: tileTop + tileSize * slot.y + (slot.axis === "y" ? offset : 0),
    };
  }

  function oppositeSpace(space) {
    return {
      top: "bottom",
      bottom: "top",
      left: "right",
      right: "left",
    }[space] || null;
  }

  function getSelectableShiftTilesForDice(dice) {
    const x = dice[0];
    const y = dice[1];
    const choices = new Set([`${x}-${y}`, `${y}-${x}`]);
    const selectableTiles = [];
    boardState.forEach((tile, key) => {
      if (choices.has(tile.tile_number)) {
        const [row, col] = key.split(",").map((n) => parseInt(n, 10));
        selectableTiles.push({ row, col });
      }
    });
    return selectableTiles;
  }

  function isFinishSpace(pos) {
    if (!pos || pos.space !== "middle") return false;
    const finishTile = findTileCoordByNumber("3-4");
    if (finishTile) {
      finishRow = finishTile.row;
      finishCol = finishTile.col;
      return pos.row === finishTile.row && pos.col === finishTile.col;
    }
    return pos.row === finishRow && pos.col === finishCol;
  }

  function declareWinnerIfOnFinish(player) {
    if (player && isFinishSpace(player.pos)) {
      declareWinner(player);
      return true;
    }
    return false;
  }

  function declareAnyPlayerOnFinish() {
    const winner = players.find((player) => isFinishSpace(player.pos));
    if (winner) {
      declareWinner(winner);
      return true;
    }
    return false;
  }

  function rotateSpaceName(space, steps) {
    if (space === "middle") return space;
    const order = ["top", "right", "bottom", "left"];
    const index = order.indexOf(space);
    if (index === -1) return space;
    const normalized = ((index + steps) % order.length + order.length) % order.length;
    return order[normalized];
  }

  function rotatePlayersOnTile(row, col, steps) {
    if (steps <= 0) return;
    players.forEach((player) => {
      if (player.pos && player.pos.row === row && player.pos.col === col) {
        player.pos.space = rotateSpaceName(player.pos.space, steps);
      }
    });
  }

  function tileRotationStep(tile) {
    return ((tile && tile.rotation ? tile.rotation : 0) + 4) % 4;
  }

  function tileRotationDelta(fromTile, toTile) {
    const delta = (tileRotationStep(toTile) - tileRotationStep(fromTile) + 4) % 4;
    return delta === 0 ? 4 : delta;
  }

  function tilesHaveSameOrientation(a, b) {
    return Boolean(a && b &&
      JSON.stringify(a.connections) === JSON.stringify(b.connections) &&
      a.top === b.top &&
      a.right === b.right &&
      a.bottom === b.bottom &&
      a.left === b.left &&
      a.middle === b.middle
    );
  }

  function rotationStepsBetweenTiles(fromTile, toTile) {
    if (!fromTile || !toTile) return 0;
    let temp = deepCopy(fromTile);
    for (let steps = 0; steps < 4; steps++) {
      if (tilesHaveSameOrientation(temp, toTile)) return steps;
      temp = rotateTile(temp);
    }
    return tileRotationDelta(fromTile, toTile) % 4;
  }

  function animateTileRotation(tileEl, fromTile, toTile, onDone) {
    const art = tileEl ? tileEl.querySelector(".tile-art") : null;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!art || typeof art.animate !== "function" || reduceMotion) {
      onDone();
      return;
    }

    const fromStep = tileRotationStep(fromTile);
    const delta = tileRotationDelta(fromTile, toTile);
    const fromDeg = fromStep * 90;
    const toDeg = fromDeg + delta * 90;
    const duration = 280 + delta * 65;

    // Hold the start frame inline so there's no flash before the animation kicks in.
    art.style.transform = `rotate(${fromDeg}deg)`;
    const animation = art.animate(
      [
        { transform: `rotate(${fromDeg}deg)` },
        { transform: `rotate(${toDeg}deg)` },
      ],
      {
        duration,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    );

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      // Lock the resulting transform inline so the WAAPI fill can be released.
      art.style.transform = `rotate(${toDeg}deg)`;
      try { animation.cancel(); } catch (e) { /* ignore */ }
      onDone();
    };
    animation.onfinish = finish;
    animation.oncancel = finish;
  }

  function cameraTransform(camera) {
    return `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
  }

  function readCameraTransform(cameraEl) {
    if (!cameraEl) return null;
    const transform = getComputedStyle(cameraEl).transform;
    if (!transform || transform === "none") return { x: 0, y: 0, scale: 1 };
    try {
      const matrix = new DOMMatrixReadOnly(transform);
      return {
        x: matrix.m41,
        y: matrix.m42,
        scale: Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b) || 1,
      };
    } catch (error) {
      const match = transform.match(/matrix\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(",").map((part) => parseFloat(part.trim()));
      if (parts.length < 6 || parts.some((part) => !Number.isFinite(part))) return null;
      return {
        x: parts[4],
        y: parts[5],
        scale: Math.sqrt(parts[0] * parts[0] + parts[1] * parts[1]) || 1,
      };
    }
  }

  function computeBoardCameraTarget(numRows, numCols, tileSize) {
    const viewportWidth = boardContainer.clientWidth || 520;
    const viewportHeight = boardContainer.clientHeight || 520;
    const worldWidth = Math.max(tileSize, numCols * tileSize);
    const worldHeight = Math.max(tileSize, numRows * tileSize);
    const margin = Math.min(36, Math.max(16, Math.min(viewportWidth, viewportHeight) * 0.04));
    const fitScale = Math.min(
      (viewportWidth - margin * 2) / worldWidth,
      (viewportHeight - margin * 2) / worldHeight,
    );
    const scale = Math.max(0.42, Math.min(1.12, fitScale));
    return {
      x: (viewportWidth - worldWidth * scale) / 2,
      y: (viewportHeight - worldHeight * scale) / 2,
      scale,
    };
  }

  function moveBoardCamera(cameraEl, target, animate = true, startOverride = null) {
    if (!cameraEl || !target) return;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = startOverride ? { ...startOverride } : { ...boardCamera };
    const end = { ...target };
    if (boardCameraAnimation) {
      try { boardCameraAnimation.cancel(); } catch (e) { /* ignore */ }
      boardCameraAnimation = null;
    }
    const barelyMoved =
      Math.abs(start.x - end.x) < 0.5 &&
      Math.abs(start.y - end.y) < 0.5 &&
      Math.abs(start.scale - end.scale) < 0.003;
    boardCamera = end;
    if (gameSettings.cameraMotion === "off" || !animate || reduceMotion || barelyMoved || renderCount === 0 || typeof cameraEl.animate !== "function") {
      cameraEl.style.transform = cameraTransform(end);
      refreshTokenRects();
      return;
    }
    cameraEl.style.transform = cameraTransform(start);
    const animation = cameraEl.animate(
      [
        { transform: cameraTransform(start) },
        { transform: cameraTransform(end) },
      ],
      {
        duration: 520,
        easing: "cubic-bezier(0.18, 0.82, 0.18, 1)",
        fill: "forwards",
      },
    );
    boardCameraAnimation = animation;
    animation.finished
      .catch(() => undefined)
      .then(() => {
        if (boardCameraAnimation === animation) boardCameraAnimation = null;
        cameraEl.style.transform = cameraTransform(end);
        refreshTokenRects();
      });
  }

  function recenterBoardCamera(animate = true) {
    const camera = boardContainer ? boardContainer.querySelector(".board-camera") : null;
    const grid = camera ? camera.querySelector(".board-grid") : null;
    if (!camera || !grid) return;
    const styles = getComputedStyle(grid);
    const rows = parseInt(styles.getPropertyValue("--rows"), 10);
    const cols = parseInt(styles.getPropertyValue("--cols"), 10);
    const tileSize = parseFloat(styles.getPropertyValue("--tile-size"));
    if (!Number.isFinite(rows) || !Number.isFinite(cols) || !Number.isFinite(tileSize)) return;
    moveBoardCamera(camera, computeBoardCameraTarget(rows, cols, tileSize), animate);
  }

  // ── User zoom (wheel + pinch) ─────────────────────────────────────────────
  // Scale limits relative to the current fit scale so the board never gets
  // smaller than its auto-fit size and can only zoom in up to 3×.
  const USER_ZOOM_MIN_FACTOR = 1.0;   // can't zoom out past fit
  const USER_ZOOM_MAX_FACTOR = 3.0;

  // How close to the minimum scale (as a ratio) before we snap to center.
  // 1.08 = within 8% above the fit scale snaps back.
  const USER_ZOOM_SNAP_BUFFER = 1.08;

  function applyBoardZoom(newScale, pivotX, pivotY) {
    const camera = boardContainer ? boardContainer.querySelector(".board-camera") : null;
    if (!camera) return;

    // Compute fit scale to enforce limits
    const grid = camera.querySelector(".board-grid");
    let fitTarget = null;
    let minScale = 0.3;
    if (grid) {
      const s = getComputedStyle(grid);
      const rows = parseInt(s.getPropertyValue("--rows"), 10);
      const cols = parseInt(s.getPropertyValue("--cols"), 10);
      const ts   = parseFloat(s.getPropertyValue("--tile-size"));
      if (Number.isFinite(rows) && Number.isFinite(cols) && Number.isFinite(ts)) {
        fitTarget = computeBoardCameraTarget(rows, cols, ts);
        minScale  = fitTarget.scale * USER_ZOOM_MIN_FACTOR;
        newScale  = Math.min(fitTarget.scale * USER_ZOOM_MAX_FACTOR, newScale);
      }
    }
    newScale = Math.max(minScale, newScale);

    // Snap to centered fit when zoomed out to (or near) the minimum
    if (fitTarget && newScale <= fitTarget.scale * USER_ZOOM_SNAP_BUFFER) {
      moveBoardCamera(camera, fitTarget, true);
      return;
    }

    // Pivot: keep the world point under pivotX/pivotY fixed
    const oldScale = boardCamera.scale;
    const factor   = newScale / oldScale;
    const newX     = pivotX - (pivotX - boardCamera.x) * factor;
    const newY     = pivotY - (pivotY - boardCamera.y) * factor;

    if (boardCameraAnimation) {
      try { boardCameraAnimation.cancel(); } catch (e) { /* ignore */ }
      boardCameraAnimation = null;
    }
    boardCamera = { x: newX, y: newY, scale: newScale };
    camera.style.transform = cameraTransform(boardCamera);
    refreshTokenRects();
  }

  function initBoardZoom() {
    if (!boardContainer) return;

    // ── Wheel zoom ────────────────────────────────────────────────────────
    boardContainer.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect  = boardContainer.getBoundingClientRect();
      const pivotX = e.clientX - rect.left;
      const pivotY = e.clientY - rect.top;
      // Normalise delta — trackpads send small floats, mice send 100+
      const delta  = e.deltaY !== 0 ? e.deltaY : -e.deltaX;
      const factor = delta > 0 ? 0.92 : 1 / 0.92;
      applyBoardZoom(boardCamera.scale * factor, pivotX, pivotY);
    }, { passive: false });

    // ── Pinch zoom ────────────────────────────────────────────────────────
    let pinchStartDist  = null;
    let pinchStartScale = null;
    let pinchMidX = 0, pinchMidY = 0;

    boardContainer.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        const t0 = e.touches[0], t1 = e.touches[1];
        pinchStartDist  = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        pinchStartScale = boardCamera.scale;
        const rect = boardContainer.getBoundingClientRect();
        pinchMidX = ((t0.clientX + t1.clientX) / 2) - rect.left;
        pinchMidY = ((t0.clientY + t1.clientY) / 2) - rect.top;
      }
    }, { passive: true });

    boardContainer.addEventListener("touchmove", (e) => {
      if (e.touches.length !== 2 || pinchStartDist === null) return;
      e.preventDefault();
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist   = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const newScale = pinchStartScale * (dist / pinchStartDist);
      applyBoardZoom(newScale, pinchMidX, pinchMidY);
    }, { passive: false });

    boardContainer.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) {
        pinchStartDist  = null;
        pinchStartScale = null;
      }
    }, { passive: true });
  }

  // ── Touch drag-to-place for tile shifting (mobile only) ──────────────────
  // Attached to boardContainer (not individual tiles) because boardContainer is
  // never removed from the DOM. When performShift → renderBoard() destroys the
  // touched tile element, iOS kills the touch sequence for that element — but
  // events still dispatch to boardContainer, keeping the drag alive.
  function initTileDragTouch() {
    if (!boardContainer) return;

    boardContainer.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      if (tileInHand) return;

      // Use the real event target chain — more reliable than elementFromPoint
      const tileEl = e.target.closest(".tile.selectable");
      if (!tileEl || typeof tileEl._shiftHandler !== "function") return;

      e.preventDefault(); // suppress synthetic click
      const touch = e.touches[0];
      cursorLastClientPos = { x: touch.clientX, y: touch.clientY };

      // Remove the click handler so it can't double-fire
      tileEl.removeEventListener("click", tileEl._shiftHandler);

      // Capture the handler ref before clearHighlights() deletes it
      const shiftHandler = tileEl._shiftHandler;

      // Register touchend BEFORE calling the handler — the handler triggers
      // renderBoard() which destroys tile elements, and we need this listener
      // in place before that happens.
      const onEnd = (ev) => {
        if (!tileInHand) return;
        const t = ev.changedTouches[0];
        // elementsFromPoint (plural) pierces the floating tile-cursor overlay
        const allEls = document.elementsFromPoint(t.clientX, t.clientY);
        const candEl = allEls.reduce(
          (found, el) => found || el.closest(".tile.placement"), null
        );
        if (candEl && typeof candEl._placeHandler === "function") {
          cursorLastClientPos = { x: t.clientX, y: t.clientY };
          candEl._placeHandler({ clientX: t.clientX, clientY: t.clientY });
        }
      };
      document.addEventListener("touchend", onEnd, { once: true, passive: true });

      // Fire the shift — this re-renders the board, shows placement candidates
      shiftHandler({ clientX: touch.clientX, clientY: touch.clientY });

    }, { passive: false });
  }

  function analyzeCpuMovePath(cpuPlayer, path) {
    const end = path[path.length - 1];
    const tile = boardState.get(`${end.row},${end.col}`);
    const colour = tile ? tile[end.space] : "";
    const currentDist = shortestPathLength(cpuPlayer.pos);
    const nextDist = shortestPathLength(end);
    const currentFinishProfile = exactFinishProfile(cpuPlayer.pos);
    const nextFinishProfile = exactFinishProfile(end);
    let score = pathDistanceScore(currentDist, nextDist) * 10;
    const notes = [];
    if (isFinishSpace(end)) {
      notes.push("exact finish");
      score = 10000;
    }
    const winningCombosDelta = nextFinishProfile.combos - currentFinishProfile.combos;
    score += winningCombosDelta * 12;
    if (nextFinishProfile.combos > 0) {
      notes.push(`wins on ${nextFinishProfile.totals.join("/")}`);
    }
    if (currentFinishProfile.combos > 0 && nextFinishProfile.combos === 0) {
      score -= 55;
      notes.push("loses next-roll finish chance");
    }
    if (colour === "S") score += 35;
    if (colour === "H") score -= 45;
    const bumpTarget = players.find((p) => p !== cpuPlayer && p.pos && p.pos.row === end.row && p.pos.col === end.col && p.pos.space === end.space);
    if (bumpTarget) score += 30;
    if (colour === "S") notes.push("soft water");
    if (colour === "H") notes.push("hard water");
    if (bumpTarget) notes.push(`bumps ${bumpTarget.name}`);
    let shiftPlan = null;
    let wouldUseShift = false;
    if (!isFinishSpace(end)) {
      const shiftOptions = getSelectableShiftTilesForDice(diceRoll);
      if (shiftOptions.length > 0) {
        const oldPos = cpuPlayer.pos ? { ...cpuPlayer.pos } : null;
        cpuPlayer.pos = { row: end.row, col: end.col, space: end.space };
        shiftPlan = evaluateBestShift(cpuPlayer, shiftOptions);
        cpuPlayer.pos = oldPos;
        wouldUseShift = shouldCpuUseShift(shiftPlan);
        if (wouldUseShift) {
          const cappedShiftValue = Math.max(-80, Math.min(140, shiftPlan.score));
          score += cappedShiftValue * 0.35;
          score += 6;
        }
      }
    }
    return {
      path,
      end,
      currentDist,
      nextDist,
      currentWinningCombos: currentFinishProfile.combos,
      nextWinningCombos: nextFinishProfile.combos,
      special: colour,
      bumpTarget,
      shiftPlan,
      wouldUseShift,
      score,
      notes,
    };
  }

  function scoreCpuMovePath(cpuPlayer, path) {
    return analyzeCpuMovePath(cpuPlayer, path).score;
  }

  const PERSIST_DAYS = 365;
  const SAVED_GAME_KEY = "culligan_saved_game";

  function readCookieValue(key) {
    try {
      const prefix = `${encodeURIComponent(key)}=`;
      const found = document.cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(prefix));
      return found ? decodeURIComponent(found.slice(prefix.length)) : null;
    } catch (error) {
      return null;
    }
  }

  function writeCookieValue(key, value) {
    try {
      const maxAge = PERSIST_DAYS * 24 * 60 * 60;
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
    } catch (error) {
      // file:// and privacy settings can block cookies; localStorage still works.
    }
  }

  function clearCookieValue(key) {
    try {
      document.cookie = `${encodeURIComponent(key)}=; max-age=0; path=/; SameSite=Lax`;
    } catch (error) {
      // Ignore cookie cleanup failures.
    }
  }

  function readPersistedValue(key) {
    try {
      const local = localStorage.getItem(key);
      if (local !== null) return local;
    } catch (error) {
      // Ignore storage failures.
    }
    return readCookieValue(key);
  }

  function writePersistedValue(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Ignore storage failures.
    }
    writeCookieValue(key, value);
  }

  function removePersistedValue(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // Ignore storage failures.
    }
    clearCookieValue(key);
  }

  function readPersistedJSON(key, fallback) {
    try {
      const raw = readPersistedValue(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writePersistedJSON(key, value) {
    writePersistedValue(key, JSON.stringify(value));
  }

  // State variables
  let boardState = new Map(); // maps "row,col" → tile object
  let finishRow = 2; // 0-indexed row of finish tile (tile 3-4)
  let finishCol = 3; // 0-indexed col of finish tile
  let players = []; // list of player objects
  let currentPlayerIndex = 0;
  let diceRoll = [0, 0];
  let gamePhase = "INIT"; // INIT, AWAITING_ROLL, AWAITING_MOVE, AWAITING_SHIFT, AWAITING_BUMP, PLACING_TILE, GAME_OVER
  let awaitingPaths = []; // all computed paths for movement
  let highlightedCells = []; // list of DOM elements currently highlighted for moves
  let highlightedTiles = []; // list of DOM tiles highlighted for shifts
  let placementCandidates = []; // candidate placement cells for shifting
  let tileInHand = null; // tile object removed for shift
  let removedCoord = null; // {row,col}
  let carriedTokenIndices = []; // player indices riding on a shifted tile
  let availableRotations = []; // rotated tile orientations for placement
  let rotationIndex = 0;
  let activePlacementCoord = null;
  let activePlacementRotating = false;
  let activeBumpCoord = null;
  let activeBumpRotating = false;
  let bumpVictim = null; // index of bumped player
  let recentlyPlacedTileKey = null;
  let lastTokenRects = new Map();
  let pendingNewTokenPop = new Set();
  let suppressTokenFlip = new Set();
  let pickedUpTileRect = null;
  let pickedUpTileRotation = 0;
  let pendingTileFlight = null;
  let cursorTileCleanup = null; // cleanup fn for the floating cursor tile
  let cursorLastClientPos = null; // {x,y} of most recent cursor position during tile-in-hand
  let boardCamera = { x: 0, y: 0, scale: 1 };
  let boardCameraAnimation = null;
  let boardCameraFrame = null;
  let suppressNextBoardZoom = false;
  let renderCount = 0;
  let lastGameConfig = { playerCount: 1, cpuCount: 1, names: { humans: ["Player 1"], cpus: ["CPU 1"] } };
  let setupMode = "single";
  let signalingUrl = DEFAULT_SIGNALING_URL;
  let onlineSession = null;
  let applyingRemoteState = false;
  let applyingOnlineAction = false;
  // Delay (in milliseconds) between CPU actions to make its play feel more natural
  // Delay (in milliseconds) between CPU actions to make its play feel more natural
  // Small pause so CPU actions feel deliberate without dragging.
  const SETTINGS_KEY = "hcm-game-settings-v1";
  const SETUP_KEY = "hcm-setup-customization-v1";
  const DEFAULT_SETTINGS = {
    cpuPace: "normal",
    cameraMotion: "smooth",
    disablePlayerMaximums: false,
  };
  let gameSettings = readGameSettings();
  const CPU_DELAY = 350;
  const FIRST_TIP_CPU_DELAY = 3300;

  function readGameSettings() {
    return {
      ...DEFAULT_SETTINGS,
      ...readPersistedJSON(SETTINGS_KEY, {}),
    };
  }

  function saveGameSettings() {
    writePersistedJSON(SETTINGS_KEY, gameSettings);
  }

  function cpuDelay() {
    if (gameSettings.cpuPace === "quick") return 150;
    if (gameSettings.cpuPace === "slow") return 1050;
    return CPU_DELAY;
  }

  function scheduleCpuAction(callback, delay = cpuDelay()) {
    const player = players[currentPlayerIndex];
    if (!player || !player.isCPU || !firstGameTipShowing) {
      return setTimeout(callback, delay);
    }
    let done = false;
    let timer = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("hcm:first-tip-dismissed", finish);
      callback();
    };
    document.addEventListener("hcm:first-tip-dismissed", finish, { once: true });
    timer = setTimeout(finish, Math.max(delay, FIRST_TIP_CPU_DELAY));
    return timer;
  }

  function playerMaximumsDisabled() {
    return gameSettings.disablePlayerMaximums === true;
  }

  function maxPlayerSeats() {
    return playerMaximumsDisabled() ? Infinity : 4;
  }

  // Pre-defined colours for the physical tokens.
  const PLAYER_COLOURS = [
    "#f56565", // red
    "#4299e1", // blue
    "#f6ad55", // orange
    "#9f7aea", // purple
    "#48bb78", // green
    "#ed64a6"  // pink
  ];

  // 20 token "skins" sliced from assets/tokens.png by slice_tokens.py.
  const TOKEN_SKIN_COUNT = 20;
  const TOKEN_SKIN_NAMES = [
    "Heart", "Creep", "Radiation", "Robot", "Muscle",
    "Peace", "Star", "Cat", "Anchor", "Brain",
    "Sunglasses", "Clover", "Skull", "Rocket", "Crown",
    "Flower", "Poop", "Paw", "Drop", "Profile",
  ];

  function randomTokenSkin() {
    return Math.floor(Math.random() * TOKEN_SKIN_COUNT);
  }

  function randomTokenColour() {
    return PICKER_COLOURS[Math.floor(Math.random() * PICKER_COLOURS.length)];
  }

  function tokenIconUrl(skinIndex) {
    const idx = Math.max(0, Math.min(TOKEN_SKIN_COUNT - 1, Number(skinIndex) || 0));
    return assetUrl(`assets/tokens/${idx}.png`);
  }

  /**
   * Apply a player's team colour and, if they have a chosen skin, add a
   * white icon overlay inside the colored circle token.
   */
  function applyTokenSkin(tok, player) {
    tok.style.backgroundColor = player.colour;
    // Remove any stale overlay (e.g. from cloneNode on path-runner).
    tok.querySelector(".token-skin-overlay")?.remove();
    if (player.tokenSkin != null) {
      tok.dataset.skin = String(player.tokenSkin);
      const overlay = document.createElement("span");
      overlay.className = "token-skin-overlay";
      overlay.style.setProperty("--token-icon", `url("${tokenIconUrl(player.tokenSkin)}")`);
      tok.appendChild(overlay);
    }
  }

  // DOM references
  const menuDiv = document.getElementById("main-menu");
  const gameUI = document.getElementById("game-ui");
  const boardContainer = document.getElementById("board-container");
  const turnIndicator = document.getElementById("turn-indicator");
  initBoardZoom();
  initTileDragTouch();
  const rollBtn = document.getElementById("roll-dice");
  const diceDisplay = document.getElementById("dice-display");
  const skipShiftBtn = document.getElementById("skip-shift");
  const setupForm = document.getElementById("game-setup");
  const playerCountInput = document.getElementById("player-count-input");
  const cpuCountInput = document.getElementById("cpu-count-input");
  const nameFieldsContainer = document.getElementById("name-fields");
  const menuSettingsBtn = document.getElementById("menu-settings");
  const menuInstructionsBtn = document.getElementById("menu-instructions");
  const gameInstructionsBtn = document.getElementById("game-instructions");
  const gameSettingsBtn = document.getElementById("game-settings");
  const exitGameBtn = document.getElementById("exit-game");
  const hostOnlineBtn = document.getElementById("host-online");
  const joinOnlineBtn = document.getElementById("join-online");
  const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
  // The action panel is split into a text area (#action-text) and a
  // controls container (#controls-container). We'll use these to display
  // messages and dynamic buttons respectively.
  const actionText = document.getElementById("action-text");
  const turnTokenEl = document.getElementById("turn-token");
  const controlsContainer = document.getElementById("controls-container");
  const overlay = document.getElementById("overlay");
  const tipPanel = document.getElementById("tip-panel");
  const tipTitle = document.getElementById("tip-title");
  const tipText = document.getElementById("tip-text");
  const tipDismissBtn = document.getElementById("tip-dismiss");

  function resetCpuDebugLog() {}

  function logCpuThought() {}

  function describeDistance(distance) {
    return distance === Infinity ? "blocked" : `${distance} steps`;
  }

  function describePos(pos) {
    if (!pos) return "off board";
    const tile = boardState.get(`${pos.row},${pos.col}`);
    const label = tile ? tile.tile_number : `${pos.row + 1}-${pos.col + 1}`;
    return `${label}:${pos.space}`;
  }

  function describeShiftPlan(plan) {
    if (!plan || !plan.shift) return "swap: none";
    const pickupTile = boardState.get(`${plan.shift.row},${plan.shift.col}`);
    const pickup = pickupTile ? pickupTile.tile_number : `${plan.shift.row + 1}-${plan.shift.col + 1}`;
    const place = plan.shift.placement ? `${plan.shift.placement.row + 1}-${plan.shift.placement.col + 1}` : "unknown";
    const rotation = plan.shift.placement ? `${(plan.shift.placement.step || 0) * 90}deg` : "0deg";
    const reasons = plan.shift.reasons && plan.shift.reasons.length
      ? `; ${plan.shift.reasons.slice(0, 4).join(", ")}`
      : "";
    const winInfo = plan.newWinningCombos > 0
      ? `; next-roll wins ${plan.newWinningCombos}/36 on ${plan.newWinningTotals.join("/")}`
      : "";
    return `swap: pick ${pickup}, place at board ${place}, rotate ${rotation}, value ${plan.score.toFixed(1)}${winInfo}${reasons}`;
  }

  /**
   * Remove any temporary action controls such as confirm buttons from the
   * controls container. These controls are tagged with the class
   * `temp-btn` so they can be cleaned up before new buttons are added.
   */
  function clearTempControls() {
    const btns = controlsContainer.querySelectorAll('.temp-btn');
    btns.forEach((btn) => btn.remove());
  }

  function showRollPrompt() {
    const player = players[currentPlayerIndex];
    if (!player || player.isCPU) return;
    actionText.textContent = "Click 'Roll' to begin your turn";
  }

  function onlineGuestIndex() {
    return onlineSession && Number.isInteger(onlineSession.guestPlayerIndex)
      ? onlineSession.guestPlayerIndex
      : 1;
  }

  function onlineLocalSeatIndex() {
    if (!onlineSession) return null;
    if (onlineSession.role === "guest") {
      return Number.isInteger(onlineSession.playerIndex) ? onlineSession.playerIndex : 1;
    }
    return null;
  }

  function isGuestControlledSeat(index = currentPlayerIndex) {
    return Boolean(onlineSession && onlineSession.role === "guest" && index === onlineLocalSeatIndex());
  }

  function isRemoteGuestSeatOnHost(index = currentPlayerIndex) {
    return Boolean(onlineSession && onlineSession.role === "host" && index === onlineGuestIndex());
  }

  function isCurrentPlayerLocallyControlled() {
    const player = players[currentPlayerIndex];
    if (!player || player.isCPU) return false;
    if (!onlineSession) return true;
    if (onlineSession.role === "host") return !isRemoteGuestSeatOnHost(currentPlayerIndex);
    if (onlineSession.role === "guest") return isGuestControlledSeat(currentPlayerIndex);
    return true;
  }

  function shouldSendGuestAction() {
    return Boolean(!applyingOnlineAction && onlineSession && onlineSession.role === "guest" && isGuestControlledSeat(currentPlayerIndex));
  }

  function sendOnlineAction(action) {
    sendOnlineMessage({ type: "action", action });
  }

  function refreshOnlineTurnControls() {
    if (!onlineSession || gamePhase === "INIT" || gamePhase === "GAME_OVER") return;
    const player = players[currentPlayerIndex];
    const localHuman = isCurrentPlayerLocallyControlled();
    if (gamePhase === "AWAITING_ROLL") {
      rollBtn.disabled = !localHuman;
      if (localHuman) {
        showRollPrompt();
      } else if (player && !player.isCPU) {
        actionText.textContent = `Waiting for ${player.name} to roll.`;
      }
    }
  }

  function showCpuStepControl(label) {
    clearTempControls();
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.className = "control-btn temp-btn cpu-step-btn cpu-active-control";
    btn.disabled = true;
    controlsContainer.appendChild(btn);
  }

  function clearCpuActiveControls() {
    rollBtn.classList.remove("cpu-active-control");
    skipShiftBtn.classList.remove("cpu-active-control");
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function hideOverlay() {
    overlay.onclick = null;
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
  }

  function showOverlayModal(html, options = {}) {
    overlay.innerHTML = html;
    overlay.classList.remove("hidden");
    const closeButtons = overlay.querySelectorAll("[data-close-modal]");
    closeButtons.forEach((button) => {
      button.addEventListener("click", hideOverlay);
    });
    overlay.onclick = options.closeOnBackdrop
      ? (event) => {
          if (event.target === overlay) hideOverlay();
        }
      : null;
  }

  // Full set of pickable player colors.
  const PICKER_COLOURS = [
    "#f56565", "#e53e3e", "#c53030",  // reds
    "#f6ad55", "#ed8936", "#dd6b20",  // oranges
    "#f6e05e", "#d69e2e",             // yellows
    "#68d391", "#48bb78", "#2f855a",  // greens
    "#63b3ed", "#4299e1", "#2b6cb0",  // blues
    "#9f7aea", "#805ad5", "#553c9a",  // purples
    "#f687b3", "#ed64a6", "#b83280",  // pinks
    "#a0aec0", "#4a5568", "#1a202c",  // grays
  ];

  /**
   * Show the token-skin + colour picker as a popup modal.
   * `colour`      — current player colour (used to tint icons).
   * `currentSkin` — currently selected skin index.
   * `onPick(skin, colour)` — called when the user confirms a selection.
   */
  function openTokenPicker({ colour, currentSkin, playerName, onPick }) {
    let activeColour = colour;
    let activeSkin = currentSkin;

    const cellsHtml = [];
    for (let i = 0; i < TOKEN_SKIN_COUNT; i++) {
      cellsHtml.push(
        `<button type="button" class="token-popup-cell${i === activeSkin ? " selected" : ""}" data-skin="${i}" aria-label="${escapeHTML(TOKEN_SKIN_NAMES[i] || ("Token " + (i + 1)))}">` +
        `<span class="token-popup-icon" style="--cell-colour: ${escapeHTML(activeColour)}; --cell-icon: url('${tokenIconUrl(i)}');"></span>` +
        `</button>`
      );
    }
    const swatchesHtml = PICKER_COLOURS.map((c) =>
      `<button type="button" class="token-color-swatch${c === activeColour ? " selected" : ""}" data-colour="${escapeHTML(c)}" style="background-color:${escapeHTML(c)}" aria-label="${escapeHTML(c)}"></button>`
    ).join("");

    showOverlayModal(`
      <div class="modal token-popup-modal" role="dialog" aria-modal="true" aria-labelledby="token-picker-title">
        <h3 id="token-picker-title">Choose ${escapeHTML(playerName || "your")}'s token</h3>
        <div class="token-popup-preview" data-skin="${activeSkin}" style="background-color: ${escapeHTML(activeColour)}; --token-icon: url('${tokenIconUrl(activeSkin)}');"></div>
        <div class="token-popup-grid">${cellsHtml.join("")}</div>
        <div class="token-popup-section-label">Color</div>
        <div class="token-color-swatches">${swatchesHtml}</div>
        <div class="token-popup-actions">
          <button type="button" class="token-popup-cancel" data-close-modal>Cancel</button>
          <button type="button" class="token-popup-randomize">Random</button>
          <button type="button" class="token-popup-save">Save</button>
        </div>
      </div>
    `, { closeOnBackdrop: true });

    // Helper: sync the preview circle to current activeSkin + activeColour
    const preview = overlay.querySelector(".token-popup-preview");
    const syncPreview = () => {
      preview.style.backgroundColor = activeColour;
      preview.dataset.skin = String(activeSkin);
      preview.style.setProperty("--token-icon", `url("${tokenIconUrl(activeSkin)}")`);
    };
    syncPreview();

    // Icon selection — highlight only, don't close
    overlay.querySelectorAll(".token-popup-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        activeSkin = Number(cell.dataset.skin);
        overlay.querySelectorAll(".token-popup-cell").forEach((c) => {
          c.classList.toggle("selected", Number(c.dataset.skin) === activeSkin);
        });
        syncPreview();
      });
    });

    // Color swatch selection — update tints + preview live
    overlay.querySelectorAll(".token-color-swatch").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        activeColour = swatch.dataset.colour;
        overlay.querySelectorAll(".token-popup-icon").forEach((icon) => {
          icon.style.setProperty("--cell-colour", activeColour);
        });
        overlay.querySelectorAll(".token-color-swatch").forEach((s) => {
          s.classList.toggle("selected", s.dataset.colour === activeColour);
        });
        syncPreview();
      });
    });

    // Randomize — pick random skin + colour, update everything live
    const applyRandom = () => {
      activeSkin = randomTokenSkin();
      activeColour = randomTokenColour();
      overlay.querySelectorAll(".token-popup-cell").forEach((c) => {
        c.classList.toggle("selected", Number(c.dataset.skin) === activeSkin);
      });
      overlay.querySelectorAll(".token-popup-icon").forEach((icon) => {
        icon.style.setProperty("--cell-colour", activeColour);
      });
      overlay.querySelectorAll(".token-color-swatch").forEach((s) => {
        s.classList.toggle("selected", s.dataset.colour === activeColour);
      });
      syncPreview();
    };
    overlay.querySelector(".token-popup-randomize").addEventListener("click", applyRandom);

    // Save — fire callback and close
    overlay.querySelector(".token-popup-save").addEventListener("click", () => {
      if (typeof onPick === "function") onPick(activeSkin, activeColour);
      hideOverlay();
    });
  }

  function showInstructions() {
    showOverlayModal(`
      <div class="modal instructions-modal" role="dialog" aria-modal="true" aria-labelledby="instructions-title">
        <div class="modal-header">
          <h2 id="instructions-title">How To Play</h2>
          <button class="close-modal" type="button" aria-label="Close instructions" data-close-modal>&times;</button>
        </div>
        <p>Roll, move the exact count along connected pipe, then optionally shift one of the numbered tiles from your dice.</p>
        <div class="instruction-grid">
          <div class="instruction-item">
            <strong>Move</strong>
            Pick a continuous path and use the full roll. If no full path exists, your token stays put.
          </div>
          <div class="instruction-item">
            <strong>Shift</strong>
            A roll like 2 and 5 lets you move tile 2-5 or 5-2. The placed tile must make a pipe connection.
          </div>
          <div class="instruction-item">
            <strong>Soft Water</strong>
            Landing on green gives you another turn.
          </div>
          <div class="instruction-item">
            <strong>Hard Water</strong>
            Landing on purple makes you miss your next turn.
          </div>
          <div class="instruction-item">
            <strong>Bumping</strong>
            Landing on another token lets you move it to a neutral space, then rotate that tile if you want.
          </div>
          <div class="instruction-item">
            <strong>Win</strong>
            Reach Hey Culligan Man by exact count.
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" data-close-modal>Got It</button>
        </div>
      </div>
    `, { closeOnBackdrop: true });
  }

  function settingSelected(name, value) {
    return gameSettings[name] === value ? "selected" : "";
  }

  function showSettings() {
    showOverlayModal(`
      <div class="modal settings-modal compact" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="modal-header">
          <h2 id="settings-title">Settings</h2>
          <button class="close-modal" type="button" aria-label="Close settings" data-close-modal>&times;</button>
        </div>
        <form id="settings-form" class="settings-form">
          <label class="settings-row" for="cpu-pace-setting">
            <span>
              <strong>CPU Pace</strong>
              <small>Controls how long CPU actions stay visible.</small>
            </span>
            <select id="cpu-pace-setting" name="cpuPace">
              <option value="quick" ${settingSelected("cpuPace", "quick")}>Quick</option>
              <option value="normal" ${settingSelected("cpuPace", "normal")}>Normal</option>
              <option value="slow" ${settingSelected("cpuPace", "slow")}>Slow</option>
            </select>
          </label>
          <label class="settings-row" for="camera-motion-setting">
            <span>
              <strong>Camera Motion</strong>
              <small>Turn off camera glides if the movement feels distracting.</small>
            </span>
            <select id="camera-motion-setting" name="cameraMotion">
              <option value="smooth" ${settingSelected("cameraMotion", "smooth")}>Smooth</option>
              <option value="off" ${settingSelected("cameraMotion", "off")}>Off</option>
            </select>
          </label>
          <label class="settings-check advanced-setting" for="disable-player-maximums-setting">
            <span>
              <strong>Disable Player Maximums</strong>
              <small>Experimental. Extra seats may break game balance, token spacing, or parts of the programming.</small>
            </span>
            <input id="disable-player-maximums-setting" name="disablePlayerMaximums" type="checkbox" ${gameSettings.disablePlayerMaximums ? "checked" : ""} />
          </label>
          <div class="modal-actions settings-actions">
            <button id="reset-tips-setting" class="secondary" type="button">Reset Tips</button>
            <button type="submit">Save</button>
          </div>
        </form>
      </div>
    `, { closeOnBackdrop: true });
    const form = document.getElementById("settings-form");
    const resetTips = document.getElementById("reset-tips-setting");
    if (resetTips) {
      resetTips.addEventListener("click", () => {
        removePersistedValue(FIRST_GAME_TIPS_COMPLETE_KEY);
        removePersistedValue(FIRST_GAME_TIPS_SEEN_KEY);
        firstGameTipsSeen = new Set();
        firstGameTipQueue = [];
        hideFirstGameTip();
        resetTips.textContent = "Tips Reset";
      });
    }
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        gameSettings = {
          ...gameSettings,
          cpuPace: data.get("cpuPace") || "normal",
          cameraMotion: data.get("cameraMotion") || "smooth",
          disablePlayerMaximums: data.get("disablePlayerMaximums") === "on",
        };
        saveGameSettings();
        saveSetupSnapshot(readSetupConfig());
        hideOverlay();
        recenterBoardCamera(true);
      });
    }
  }

  const FIRST_GAME_TIPS_COMPLETE_KEY = "hcm-first-game-tips-complete-v3";
  const FIRST_GAME_TIPS_SEEN_KEY = "hcm-first-game-tips-seen-v3";
  const FIRST_GAME_TIPS = {
    roll: {
      title: "Roll",
      text: "The dice total is your movement count. The two die faces also name the tile or tiles you may shift after moving.",
    },
    move: {
      title: "Move",
      text: "Choose one highlighted destination. You must use the full count along one continuous pipe path.",
    },
    noMove: {
      title: "No Move",
      text: "If no full-count path exists, your token stays put. You still get the tile-shift part of the turn.",
    },
    shift: {
      title: "Shift",
      text: "After moving, you may pick up one highlighted tile named by your dice, or skip the shift.",
    },
    skipShift: {
      title: "Skip Shift",
      text: "Skipping is allowed. Sometimes leaving the board alone is better than giving someone else a cleaner route.",
    },
    placeTile: {
      title: "Place",
      text: "Drop the tile on a yellow space. A legal placement must make at least one pipe connection.",
    },
    rotateTile: {
      title: "Rotate",
      text: "Click the placed tile to rotate it. Confirm placement when the pipe points where you want it.",
    },
    confirmPlacement: {
      title: "Confirm",
      text: "Confirm placement ends the shift and passes the turn, unless Soft Water gives this player another roll.",
    },
    softWater: {
      title: "Soft Water",
      text: "Landing on green gives this player another turn after the shift.",
    },
    hardWater: {
      title: "Hard Water",
      text: "Landing on purple marks this player to miss their next turn. This turn still finishes normally.",
    },
    bump: {
      title: "Bump",
      text: "Landing on another token causes a bump: move that token to a neutral space, then rotate its tile if useful.",
    },
    cpuTurn: {
      title: "CPU Turn",
      text: "CPU players use the same turn structure: roll, move if possible, then shift or skip.",
    },
  };
  let firstGameTipsActive = false;
  let firstGameTipsSeen = new Set();
  let firstGameTipQueue = [];
  let firstGameTipShowing = false;
  let firstGameTipCurrentKey = null;

  function readStoredTipKeys() {
    try {
      const parsed = readPersistedJSON(FIRST_GAME_TIPS_SEEN_KEY, []);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function persistSeenTips() {
    writePersistedJSON(FIRST_GAME_TIPS_SEEN_KEY, [...firstGameTipsSeen]);
  }

  function hasCompletedFirstGameTips() {
    return readPersistedValue(FIRST_GAME_TIPS_COMPLETE_KEY) === "1";
  }

  function beginFirstGameTips() {
    firstGameTipsSeen = new Set(readStoredTipKeys());
    firstGameTipQueue = [];
    firstGameTipShowing = false;
    firstGameTipCurrentKey = null;
    firstGameTipsActive = !hasCompletedFirstGameTips();
    hideFirstGameTip();
  }

  function completeFirstGameTips() {
    firstGameTipsActive = false;
    firstGameTipQueue = [];
    firstGameTipShowing = false;
    firstGameTipCurrentKey = null;
    hideFirstGameTip();
    writePersistedValue(FIRST_GAME_TIPS_COMPLETE_KEY, "1");
  }

  function hideFirstGameTip() {
    if (tipPanel) tipPanel.classList.add("hidden");
    firstGameTipShowing = false;
    firstGameTipCurrentKey = null;
  }

  function showNextFirstGameTip() {
    if (!firstGameTipsActive || firstGameTipShowing || firstGameTipQueue.length === 0) return;
    const tip = firstGameTipQueue.shift();
    if (!tipPanel || !tipTitle || !tipText) return;
    tipTitle.textContent = tip.title;
    tipText.textContent = tip.text;
    tipPanel.classList.remove("hidden");
    firstGameTipShowing = true;
    firstGameTipCurrentKey = tip.key || null;
  }

  function dismissFirstGameTip() {
    hideFirstGameTip();
    document.dispatchEvent(new CustomEvent("hcm:first-tip-dismissed"));
    showNextFirstGameTip();
  }

  function maybeShowFirstGameTip(key, options = {}) {
    if (!firstGameTipsActive) return;
    if (options.humanOnly) {
      const player = players[currentPlayerIndex];
      if (!player || player.isCPU) return;
    }
    if (firstGameTipsSeen.has(key)) return;
    const tip = FIRST_GAME_TIPS[key];
    if (!tip) return;
    firstGameTipsSeen.add(key);
    persistSeenTips();
    firstGameTipQueue.push({ key, ...tip });
    showNextFirstGameTip();
  }

  function completeFirstGameTip(key) {
    if (!key) return;
    firstGameTipQueue = firstGameTipQueue.filter((tip) => tip.key !== key);
    if (firstGameTipCurrentKey === key) {
      hideFirstGameTip();
      showNextFirstGameTip();
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function diceForTotal(total) {
    for (let a = 1; a <= 6; a++) {
      const b = total - a;
      if (b >= 1 && b <= 6) return [a, b];
    }
    return [1, 1];
  }

  function rollDie() {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const value = new Uint8Array(1);
      do {
        window.crypto.getRandomValues(value);
      } while (value[0] >= 252);
      return (value[0] % 6) + 1;
    }
    return Math.floor(Math.random() * 6) + 1;
  }

  function rollDicePair() {
    if (Array.isArray(window.__hcmForcedRollQueue) && window.__hcmForcedRollQueue.length > 0) {
      const forced = window.__hcmForcedRollQueue.shift();
      if (Array.isArray(forced) && forced.length >= 2) {
        return [Number(forced[0]) || 1, Number(forced[1]) || 1];
      }
    }
    return [rollDie(), rollDie()];
  }

  function normalizeSignalingUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function setSignalingUrl(value) {
    signalingUrl = normalizeSignalingUrl(value);
    if (signalingUrl) {
      writePersistedValue("culliganSignalingUrl", signalingUrl);
    } else {
      removePersistedValue("culliganSignalingUrl");
    }
  }

  function ensureSignalingUrl() {
    if (signalingUrl) return true;
    showOverlayModal(`
      <div class="modal compact" role="dialog" aria-modal="true" aria-labelledby="online-setup-title">
        <div class="modal-header">
          <h2 id="online-setup-title">Online Setup</h2>
          <button class="close-modal" type="button" aria-label="Close online setup" data-close-modal>&times;</button>
        </div>
        <p>Paste your Cloudflare Worker URL once. The game will remember it for room codes.</p>
        <form id="online-endpoint-form" class="online-form">
          <input id="online-endpoint-input" type="url" placeholder="https://hey-culligan-signaling.yourname.workers.dev" autocomplete="off" />
          <button type="submit">Save Endpoint</button>
        </form>
      </div>
    `, { closeOnBackdrop: true });
    const form = document.getElementById("online-endpoint-form");
    const input = document.getElementById("online-endpoint-input");
    if (input) input.value = signalingUrl;
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        setSignalingUrl(input ? input.value : "");
        hideOverlay();
      });
    }
    return false;
  }

  function onlineFetch(path, options = {}) {
    if (!signalingUrl) return Promise.reject(new Error("No signaling endpoint configured."));
    return fetch(`${signalingUrl}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {}),
      },
    })
      .catch(() => {
        throw new Error(`Could not reach the online signaling server at ${signalingUrl}. Make sure the Cloudflare Worker is deployed and the URL is correct.`);
      })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
        return data;
      });
  }

  function createPeerConnection() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onconnectionstatechange = () => {
      if (!onlineSession) return;
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        actionText.textContent = "Online connection closed.";
      }
    };
    return pc;
  }

  function waitForIceGathering(pc) {
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 4000);
      pc.addEventListener("icegatheringstatechange", () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }

  function showOnlineStatus(title, html) {
    showOverlayModal(`
      <div class="modal compact online-modal" role="dialog" aria-modal="true" aria-labelledby="online-title">
        <div class="modal-header">
          <h2 id="online-title">${escapeHTML(title)}</h2>
          <button class="close-modal" type="button" aria-label="Close online setup" data-close-modal>&times;</button>
        </div>
        ${html}
      </div>
    `, { closeOnBackdrop: false });
  }

  function setOnlineSession(session) {
    if (onlineSession && onlineSession.pc) {
      try { onlineSession.pc.close(); } catch (e) { /* ignore */ }
    }
    onlineSession = session;
  }

  function sendOnlineMessage(message) {
    if (!onlineSession || !onlineSession.channel || onlineSession.channel.readyState !== "open") return;
    onlineSession.channel.send(JSON.stringify(message));
  }

  function serializeGameState() {
    return {
      board: Array.from(boardState.entries()).map(([key, tile]) => [key, deepCopy(tile)]),
      finishRow,
      finishCol,
      players: deepCopy(players),
      currentPlayerIndex,
      diceRoll: [...diceRoll],
      gamePhase,
      lastGameConfig: { ...lastGameConfig },
      actionText: actionText.textContent,
    };
  }

  function applyRemoteGameState(state) {
    if (!state) return;
    applyingRemoteState = true;
    boardState = new Map((state.board || []).map(([key, tile]) => [key, deepCopy(tile)]));
    finishRow = state.finishRow;
    finishCol = state.finishCol;
    players = deepCopy(state.players || []).map((player) => ({
      ...player,
      extraTurnPending: Boolean(player.extraTurnPending),
    }));
    currentPlayerIndex = state.currentPlayerIndex || 0;
    diceRoll = Array.isArray(state.diceRoll) ? [...state.diceRoll] : [0, 0];
    gamePhase = state.gamePhase || "INIT";
    lastGameConfig = state.lastGameConfig || lastGameConfig;
    actionText.textContent = state.actionText || "";
    document.body.classList.toggle("game-active", gamePhase !== "INIT");
    menuDiv.classList.toggle("hidden", gamePhase !== "INIT");
    gameUI.classList.toggle("hidden", gamePhase === "INIT");
    renderBoard();
    updateTurnIndicator();
    if (diceRoll[0] && diceRoll[1]) renderDiceResult(diceRoll[0], diceRoll[1]);
    skipShiftBtn.classList.add("hidden");
    clearTempControls();
    applyingRemoteState = false;
    syncRemoteTurnControls();
  }

  function broadcastGameState() {
    if (!onlineSession || onlineSession.role !== "host" || applyingRemoteState) return;
    sendOnlineMessage({ type: "state", state: serializeGameState() });
  }

  function syncRemoteTurnControls() {
    if (!onlineSession || onlineSession.role !== "guest") return;
    clearHighlights();
    clearTempControls();
    const player = players[currentPlayerIndex];
    const controlsThisSeat = isGuestControlledSeat(currentPlayerIndex) && player && !player.isCPU;
    rollBtn.disabled = !controlsThisSeat || gamePhase !== "AWAITING_ROLL";
    skipShiftBtn.classList.add("hidden");
    if (!controlsThisSeat) {
      if (player && !player.isCPU && gamePhase !== "GAME_OVER") {
        actionText.textContent = `Waiting for ${player.name}.`;
      }
      return;
    }
    if (gamePhase === "AWAITING_ROLL") {
      showRollPrompt();
    } else if (gamePhase === "AWAITING_MOVE" && diceRoll[0] && diceRoll[1]) {
      computeValidMoves(diceRoll[0] + diceRoll[1]);
    } else if (gamePhase === "AWAITING_SHIFT" && diceRoll[0] && diceRoll[1]) {
      showShiftOptions(diceRoll);
    } else {
      rollBtn.disabled = true;
    }
  }

  function matchingAwaitingPath(endPos) {
    if (!endPos) return null;
    if (!awaitingPaths.length && diceRoll[0] && diceRoll[1]) {
      const player = players[currentPlayerIndex];
      const steps = movementStepsForDiceTotal(player ? player.pos : null, diceRoll[0] + diceRoll[1]);
      awaitingPaths = findPaths(player ? player.pos : null, steps);
    }
    return awaitingPaths.find((path) => {
      const end = path[path.length - 1];
      return end && end.row === endPos.row && end.col === endPos.col && end.space === endPos.space;
    }) || null;
  }

  function matchingPlacementCandidate(target) {
    if (!tileInHand || !removedCoord || !target) return null;
    const candidates = computePlacementCandidates(removedCoord.row, removedCoord.col, tileInHand)
      .map((candidate) => ({ ...candidate, allowRotation: true }));
    return candidates.find((candidate) => candidate.row === target.row && candidate.col === target.col) || null;
  }

  // Host-side helpers: trigger the same handler that a human click would fire,
  // by calling the stored _rotateHandler / _confirmBtn on the live DOM.
  function rotateActivePlacement() {
    const tile = document.querySelector(".tile.selectable[data-row][data-col]");
    if (tile && typeof tile._rotateHandler === "function") tile._rotateHandler();
  }

  function confirmActivePlacement() {
    const btn = Array.from(controlsContainer.querySelectorAll(".temp-btn"))
      .find((b) => b.textContent.trim().startsWith("Confirm Placement"));
    if (btn) btn.click();
  }

  function rotateActiveBump() {
    const tile = document.querySelector(".tile.selectable[data-row][data-col]");
    if (tile && typeof tile._rotateHandler === "function") tile._rotateHandler();
  }

  function confirmActiveBumpRotation() {
    const btn = Array.from(controlsContainer.querySelectorAll(".temp-btn"))
      .find((b) => b.textContent.trim().startsWith("Confirm Rotation"));
    if (btn) btn.click();
  }

  async function handleOnlineAction(action) {
    if (!onlineSession || onlineSession.role !== "host" || !action) return;
    if (!isRemoteGuestSeatOnHost(currentPlayerIndex)) return;
    applyingOnlineAction = true;
    try {
      if (action.kind === "roll" && gamePhase === "AWAITING_ROLL") {
        rollDice();
      } else if (action.kind === "move" && gamePhase === "AWAITING_MOVE") {
        const path = matchingAwaitingPath(action.end);
        if (path) await handleMove(path);
      } else if (action.kind === "skipShift" && gamePhase === "AWAITING_SHIFT") {
        completeFirstGameTip("skipShift");
        endTurn();
      } else if (action.kind === "shiftTile" && gamePhase === "AWAITING_SHIFT") {
        performShift(action.row, action.col);
      } else if (action.kind === "placeTile" && gamePhase === "PLACING_TILE") {
        const candidate = matchingPlacementCandidate(action);
        if (candidate) placeTileAt(candidate);
      } else if (action.kind === "rotatePlacement" && gamePhase === "PLACING_TILE") {
        rotateActivePlacement();
      } else if (action.kind === "confirmPlacement" && gamePhase === "PLACING_TILE") {
        confirmActivePlacement();
      } else if (action.kind === "bumpRelocate" && gamePhase === "AWAITING_BUMP") {
        executeBump(action.pos);
      } else if (action.kind === "rotateBump" && gamePhase === "AWAITING_BUMP") {
        rotateActiveBump();
      } else if (action.kind === "confirmBump" && gamePhase === "AWAITING_BUMP") {
        confirmActiveBumpRotation();
      }
    } finally {
      applyingOnlineAction = false;
      broadcastGameState();
    }
  }

  function attachOnlineChannel(channel) {
    if (!onlineSession) return;
    onlineSession.channel = channel;
    channel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "state") applyRemoteGameState(message.state);
      if (message.type === "action") handleOnlineAction(message.action);
      if (message.type === "hello" && onlineSession && onlineSession.role === "host") {
        sendOnlineMessage({ type: "state", state: serializeGameState() });
      }
    };
    channel.onopen = () => {
      if (!onlineSession) return;
      onlineSession.connected = true;
      if (onlineSession.role === "host") {
        showOnlineStatus("Player Connected", `
          <p>Your peer is connected. They will control Player 2 from their screen.</p>
          <div class="modal-actions">
            <button type="button" data-close-modal>Got It</button>
          </div>
        `);
        onlineSession.guestPlayerIndex = 1;
        sendOnlineMessage({ type: "state", state: serializeGameState() });
      } else {
        onlineSession.playerIndex = 1;
        hideOverlay();
        sendOnlineMessage({ type: "hello" });
      }
    };
  }

  async function hostOnlineGame() {
    if (!ensureSignalingUrl()) return;
    const pc = createPeerConnection();
    const channel = pc.createDataChannel("culligan-game", { ordered: true });
    setOnlineSession({ role: "host", pc, channel, code: null, connected: false, guestPlayerIndex: 1 });
    attachOnlineChannel(channel);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);
    const room = await onlineFetch("/rooms", {
      method: "POST",
      body: JSON.stringify({ offer: pc.localDescription }),
    });
    onlineSession.code = room.code;
    showOnlineStatus("Host Online Game", `
      <p>Send this room code to your opponent.</p>
      <div class="online-code">${escapeHTML(room.code)}</div>
      <p class="online-status" id="online-room-status">Waiting for player...</p>
      <div class="modal-actions">
        <button type="button" data-close-modal>Keep Waiting</button>
      </div>
    `);
    const poll = setInterval(async () => {
      if (!onlineSession || onlineSession.role !== "host" || onlineSession.connected) {
        clearInterval(poll);
        return;
      }
      try {
        const latest = await onlineFetch(`/rooms/${encodeURIComponent(room.code)}`);
        if (latest.answer) {
          clearInterval(poll);
          await pc.setRemoteDescription(latest.answer);
          const status = document.getElementById("online-room-status");
          if (status) status.textContent = "Connected.";
        }
      } catch (error) {
        const status = document.getElementById("online-room-status");
        if (status) status.textContent = error.message;
      }
    }, 1800);
  }

  function showJoinOnlineForm() {
    if (!ensureSignalingUrl()) return;
    showOverlayModal(`
      <div class="modal compact online-modal" role="dialog" aria-modal="true" aria-labelledby="join-online-title">
        <div class="modal-header">
          <h2 id="join-online-title">Join Online Game</h2>
          <button class="close-modal" type="button" aria-label="Close join dialog" data-close-modal>&times;</button>
        </div>
        <p>Enter the room code from the host.</p>
        <form id="join-online-form" class="online-form">
          <input id="join-code-input" type="text" maxlength="8" placeholder="7KQ2" autocomplete="off" />
          <button type="submit">Join Game</button>
        </form>
        <p class="online-status" id="join-online-status"></p>
      </div>
    `, { closeOnBackdrop: true });
    const form = document.getElementById("join-online-form");
    const input = document.getElementById("join-code-input");
    const status = document.getElementById("join-online-status");
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const code = input ? input.value.trim().toUpperCase() : "";
        if (!code) return;
        if (status) status.textContent = "Connecting...";
        try {
          await joinOnlineGame(code);
          if (status) status.textContent = "Connected.";
        } catch (error) {
          if (status) status.textContent = error.message;
        }
      });
    }
  }

  async function joinOnlineGame(code) {
    const room = await onlineFetch(`/rooms/${encodeURIComponent(code)}`);
    const pc = createPeerConnection();
    setOnlineSession({ role: "guest", pc, channel: null, code, connected: false, playerIndex: 1 });
    pc.ondatachannel = (event) => {
      attachOnlineChannel(event.channel);
    };
    await pc.setRemoteDescription(room.offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc);
    await onlineFetch(`/rooms/${encodeURIComponent(code)}/answer`, {
      method: "POST",
      body: JSON.stringify({ answer: pc.localDescription }),
    });
  }

  function returnToMenu() {
    gamePhase = "INIT";
    hideOverlay();
    clearHighlights();
    clearTempControls();
    clearDiceDisplay();
    actionText.textContent = "";
    document.body.classList.remove("game-active");
    firstGameTipsActive = false;
    firstGameTipQueue = [];
    hideFirstGameTip();
    gameUI.classList.add("hidden");
    menuDiv.classList.remove("hidden");
    updateContinueButton();
  }

  /**
   * Initialize the 6x6 board from TILE_DATA. Copies tiles into boardState and
   * records the finish coordinate. This must be called when starting a new game.
   */
  function initBoard() {
    boardState.clear();
    recentlyPlacedTileKey = null;
    // Fill 6x6 grid from TILE_DATA; convert tile_number "r-c" to 0-indexed
    for (const tile of TILE_DATA) {
      const parts = tile.tile_number.split("-");
      const row = parseInt(parts[0], 10) - 1;
      const col = parseInt(parts[1], 10) - 1;
      boardState.set(`${row},${col}`, deepCopy(tile));
    }
    // Hardcode finish tile coordinates (tile 3-4) -> row 2, col 3
    finishRow = 2;
    finishCol = 3;
  }

  /**
   * Create player objects based on user selection. Each player has an id,
   * name, colour, position (null means off-board), CPU flag and turn-effect flags.
   * @param {number} count Number of players (1-4)
   * @param {number} cpuCount Number of CPU-controlled seats, assigned after human seats
   */
  function initPlayers(count, cpuCount, names = null) {
    players = [];
    lastTokenRects = new Map();
    pendingNewTokenPop = new Set();
    suppressTokenFlip = new Set();
    pickedUpTileRect = null;
    pickedUpTileRotation = 0;
    pendingTileFlight = null;
    if (boardCameraAnimation) {
      try { boardCameraAnimation.cancel(); } catch (e) { /* ignore */ }
      boardCameraAnimation = null;
    }
    boardCamera = { x: 0, y: 0, scale: 1 };
    boardCameraFrame = null;
    suppressNextBoardZoom = false;
    renderCount = 0;
    const cpuSeats = Math.max(0, Math.min(count, Number(cpuCount) || 0));
    const humanSeats = count - cpuSeats;
    for (let i = 0; i < count; i++) {
      const isCPU = i >= humanSeats;
      const cpuIndex = i - humanSeats + 1;
      const humanName = names && names.humans ? names.humans[i] : "";
      const cpuName = names && names.cpus ? names.cpus[cpuIndex - 1] : "";
      const defaultSkin = i % TOKEN_SKIN_COUNT;
      const defaultColour = PLAYER_COLOURS[i % PLAYER_COLOURS.length];
      const tokenSkin = isCPU
        ? (names && names.cpuSkins != null ? (names.cpuSkins[cpuIndex - 1] ?? defaultSkin) : defaultSkin)
        : (names && names.humanSkins != null ? (names.humanSkins[i] ?? defaultSkin) : defaultSkin);
      const colour = isCPU
        ? (names && names.cpuColours ? (names.cpuColours[cpuIndex - 1] || defaultColour) : defaultColour)
        : (names && names.humanColours ? (names.humanColours[i] || defaultColour) : defaultColour);
      players.push({
        id: i + 1,
        name: isCPU
          ? cleanPlayerName(cpuName, `CPU ${cpuIndex}`)
          : cleanPlayerName(humanName, `Player ${i + 1}`),
        colour,
        pos: null,
        isCPU,
        missNextTurn: false,
        extraTurnPending: false,
        tokenSkin,
      });
    }
  }

  /**
   * Render the current board state to the DOM. This function computes the
   * smallest bounding box that contains all tiles (including any expansions)
   * and generates a CSS grid of tiles. Empty cells (no tile) are shown as
   * dashed boxes. After rendering, tokens are added on top of the appropriate
   * spaces.
   */
  function renderBoard() {
    const previousTokenRects = new Map();
    const liveCamera = boardContainer.querySelector(".board-camera");
    const visibleCamera = readCameraTransform(liveCamera);
    boardContainer.querySelectorAll(".token[data-player-index]").forEach((token) => {
      previousTokenRects.set(Number(token.dataset.playerIndex), token.getBoundingClientRect());
    });
    // Determine bounding box
    let rows = [];
    let cols = [];
    boardState.forEach((_, key) => {
      const [r, c] = key.split(",").map((x) => parseInt(x, 10));
      rows.push(r);
      cols.push(c);
    });
    const minR = Math.min(...rows);
    const maxR = Math.max(...rows);
    const minC = Math.min(...cols);
    const maxC = Math.max(...cols);
    // Only show the extra placement ring while a shifted tile is in hand.
    // During normal play, keep the board frame tight to the actual tiles.
    const placementPadding = tileInHand ? 1 : 0;
    const extMinR = minR - placementPadding;
    const extMaxR = maxR + placementPadding;
    const extMinC = minC - placementPadding;
    const extMaxC = maxC + placementPadding;
    const numRows = extMaxR - extMinR + 1;
    const numCols = extMaxC - extMinC + 1;
    const previousCameraFrame = boardCameraFrame ? { ...boardCameraFrame } : null;
    // Size the board to the available screen space. Keep a fallback so the
    // board never collapses during the first hidden-to-visible render.
    const containerWidth = boardContainer.clientWidth || 520;
    const containerHeight = boardContainer.clientHeight || 520;
    const availableWidth = Math.max(280, containerWidth - 32);
    const availableHeight = Math.max(280, containerHeight - 32);
    const baseFitSize = Math.floor(Math.min(availableWidth / 6, availableHeight / 6));
    const tileSize = Math.max(58, Math.min(96, baseFitSize));
    // Clear existing board
    boardContainer.innerHTML = "";
    const camera = document.createElement("div");
    camera.classList.add("board-camera");
    camera.style.setProperty("--tile-size", `${tileSize}px`);
    const grid = document.createElement("div");
    grid.classList.add("board-grid");
    grid.style.setProperty("--rows", numRows);
    grid.style.setProperty("--cols", numCols);
    grid.style.setProperty("--tile-size", `${tileSize}px`);
    // Populate grid
    for (let r = extMinR; r <= extMaxR; r++) {
      for (let c = extMinC; c <= extMaxC; c++) {
        const cell = document.createElement("div");
        cell.classList.add("tile-wrapper");
        const key = `${r},${c}`;
        if (boardState.has(key)) {
          const tile = boardState.get(key);
          const tileEl = renderTile(tile, r, c);
          cell.appendChild(tileEl);
        } else {
          const emptyTile = document.createElement("div");
          emptyTile.classList.add("tile", "empty");
          emptyTile.dataset.row = r;
          emptyTile.dataset.col = c;
          cell.appendChild(emptyTile);
        }
        grid.appendChild(cell);
      }
    }
    camera.appendChild(grid);
    boardContainer.appendChild(camera);
    const cameraTarget = computeBoardCameraTarget(numRows, numCols, tileSize);
    const animateCamera = !suppressNextBoardZoom;
    suppressNextBoardZoom = false;
    let cameraStart = null;
    if (previousCameraFrame && renderCount > 0) {
      const baseCamera = visibleCamera || boardCamera;
      const scale = baseCamera.scale || 1;
      cameraStart = {
        x: baseCamera.x + (extMinC - previousCameraFrame.extMinC) * tileSize * scale,
        y: baseCamera.y + (extMinR - previousCameraFrame.extMinR) * tileSize * scale,
        scale,
      };
    }
    moveBoardCamera(camera, cameraTarget, animateCamera, cameraStart);
    boardCameraFrame = { extMinR, extMinC, numRows, numCols, tileSize };
    // After rendering tiles, add tokens
    renderTokens(previousTokenRects);
    animatePendingTileFlight();
    if (recentlyPlacedTileKey) {
      setTimeout(() => {
        recentlyPlacedTileKey = null;
      }, 400);
    }
    renderCount += 1;
    broadcastGameState();
  }

  function subtileBaseBox(tileNumber, pos) {
    const bounds = TILE_BOUNDS[tileNumber] || { x: [0, 1 / 3, 2 / 3, 1], y: [0, 1 / 3, 2 / 3, 1] };
    const indices = {
      "corner-tl": [0, 0],
      top: [1, 0],
      "corner-tr": [2, 0],
      left: [0, 1],
      middle: [1, 1],
      right: [2, 1],
      "corner-bl": [0, 2],
      bottom: [1, 2],
      "corner-br": [2, 2],
    };
    const [cx, cy] = indices[pos] || [1, 1];
    return {
      left: bounds.x[cx],
      top: bounds.y[cy],
      right: bounds.x[cx + 1],
      bottom: bounds.y[cy + 1],
    };
  }

  function canonicalSubtileBox(pos) {
    const thirds = [0, 1 / 3, 2 / 3, 1];
    const indices = {
      "corner-tl": [0, 0],
      top: [1, 0],
      "corner-tr": [2, 0],
      left: [0, 1],
      middle: [1, 1],
      right: [2, 1],
      "corner-bl": [0, 2],
      bottom: [1, 2],
      "corner-br": [2, 2],
    };
    const [cx, cy] = indices[pos] || [1, 1];
    return {
      left: thirds[cx],
      top: thirds[cy],
      right: thirds[cx + 1],
      bottom: thirds[cy + 1],
    };
  }

  function rotateSubtileBox(box, steps) {
    let points = [
      [box.left, box.top],
      [box.right, box.top],
      [box.right, box.bottom],
      [box.left, box.bottom],
    ];
    const rotations = ((steps % 4) + 4) % 4;
    for (let i = 0; i < rotations; i++) {
      points = points.map(([x, y]) => [1 - y, x]);
    }
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
    };
  }

  function applySubtileBounds(cell, tile, pos) {
    const rotation = tileRotationStep(tile);
    // Tile data is already rotated by rotateTile(), so a current logical
    // position must be mapped back to its source-space before rotating the
    // measured art bounds forward. Otherwise a rotated straight pipe can keep
    // live hitboxes in the wrong visual row/column.
    const sourcePos = rotateSpaceName(pos, -rotation);
    const rotated = rotateSubtileBox(canonicalSubtileBox(sourcePos), rotation);
    cell.style.left = `${rotated.left * 100}%`;
    cell.style.top = `${rotated.top * 100}%`;
    cell.style.width = `${(rotated.right - rotated.left) * 100}%`;
    cell.style.height = `${(rotated.bottom - rotated.top) * 100}%`;
  }

  function renderSlicedTileArt(tile, className = "tile-art") {
    const art = document.createElement("div");
    art.className = className;
    const source = boundsForTileNumber(tile.tile_number);
    const dest = [0, 1 / 3, 2 / 3, 1];
    const image = `url("${assetUrl(`assets/tiles/${tile.tile_number}.png`)}")`;
    for (let cy = 0; cy < 3; cy++) {
      for (let cx = 0; cx < 3; cx++) {
        const sourceLeft = source.x[cx];
        const sourceTop = source.y[cy];
        const sourceWidth = source.x[cx + 1] - source.x[cx];
        const sourceHeight = source.y[cy + 1] - source.y[cy];
        const slice = document.createElement("div");
        slice.className = "tile-art-slice";
        slice.style.left = `${dest[cx] * 100}%`;
        slice.style.top = `${dest[cy] * 100}%`;
        slice.style.width = `${(dest[cx + 1] - dest[cx]) * 100}%`;
        slice.style.height = `${(dest[cy + 1] - dest[cy]) * 100}%`;
        const inner = document.createElement("div");
        inner.className = "tile-art-slice-inner";
        inner.style.backgroundImage = image;
        inner.style.width = `${100 / sourceWidth}%`;
        inner.style.height = `${100 / sourceHeight}%`;
        inner.style.left = `${-(sourceLeft / sourceWidth) * 100}%`;
        inner.style.top = `${-(sourceTop / sourceHeight) * 100}%`;
        slice.appendChild(inner);
        art.appendChild(slice);
      }
    }
    return art;
  }

  function refreshTileSubtileBounds(tileEl, tile) {
    if (!tileEl || !tile) return;
    [
      "corner-tl", "top", "corner-tr",
      "left", "middle", "right",
      "corner-bl", "bottom", "corner-br",
    ].forEach((pos) => {
      const cell = tileEl.querySelector(`.space.${pos}`);
      if (cell) applySubtileBounds(cell, tile, pos);
    });
  }

  function boundsForTileNumber(tileNumber) {
    if (!TILE_BOUNDS[tileNumber]) {
      TILE_BOUNDS[tileNumber] = { x: [0, 1 / 3, 2 / 3, 1], y: [0, 1 / 3, 2 / 3, 1] };
    }
    return TILE_BOUNDS[tileNumber];
  }

  /**
   * Render an individual tile. Creates a 3x3 grid representing the five
   * connection points of the tile (top, left, middle, right, bottom) plus
   * unused corners. Colours are applied based on the tile's water values.
   * @param {Object} tile
   * @param {number} row
   * @param {number} col
   */
  function renderTile(tile, row, col) {
    const el = document.createElement("div");
    el.classList.add("tile", "image-backed");
    el.dataset.row = row;
    el.dataset.col = col;
    const tileKey = `${row},${col}`;
    if (tileKey === recentlyPlacedTileKey && (!pendingTileFlight || pendingTileFlight.key !== tileKey)) {
      el.classList.add("placed");
    }
    const art = renderSlicedTileArt(tile);
    art.style.transform = `rotate(${(tile.rotation || 0) * 90}deg)`;
    el.appendChild(art);
    // Create measured 3x3 cells. The source scan is not perfectly uniform,
    // so each tile gets precomputed subtile bounds from assets/tile-bounds.js.
    const positions = [
      "corner-tl", "top", "corner-tr",
      "left", "middle", "right",
      "corner-bl", "bottom", "corner-br",
    ];
    positions.forEach((pos) => {
      const cell = document.createElement("div");
      cell.classList.add("space");
      applySubtileBounds(cell, tile, pos);
      if (!pos.startsWith("corner")) {
        cell.classList.add(pos);
        cell.dataset.space = pos;
      } else {
        // Add a class for corner positions so they can be styled differently
        cell.classList.add(pos);
      }
      const waterCode = tile[pos] || "";
      if (!pos.startsWith("corner") && waterCode) {
        cell.classList.add("pipe-segment");
        const cls = getColourClass(waterCode);
        if (cls) cell.classList.add(cls);
      }
      if (pos === "middle") {
        if (row === finishRow && col === finishCol) {
          cell.classList.add("finish-space");
        }
      }
      // If this is the bottom-right corner, display the tile number for easy reference
      el.appendChild(cell);
    });
    const hideRotatedFinishNumber = tile.tile_number === "3-4" && tileRotationStep(tile) !== 0;
    if (!hideRotatedFinishNumber) {
      const number = document.createElement("div");
      number.classList.add("tile-num-overlay");
      number.style.backgroundImage = `url("${assetUrl(`assets/tile-labels/${tile.tile_number}.png`)}")`;
      number.setAttribute("aria-label", `Tile ${tile.tile_number}`);
      el.appendChild(number);
    }
    // If this tile is the finish tile, mark it for special styling
    if (row === finishRow && col === finishCol) {
      el.classList.add("finish");
    }
    return el;
  }

  /**
   * Remove any existing token elements and then draw new tokens based on
   * players' positions. Tokens are coloured circles sized relative to the
   * cell.
   */
  function animateFromRect(el, fromRect, options = {}) {
    if (!fromRect || !el || typeof el.animate !== "function") return;
    const toRect = el.getBoundingClientRect();
    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !options.fromScale) return;
    const finalTransform = options.finalTransform || getComputedStyle(el).transform;
    const baseTransform = finalTransform === "none" ? "" : finalTransform;
    const fromScale = options.fromScale || 1;
    el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${fromScale}) ${baseTransform}`,
          filter: options.fromFilter || "drop-shadow(0 10px 10px rgba(31, 41, 51, 0.16))",
        },
        {
          transform: baseTransform,
          filter: options.toFilter || "none",
        },
      ],
      {
        duration: options.duration || 420,
        easing: options.easing || "cubic-bezier(0.34, 1.18, 0.64, 1)",
      },
    );
  }

  function animateTileArtRotation(tileEl, fromStep, toStep, duration = 430) {
    const art = tileEl ? tileEl.querySelector(".tile-art") : null;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!art || typeof art.animate !== "function" || reduceMotion) return;
    let fromDeg = (((fromStep || 0) % 4) + 4) % 4 * 90;
    let toDeg = (((toStep || 0) % 4) + 4) % 4 * 90;
    const forward = (toDeg - fromDeg + 360) % 360;
    if (forward === 270) toDeg -= 90;
    else if (forward > 0) toDeg = fromDeg + forward;
    art.animate(
      [
        { transform: `rotate(${fromDeg}deg)` },
        { transform: `rotate(${toDeg}deg)` },
      ],
      {
        duration,
        easing: "cubic-bezier(0.2, 0.84, 0.22, 1)",
      },
    );
  }

  function animatePendingTileFlight() {
    if (!pendingTileFlight) return;
    const { key, rect, fromRotation, toRotation } = pendingTileFlight;
    pendingTileFlight = null;
    const [row, col] = key.split(",");
    const tileEl = document.querySelector(`.tile[data-row='${row}'][data-col='${col}']`);
    if (!tileEl) return;
    tileEl.classList.remove("placed");
    animateFromRect(tileEl, rect, {
      duration: 520,
      easing: "cubic-bezier(0.18, 0.9, 0.2, 1)",
      fromFilter: "drop-shadow(0 22px 22px rgba(31, 41, 51, 0.32))",
      fromScale: 1.08,
    });
    animateTileArtRotation(tileEl, fromRotation, toRotation, 520);
  }

  /**
   * Animate a CPU-placed tile floating from fromRect to its new board position.
   * The tile arcs upward mid-flight for a natural "pick up and place" feel.
   * @param {DOMRect} fromRect  Original tile position before shift
   * @param {number}  destRow
   * @param {number}  destCol
   */
  function animateCpuTileFlight(fromRect, destRow, destCol, fromRotation = 0, toRotation = 0) {
    if (!fromRect || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    const tileEl = document.querySelector(`.tile[data-row='${destRow}'][data-col='${destCol}']`);
    if (!tileEl) return;
    const toRect = tileEl.getBoundingClientRect();
    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    // Arc height proportional to travel distance, minimum 24 px
    const dist = Math.sqrt(dx * dx + dy * dy);
    const arc = Math.max(24, dist * 0.22);
    tileEl.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(1)`,
          filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.22))",
          offset: 0,
        },
        {
          transform: `translate(${dx * 0.5}px, ${dy * 0.5 - arc}px) scale(1.1)`,
          filter: "drop-shadow(0 26px 32px rgba(0,0,0,0.38))",
          offset: 0.45,
        },
        {
          transform: "translate(0,0) scale(1)",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.12))",
          offset: 1,
        },
      ],
      {
        duration: 520,
        easing: "cubic-bezier(0.2, 0.84, 0.22, 1)",
      },
    );
    animateTileArtRotation(tileEl, fromRotation, toRotation, 520);
  }

  /**
   * Briefly highlight a tile so the player can see the CPU "looking at it" before
   * it's actually picked up. Calls onDone after the highlight has played.
   */
  function highlightCpuShiftTile(row, col, onDone) {
    const tileEl = document.querySelector(`.tile[data-row='${row}'][data-col='${col}']`);
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!tileEl || reduceMotion) {
      if (onDone) onDone();
      return;
    }
    const player = players[currentPlayerIndex];
    if (player && player.colour) {
      tileEl.style.setProperty("--cpu-target-color", player.colour);
    }
    tileEl.classList.add("cpu-target");
    setTimeout(() => {
      tileEl.classList.remove("cpu-target");
      tileEl.style.removeProperty("--cpu-target-color");
      if (onDone) onDone();
    }, 520);
  }

  function highlightCpuMoveDestination(path, onDone) {
    const end = path && path[path.length - 1];
    const cellEl = spaceElementForPos(end);
    const player = players[currentPlayerIndex];
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!cellEl || reduceMotion) {
      if (onDone) onDone();
      return;
    }
    if (player && player.colour) {
      cellEl.style.setProperty("--cpu-target-color", player.colour);
    }
    cellEl.classList.add("selectable", "cpu-choice");
    highlightedCells.push(cellEl);
    const finishHighlight = () => {
      cellEl.classList.remove("selectable", "cpu-choice");
      cellEl.style.removeProperty("--cpu-target-color");
      highlightedCells = highlightedCells.filter((cell) => cell !== cellEl);
      if (onDone) onDone();
    };
    scheduleCpuAction(finishHighlight);
  }

  /**
   * Mean bump animation: bumper jabs forward, victim shakes red then gets thrown.
   * Resolves when the in-place impact is over so the caller can move the victim.
   */
  function playMeanBumpImpact(bumperIndex, victimIndex) {
    return new Promise((resolve) => {
      const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const bumperToken = tokenElementForPlayer(bumperIndex);
      const victimToken = tokenElementForPlayer(victimIndex);
      if (!bumperToken || !victimToken || reduceMotion) {
        resolve();
        return;
      }
      bumperToken.classList.add("bump-impact");
      victimToken.classList.add("bump-victim");
      setTimeout(() => {
        bumperToken.classList.remove("bump-impact");
        victimToken.classList.remove("bump-victim");
        resolve();
      }, 360);
    });
  }

  function renderTokens(previousTokenRects = new Map()) {
    // Remove existing tokens
    boardContainer.querySelectorAll(".token").forEach((tok) => tok.remove());
    const camera = boardContainer.querySelector(".board-camera");
    const startQueueAnchor = getStartQueueAnchor();
    const offBoardPlayers = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => !player.pos);
    const canShowStartQueue = Boolean(camera && startQueueAnchor && boardCameraFrame);
    players.forEach((player, index) => {
      if (player.pos) {
        const { row, col, space } = player.pos;
        const selector = `.tile[data-row='${row}'][data-col='${col}'] .${space}`;
        const cellEl = document.querySelector(selector);
        if (cellEl) {
          const tok = document.createElement("div");
          tok.classList.add("token");
          tok.dataset.playerIndex = index;
          // Highlight the current player's token
          if (index === currentPlayerIndex) {
            tok.classList.add("current");
          }
          if (pendingNewTokenPop.has(index) || (!lastTokenRects.has(index) && renderCount > 0)) {
            tok.classList.add("pop");
          }
          applyTokenSkin(tok, player);
          cellEl.appendChild(tok);
          const oldRect = previousTokenRects.get(index) || lastTokenRects.get(index);
          if (oldRect && !pendingNewTokenPop.has(index) && !suppressTokenFlip.has(index)) {
            const isCurrent = index === currentPlayerIndex;
            animateFromRect(tok, oldRect, {
              duration: 520,
              easing: "cubic-bezier(0.18, 0.9, 0.2, 1)",
              finalTransform: isCurrent ? "translate(-50%, -50%) scale(1.16)" : "translate(-50%, -50%)",
              fromFilter: "drop-shadow(0 8px 8px rgba(31, 41, 51, 0.18))",
            });
          }
          lastTokenRects.set(index, tok.getBoundingClientRect());
        }
      } else if (canShowStartQueue) {
        const queueIndex = offBoardPlayers.findIndex((entry) => entry.index === index);
        const tok = document.createElement("div");
        tok.classList.add("token", "off-board-token");
        tok.dataset.playerIndex = index;
        if (index === currentPlayerIndex) {
          tok.classList.add("current");
        }
        applyTokenSkin(tok, player);
        tok.classList.toggle("queue-blocked", Boolean(startQueueAnchor.blocked));
        const point = startQueueAnchor.onTileBlank
          ? blankQueueTokenPointForSide(
            startQueueAnchor.row,
            startQueueAnchor.col,
            startQueueAnchor.side,
            queueIndex,
            offBoardPlayers.length,
            boardCameraFrame.tileSize,
            boardCameraFrame.extMinR,
            boardCameraFrame.extMinC,
          )
          : queueTokenPointForSide(
            startQueueAnchor.row,
            startQueueAnchor.col,
            startQueueAnchor.side,
            queueIndex,
            boardCameraFrame.tileSize,
            boardCameraFrame.extMinR,
            boardCameraFrame.extMinC,
          );
        tok.style.left = `${point.x}px`;
        tok.style.top = `${point.y}px`;
        camera.appendChild(tok);
        const oldRect = previousTokenRects.get(index) || lastTokenRects.get(index);
        if (oldRect && !suppressTokenFlip.has(index)) {
          const isCurrent = index === currentPlayerIndex;
          animateFromRect(tok, oldRect, {
            duration: 520,
            easing: "cubic-bezier(0.18, 0.9, 0.2, 1)",
            finalTransform: isCurrent ? "translate(-50%, -50%) scale(1.16)" : "translate(-50%, -50%)",
            fromFilter: "drop-shadow(0 8px 8px rgba(31, 41, 51, 0.18))",
          });
        }
        lastTokenRects.set(index, tok.getBoundingClientRect());
      }
    });
    pendingNewTokenPop.clear();
    suppressTokenFlip.clear();
  }

  function attachQueuedTokensToFloatingStartTile(floater, tile, tileSize) {
    if (!floater || !tile || tile.tile_number !== "1-1") return;
    const offBoardPlayers = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => !player.pos);
    if (offBoardPlayers.length === 0) return;
    const queue = chooseQueueSideForStartTile(tile, 0, 0, false);
    floater.style.setProperty("--tile-size", `${tileSize}px`);
    offBoardPlayers.forEach(({ player, index }, queueIndex) => {
      const tok = document.createElement("div");
      tok.classList.add("token", "off-board-token", "cursor-queue-token");
      tok.dataset.playerIndex = index;
      if (index === currentPlayerIndex) {
        tok.classList.add("current");
      }
      applyTokenSkin(tok, player);
      tok.classList.toggle("queue-blocked", Boolean(queue.blocked));
      const point = queue.onTileBlank
        ? blankQueueTokenPointForSide(0, 0, queue.side, queueIndex, offBoardPlayers.length, tileSize)
        : queueTokenPointForSide(0, 0, queue.side, queueIndex, tileSize);
      tok.style.left = `${point.x}px`;
      tok.style.top = `${point.y}px`;
      floater.appendChild(tok);
    });
  }

  function refreshTokenRects() {
    boardContainer.querySelectorAll(".token[data-player-index]").forEach((token) => {
      lastTokenRects.set(Number(token.dataset.playerIndex), token.getBoundingClientRect());
    });
  }

  function spaceElementForPos(pos) {
    if (!pos) return null;
    return document.querySelector(`.tile[data-row='${pos.row}'][data-col='${pos.col}'] .${pos.space}`);
  }

  function tokenElementForPlayer(index) {
    return document.querySelector(`.token[data-player-index='${index}']`);
  }

  function centerOfElement(el) {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function animateElementTo(el, from, to, duration) {
    if (!el || !from || !to || typeof el.animate !== "function") return Promise.resolve();
    const safeDuration = Number(duration) || 0;
    const animation = el.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) translate(-50%, -50%)` },
        { transform: `translate(${to.x}px, ${to.y}px) translate(-50%, -50%)` },
      ],
      {
        duration: safeDuration,
        easing: "cubic-bezier(0.19, 1, 0.22, 1)",
        fill: "forwards",
      },
    );
    return Promise.race([
      animation.finished.catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, safeDuration + 90)),
    ]).then(() => {
      try { animation.finish(); } catch (e) { /* ignore */ }
    });
  }

  async function animateTokenAlongPath(playerIndex, path) {
    const player = players[playerIndex];
    const route = path.filter(Boolean);
    if (!player || route.length === 0) return;

    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    if (!player.pos) {
      player.pos = { row: route[0].row, col: route[0].col, space: route[0].space };
      pendingNewTokenPop.add(playerIndex);
      renderBoard();
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const realToken = tokenElementForPlayer(playerIndex);
    const startCenter = centerOfElement(realToken) || centerOfElement(spaceElementForPos(route[0]));
    if (!realToken || !startCenter) return;

    const tokenRect = realToken.getBoundingClientRect();
    const runner = realToken.cloneNode(true);
    runner.classList.add("path-runner");
    runner.classList.remove("pop", "current");
    runner.style.width = `${realToken.offsetWidth || tokenRect.width}px`;
    runner.style.height = `${realToken.offsetHeight || tokenRect.height}px`;
    applyTokenSkin(runner, player);
    runner.style.transform = `translate(${startCenter.x}px, ${startCenter.y}px) translate(-50%, -50%)`;
    document.body.appendChild(runner);
    realToken.style.visibility = "hidden";

    try {
      let from = startCenter;
      const stepDuration = Math.max(105, Math.min(190, 760 / Math.max(1, route.length - 1)));
      for (let i = 1; i < route.length; i++) {
        const to = centerOfElement(spaceElementForPos(route[i]));
        if (!to) continue;
        await animateElementTo(runner, from, to, stepDuration);
        from = to;
      }
    } finally {
      runner.remove();
      realToken.style.visibility = "";
      const latestToken = tokenElementForPlayer(playerIndex);
      if (latestToken) latestToken.style.visibility = "";
    }
  }

  /**
   * Utility to clear highlights for moves and shift tiles. Removes classes
   * added for selectable spaces or placement candidates.
   */
  function clearHighlights() {
    highlightedCells.forEach((cell) => {
      cell.classList.remove("selectable", "cpu-choice");
      cell.style.removeProperty("--cpu-target-color");
      if (cell._moveHandler) {
        cell.removeEventListener("click", cell._moveHandler);
        delete cell._moveHandler;
      }
    });
    highlightedCells = [];
    highlightedTiles.forEach((tile) => {
      tile.classList.remove("selectable");
      if (tile._shiftHandler) {
        tile.removeEventListener("click", tile._shiftHandler);
        delete tile._shiftHandler;
      }
      if (tile._rotateHandler) {
        tile.removeEventListener("click", tile._rotateHandler);
        delete tile._rotateHandler;
      }
    });
    highlightedTiles = [];
    placementCandidates.forEach((tile) => {
      tile.classList.remove("placement");
      if (tile._placeHandler) {
        tile.removeEventListener("click", tile._placeHandler);
        delete tile._placeHandler;
      }
    });
    placementCandidates = [];
    clearCpuActiveControls();
    // Remove any floating cursor tile
    if (cursorTileCleanup) {
      cursorTileCleanup();
      cursorTileCleanup = null;
    }
  }

  /**
   * Determine reachable positions from a starting position in exactly a given
   * number of steps. The first step chooses a direction; every later step keeps
   * following the pipe without reversing. When a junction has multiple forward
   * exits and no explicit per-entry continuation data, each non-reversing exit is
   * treated as a possible committed line through that junction. Loops are allowed;
   * the committed direction, not a no-revisit rule, limits movement.
   * @param {Object|null} startPos Starting position (null means off-board)
   * @param {number} steps Number of steps to take
   * @returns {Array<Array>} List of paths (each path is an array of positions)
   */
  function findPaths(startPos, steps) {
    const paths = [];
    if (steps < 0) return paths;
    // When starting off-board, count entry at the current top of tile 1-1.
    let startNodes = [];
    if (startPos === null) {
      const start = getStartEntryPos();
      if (!start) return paths;
      startNodes = [ { prev: null, pos: start, committed: false } ];
    } else {
      startNodes = [ { prev: null, pos: startPos, committed: false } ];
    }
    function dfs(node, remaining, path) {
      const { prev, pos, committed } = node;
      if (remaining === 0) {
        // Include the current position as final step
        paths.push([...path, pos]);
        return;
      }
      // Hey Culligan Man is terminal. A player only wins by landing there on
      // the final count, so paths with extra steps may not pass through it.
      if (isFinishSpace(pos)) return;
      const neighbors = committed ? getCommittedContinuations(prev, pos) : getNeighbors(pos);
      neighbors.forEach((n) => {
        dfs({ prev: pos, pos: n, committed: true }, remaining - 1, [...path, pos]);
      });
    }
    startNodes.forEach((node) => {
      dfs(node, steps, []);
    });
    return paths;
  }

  /**
   * Get all immediate neighbouring positions reachable from the given position
   * by following the tile connections and adjacent tiles. Only moves through
   * non-empty water lines are considered valid. Does not check for revisits.
   * @param {Object} pos {row,col,space}
   * @returns {Array<Object>} List of reachable positions
   */
  function getNeighbors(pos) {
    const list = [];
    const tile = boardState.get(`${pos.row},${pos.col}`);
    if (!tile) return list;
    // Move within the same tile via connections
    const adjWithin = tile.connections[pos.space] || [];
    adjWithin.forEach((target) => {
      // Only move if there is water on both current and target spaces
      if (tile[pos.space] && tile[target]) {
        list.push({ row: pos.row, col: pos.col, space: target });
      }
    });
    // Move to adjacent tile (north)
    if (pos.space === "top" && tile.top) {
      const key = `${pos.row - 1},${pos.col}`;
      if (boardState.has(key)) {
        const neighborTile = boardState.get(key);
        // Must have water on opposite side
        if (neighborTile.bottom) {
          list.push({ row: pos.row - 1, col: pos.col, space: "bottom" });
        }
      }
    }
    // south
    if (pos.space === "bottom" && tile.bottom) {
      const key = `${pos.row + 1},${pos.col}`;
      if (boardState.has(key)) {
        const neighborTile = boardState.get(key);
        if (neighborTile.top) {
          list.push({ row: pos.row + 1, col: pos.col, space: "top" });
        }
      }
    }
    // west
    if (pos.space === "left" && tile.left) {
      const key = `${pos.row},${pos.col - 1}`;
      if (boardState.has(key)) {
        const neighborTile = boardState.get(key);
        if (neighborTile.right) {
          list.push({ row: pos.row, col: pos.col - 1, space: "right" });
        }
      }
    }
    // east
    if (pos.space === "right" && tile.right) {
      const key = `${pos.row},${pos.col + 1}`;
      if (boardState.has(key)) {
        const neighborTile = boardState.get(key);
        if (neighborTile.left) {
          list.push({ row: pos.row, col: pos.col + 1, space: "left" });
        }
      }
    }
    return list;
  }

  function getExplicitContinuations(tile, fromSpace, throughSpace) {
    const table = tile && tile.continuations;
    if (!table) return null;
    const keys = [`${fromSpace}->${throughSpace}`, fromSpace];
    for (const key of keys) {
      if (Array.isArray(table[key])) return table[key];
    }
    return null;
  }

  function getCommittedContinuations(prev, pos) {
    if (!prev || !pos) return getNeighbors(pos);
    const forward = getNeighbors(pos).filter((candidate) => !samePos(candidate, prev));

    const tile = boardState.get(`${pos.row},${pos.col}`);
    if (tile && prev.row === pos.row && prev.col === pos.col) {
      const explicit = getExplicitContinuations(tile, prev.space, pos.space);
      if (explicit) {
        const allowed = forward.filter((candidate) => candidate.row === pos.row && candidate.col === pos.col && explicit.includes(candidate.space));
        return allowed;
      }
    }
    return forward;
  }

  function movementStepsForDiceTotal(startPos, diceTotal) {
    return startPos === null ? diceTotal - 1 : diceTotal;
  }

  function canReachFinishInSteps(startPos, steps) {
    if (steps < 0) return false;
    const start = startPos ? { ...startPos } : getStartEntryPos();
    if (!start) return false;
    const deadEnds = new Set();

    function dfs(prev, pos, remaining, committed) {
      if (remaining === 0) return isFinishSpace(pos);
      if (isFinishSpace(pos)) return false;
      const key = `${prev ? posKey(prev) : "start"}|${posKey(pos)}|${remaining}|${committed ? 1 : 0}`;
      if (deadEnds.has(key)) return false;
      const neighbors = committed ? getCommittedContinuations(prev, pos) : getNeighbors(pos);
      for (const next of neighbors) {
        if (dfs(pos, next, remaining - 1, true)) return true;
      }
      deadEnds.add(key);
      return false;
    }

    return dfs(null, start, steps, false);
  }

  function canReachFinishOnDiceTotal(startPos, diceTotal) {
    return canReachFinishInSteps(startPos, movementStepsForDiceTotal(startPos, diceTotal));
  }

  function exactFinishProfile(startPos) {
    const totals = [];
    let combos = 0;
    DICE_TOTAL_WEIGHTS.forEach(({ total, combos: weight }) => {
      if (canReachFinishOnDiceTotal(startPos, total)) {
        totals.push(total);
        combos += weight;
      }
    });
    return {
      combos,
      totals,
      chance: combos / DICE_COMBO_COUNT,
    };
  }

  /**
   * Compute valid moves given a dice total for the current player. Generates
   * paths of exactly the required length and highlights the final positions
   * for the user to choose. If no paths exist, immediately proceed to shift
   * phase. For CPU players, automatically select the best path based on
   * distance heuristic.
   * @param {number} diceTotal
   */
  function computeValidMoves(diceTotal) {
    clearHighlights();
    const player = players[currentPlayerIndex];
    const startPos = player.pos;
    // If first move (startPos == null), then starting tile counts as first step.
    const steps = movementStepsForDiceTotal(startPos, diceTotal);
    awaitingPaths = findPaths(startPos, steps);
    if (awaitingPaths.length === 0) {
      // No valid moves; proceed to shift
      // Announce no available moves
      actionText.textContent = "No valid moves. You may still shift a tile.";
      if (player.isCPU) {
        logCpuThought(`${player.name} movement`, [
          `roll ${diceRoll[0]} + ${diceRoll[1]} = ${diceTotal}`,
          "no full committed path exists, so movement is skipped",
        ]);
      } else {
        maybeShowFirstGameTip("noMove", { humanOnly: true });
      }
      gamePhase = "AWAITING_SHIFT";
      showShiftOptions(diceRoll);
      broadcastGameState();
      return;
    }
    // Map unique final positions to a representative path.
    const finalMap = new Map();
    awaitingPaths.forEach((path) => {
      const end = path[path.length - 1];
      const key = `${end.row},${end.col},${end.space}`;
      if (!finalMap.has(key)) {
        finalMap.set(key, path);
      }
    });
    // CPU selects the best path automatically, with a brief delay
    if (player.isCPU) {
      let bestPath = null;
      let bestScore = -Infinity;
      const analyses = [];
      finalMap.forEach((path) => {
        const analysis = analyzeCpuMovePath(player, path);
        analyses.push(analysis);
        if (!bestPath || analysis.score > bestScore) {
          bestScore = analysis.score;
          bestPath = path;
        }
      });
      analyses.sort((a, b) => b.score - a.score);
      logCpuThought(`${player.name} movement`, [
        `roll ${diceRoll[0]} + ${diceRoll[1]} = ${diceTotal}; committed paths ${awaitingPaths.length}, endpoints ${finalMap.size}`,
        ...analyses.slice(0, 8).map((analysis, index) => {
          const notes = analysis.notes.length ? `; ${analysis.notes.join(", ")}` : "";
          const shift = analysis.shiftPlan
            ? `; ${analysis.wouldUseShift ? describeShiftPlan(analysis.shiftPlan) : "swap: skip after lookahead"}`
            : "";
          return `${index + 1}. ${describePos(analysis.end)} score ${analysis.score.toFixed(1)} (${describeDistance(analysis.currentDist)} -> ${describeDistance(analysis.nextDist)}${notes}${shift})`;
        }),
        bestPath ? `choice: ${describePos(bestPath[bestPath.length - 1])}` : "choice: no move",
      ]);
      // Narrate CPU movement and delay execution
      if (bestPath) {
        actionText.textContent = `${player.name} is moving the token...`;
        showCpuStepControl("Select Destination");
        highlightCpuMoveDestination(bestPath, () => {
          handleMove(bestPath);
        });
      } else {
        // No valid moves: proceed to shift
        actionText.textContent = `${player.name} has no valid moves.`;
        gamePhase = "AWAITING_SHIFT";
        showShiftOptions(diceRoll);
      }
    } else {
      // Human: highlight final positions for selection
      finalMap.forEach((path, key) => {
        const [r, c, space] = key.split(",");
        const cellSelector = `.tile[data-row='${r}'][data-col='${c}'] .${space}`;
        const cellEl = document.querySelector(cellSelector);
        if (cellEl) {
          cellEl.classList.add("selectable");
          // attach handler
          const handler = () => {
            requestMove(path);
          };
          // store handler on element for later removal
          cellEl._moveHandler = handler;
          cellEl.addEventListener("click", handler, { once: true });
          highlightedCells.push(cellEl);
        }
      });
      actionText.textContent = "Select a destination to move.";
      maybeShowFirstGameTip("move", { humanOnly: true });
      broadcastGameState();
    }
  }

  function requestMove(path) {
    if (!path) return;
    if (shouldSendGuestAction()) {
      const end = path[path.length - 1];
      sendOnlineAction({ kind: "move", end });
    }
    handleMove(path);
  }

  /**
   * Handle moving the current player's token along the chosen path. Updates
   * position, checks for bumping and special spaces (soft/hard), then
   * transitions to shift phase. If bump occurs, bump handling is invoked.
   * @param {Array<Object>} path Array of positions representing the move
   */
  async function handleMove(path) {
    clearHighlights();
    const player = players[currentPlayerIndex];
    // Determine end position
    const endPos = path[path.length - 1];
    await animateTokenAlongPath(currentPlayerIndex, path);
    completeFirstGameTip("move");
    // Update player position
    player.pos = { row: endPos.row, col: endPos.col, space: endPos.space };
    suppressTokenFlip.add(currentPlayerIndex);
    renderBoard();
    // Check finish before bumping: if the exact roll reaches Hey Culligan Man,
    // the race is over even if another token was sitting there.
    if (declareWinnerIfOnFinish(player)) return;
    // Check for bumping
    const victimIndex = players.findIndex((p, idx) => idx !== currentPlayerIndex && p.pos && p.pos.row === endPos.row && p.pos.col === endPos.col && p.pos.space === endPos.space);
    if (victimIndex !== -1) {
      bumpVictim = victimIndex;
      gamePhase = "AWAITING_BUMP";
      maybeShowFirstGameTip("bump");
      handleBump();
      return;
    }
    // Check special space colour
    const tile = boardState.get(`${endPos.row},${endPos.col}`);
    const colour = tile[endPos.space];
    if (colour === "S") {
      // Soft: extra turn (do not change current player index)
      player.extraTurnPending = true;
      actionText.textContent = `${player.name} landed on Soft water! Take another turn after shifting.`;
      maybeShowFirstGameTip("softWater");
    } else if (colour === "H") {
      // Hard: skip next turn
      player.extraTurnPending = false;
      player.missNextTurn = true;
      actionText.textContent = `${player.name} landed on Hard water and will miss their next turn.`;
      maybeShowFirstGameTip("hardWater");
    } else {
      player.extraTurnPending = false;
      actionText.textContent = ``;
    }
    // Proceed to shift phase
    gamePhase = "AWAITING_SHIFT";
    showShiftOptions(diceRoll);
  }

  /**
   * Handle bumping when a player ends their move on an occupied space. The
   * bumper (current player) selects a new Neutral space for the bumped player
   * then may rotate the tile they land on. CPU opponents perform this
   * automatically using distance heuristics.
   */
  function finishBumpPhase() {
    bumpVictim = null;
    gamePhase = "AWAITING_SHIFT";
    clearTempControls();
    showShiftOptions(diceRoll);
  }

  function handleBump() {
    clearHighlights();
    const bumper = players[currentPlayerIndex];
    const victim = players[bumpVictim];
    // Highlight all Neutral spaces for selection
    const neutralPositions = [];
    boardState.forEach((tile, key) => {
      const [r, c] = key.split(",").map((x) => parseInt(x, 10));
      ["top", "left", "middle", "right", "bottom"].forEach((space) => {
        const pos = { row: r, col: c, space };
        if (tile[space] === "N" && !isOccupiedPos(pos, bumpVictim)) {
          neutralPositions.push(pos);
        }
      });
    });
    if (neutralPositions.length === 0) {
      // No neutral spaces; skip bump relocation
      finishBumpPhase();
      return;
    }
    if (bumper.isCPU) {
      // CPU chooses the neutral space that maximizes the victim's
      // true shortest path length to the finish.  This uses the BFS
      // shortestPathLength heuristic instead of Manhattan distance to
      // discourage moves that appear long but actually lead directly
      // to the finish through tunnels.  An unreachable position
      // (Infinity) is treated as much larger than any finite value.
      let bestPos = null;
      let bestScore = -Infinity;
      neutralPositions.forEach((pos) => {
        // Compute actual shortest path length from this pos to finish.
        // Treat Infinity as a large number so CPU prefers trapping the victim
        // if possible.
        const dist = shortestPathLength(pos);
        const sharedTileBonus = players.some((p) => p !== victim && !p.isCPU && p.pos && p.pos.row === pos.row && p.pos.col === pos.col) ? 25 : 0;
        const score = (dist === Infinity ? 9999 : dist) + sharedTileBonus;
        if (score > bestScore) {
          bestScore = score;
          bestPos = pos;
        }
      });
      // Narrate the bump relocation
      actionText.textContent = `${bumper.name} bumped ${victim.name} and is relocating them...`;
      // Delay relocation to slow CPU and show message
      scheduleCpuAction(() => {
        executeBump(bestPos);
      });
    } else {
      // Human bumper: highlight all neutral spaces for selection
      neutralPositions.forEach((pos) => {
        const selector = `.tile[data-row='${pos.row}'][data-col='${pos.col}'] .${pos.space}`;
        const cellEl = document.querySelector(selector);
        if (cellEl) {
          cellEl.classList.add("selectable");
          const handler = () => {
            requestBumpRelocate(pos);
          };
          cellEl._moveHandler = handler;
          cellEl.addEventListener("click", handler, { once: true });
          highlightedCells.push(cellEl);
        }
      });
    actionText.textContent = `${bumper.name} bumped ${victim.name}! Choose where to relocate them (neutral spaces only).`;
    }
  }

  function requestBumpRelocate(pos) {
    if (!pos) return;
    if (shouldSendGuestAction()) {
      sendOnlineAction({ kind: "bumpRelocate", pos });
    }
    executeBump(pos);
  }

  /**
   * Execute the bump relocation and then rotate the victim's new tile. After
   * relocating the victim, the bumper may rotate the tile where the victim
   * lands. For CPU, automatically choose the rotation that maximizes the
   * victim's distance to finish. After rotation, shift phase begins.
   * @param {Object} newPos {row,col,space} for victim relocation
   */
  function executeBump(newPos) {
    clearHighlights();
    const bumper = players[currentPlayerIndex];
    const victim = players[bumpVictim];
    const victimIdx = bumpVictim;
    // Play the impact in place, THEN move the victim so the launch reads as a consequence.
    playMeanBumpImpact(currentPlayerIndex, victimIdx).then(() => {
      victim.pos = { row: newPos.row, col: newPos.col, space: newPos.space };
      renderBoard();
      if (declareWinnerIfOnFinish(victim)) return;
      continueExecuteBumpAfterImpact(newPos, bumper, victim);
    });
  }

  function continueExecuteBumpAfterImpact(newPos, bumper, victim) {
    // Determine rotations for tile at victim's new location
    const tileKey = `${newPos.row},${newPos.col}`;
    let victimTile = boardState.get(tileKey);
    // Compute all valid rotations (ones that connect to neighbours)
    const rotations = [];
    let rotatedTile = deepCopy(victimTile);
    for (let i = 0; i < 4; i++) {
      if (i > 0) rotatedTile = rotateTile(rotatedTile);
      // Check if rotation maintains at least one connection to board
      const neighboursValid = isRotationValid(rotatedTile, newPos.row, newPos.col);
      if (neighboursValid) {
        rotations.push(deepCopy(rotatedTile));
      }
    }
    if (rotations.length === 0) {
      // No valid rotation options; proceed
      finishBumpPhase();
      return;
    }
    if (bumper.isCPU) {
      // For CPU, choose the rotation that maximizes the victim's path length to finish
      // Evaluate each rotation by temporarily placing it and computing victim's shortest path
      let bestRot = rotations[0];
      let worstDist = -Infinity;
      // Save original tile so we can restore after evaluation
      const originalTile = boardState.get(tileKey);
      rotations.forEach((rot) => {
        boardState.set(tileKey, rot);
        const dist = shortestPathLength(victim.pos);
        if (dist > worstDist) {
          worstDist = dist;
          bestRot = rot;
        }
      });
      // Restore original tile before applying the best rotation
      boardState.set(tileKey, originalTile);
      // Narrate the rotation
      actionText.textContent = `${bumper.name} is rotating the tile...`;
      // Pace the rotation the same way as other CPU actions so the bump stays readable.
      scheduleCpuAction(() => {
        // Determine how many 90° rotations separate the original tile
        // orientation from the selected bestRot. We'll compare against
        // the current orientation stored in boardState to compute the
        // difference in steps (0-3). We deep copy the current tile and
        // rotate it until it matches bestRot, counting steps.
        const original = boardState.get(tileKey);
        const diffSteps = rotationStepsBetweenTiles(original, bestRot);
        // Apply the rotation to the tile on the board
        boardState.set(tileKey, bestRot);
        // Update any players on this tile so their space rotates with the tile
        if (diffSteps > 0) {
          players.forEach((pl) => {
            if (pl.pos && pl.pos.row === newPos.row && pl.pos.col === newPos.col) {
              // Rotate the player's space diffSteps times
              const order = ["top", "right", "bottom", "left"];
              if (pl.pos.space !== "middle") {
                let idx = order.indexOf(pl.pos.space);
                if (idx >= 0) {
                  idx = (idx + diffSteps) % 4;
                  pl.pos.space = order[idx];
                }
              }
            }
          });
        }
        renderBoard();
        if (declareWinnerIfOnFinish(victim)) return;
        finishBumpPhase();
      });
    } else {
      // Human bumper: allow cycling through rotations and confirm
        actionText.textContent = `${bumper.name}, rotate ${victim.name}'s new tile to finish bump (click tile to rotate, then confirm).`;
      availableRotations = rotations;
      rotationIndex = 0;
      // Apply first rotation and render
      boardState.set(tileKey, rotations[rotationIndex]);
      renderBoard();
      // Highlight the tile and attach click handler for rotation
      const tileEl = document.querySelector(`.tile[data-row='${newPos.row}'][data-col='${newPos.col}']`);
      if (tileEl) {
        tileEl.classList.add("selectable");
        highlightedTiles.push(tileEl);
        let bumpRotationAnimating = false;
        const getBumpTile = () => document.querySelector(`.tile[data-row='${newPos.row}'][data-col='${newPos.col}']`);
        const cycleHandler = () => {
          if (bumpRotationAnimating) return;
          if (shouldSendGuestAction()) { sendOnlineAction({ kind: "rotateBump" }); return; }
          const activeTile = getBumpTile();
          if (!activeTile) return;
          bumpRotationAnimating = true;
          const prevRot = availableRotations[rotationIndex];
          const nextIndex = (rotationIndex + 1) % availableRotations.length;
          const nextRot = availableRotations[nextIndex];
          animateTileRotation(activeTile, prevRot, nextRot, () => {
            const diffSteps = rotationStepsBetweenTiles(prevRot, nextRot);
            rotationIndex = nextIndex;
            // Apply rotation to tile
            boardState.set(tileKey, nextRot);
            // Update any players on this tile so their space rotates with the tile
            if (diffSteps > 0) {
              players.forEach((pl) => {
                if (pl.pos && pl.pos.row === newPos.row && pl.pos.col === newPos.col) {
                  const order = ["top", "right", "bottom", "left"];
                  if (pl.pos.space !== "middle") {
                    let idx = order.indexOf(pl.pos.space);
                    if (idx >= 0) {
                      idx = (idx + diffSteps) % 4;
                      pl.pos.space = order[idx];
                    }
                  }
                }
              });
            }
            renderBoard();
            // Re-highlight and rebind handler
            const newTile = getBumpTile();
            if (newTile) {
              newTile.classList.add("selectable");
              highlightedTiles.push(newTile);
              // Attach and store rotation handler on the newly rendered tile
              newTile._rotateHandler = cycleHandler;
              newTile.addEventListener("click", cycleHandler, { once: false });
            }
            bumpRotationAnimating = false;
          });
        };
        tileEl._rotateHandler = cycleHandler;
        tileEl.addEventListener("click", cycleHandler, { once: false });
      }
      // Remove existing temporary controls and create a confirm button
      clearTempControls();
      const confirmBtn = document.createElement("button");
      confirmBtn.textContent = "Confirm Rotation";
      confirmBtn.className = "control-btn temp-btn";
      confirmBtn.addEventListener("click", () => {
        if (shouldSendGuestAction()) { sendOnlineAction({ kind: "confirmBump" }); return; }
        // Remove highlight and handlers
        clearHighlights();
        // Clear temporary controls and proceed to shift phase
        clearTempControls();
        if (declareWinnerIfOnFinish(victim)) return;
        finishBumpPhase();
      });
      controlsContainer.appendChild(confirmBtn);
    }
  }

  /**
   * Check if a rotated tile placed at row,col has at least one valid
   * connection with adjacent tiles. Used for determining valid rotations and
   * placements.
   * @param {Object} tile Rotated tile object
   * @param {number} row
   * @param {number} col
   */
  function isRotationValid(tile, row, col) {
    // For each direction, if tile has water on that side, check neighbour
    const dirs = [
      { dr: -1, dc: 0, side: "top", opp: "bottom" },
      { dr: 1, dc: 0, side: "bottom", opp: "top" },
      { dr: 0, dc: -1, side: "left", opp: "right" },
      { dr: 0, dc: 1, side: "right", opp: "left" },
    ];
    for (const dir of dirs) {
      const nr = row + dir.dr;
      const nc = col + dir.dc;
      const neighbour = boardState.get(`${nr},${nc}`);
      if (neighbour) {
        if (tile[dir.side] && neighbour[dir.opp]) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Show tiles that can be shifted based on the current dice roll. A roll
   * of X and Y allows shifting tile X-Y or Y-X. If the tile contains tokens,
   * they ride with the tile. Highlights selectable tiles for human players or
   * automatically selects for CPU. If no shift is desired or possible, the
   * player may skip shifting.
   * @param {Array<number>} dice [die1, die2]
   */
  function showShiftOptions(dice) {
    clearHighlights();
    const player = players[currentPlayerIndex];
    const selectableTiles = getSelectableShiftTilesForDice(dice);
    // Reset skip shift button. It will only be shown for human players.
    skipShiftBtn.classList.add("hidden");
    skipShiftBtn.onclick = null;
    skipShiftBtn.disabled = false;
    if (selectableTiles.length === 0) {
      // No tiles can be shifted; automatically skip
      if (player.isCPU) {
        logCpuThought(`${player.name} swap`, ["no matching tile is currently on the board"]);
        skipShiftBtn.classList.remove("hidden");
        skipShiftBtn.disabled = true;
        skipShiftBtn.classList.add("cpu-active-control");
        actionText.textContent = `${player.name} has no tile to shift.`;
        scheduleCpuAction(() => {
          endTurn();
        });
      } else {
        // Show skip button so human can continue
        actionText.textContent = "No tiles available to shift. You may skip.";
        maybeShowFirstGameTip("skipShift", { humanOnly: true });
        skipShiftBtn.classList.remove("hidden");
        skipShiftBtn.onclick = () => {
          if (shouldSendGuestAction()) { sendOnlineAction({ kind: "skipShift" }); return; }
          skipShiftBtn.classList.add("hidden");
          actionText.textContent = "";
          completeFirstGameTip("skipShift");
          endTurn();
        };
      }
      return;
    }
    if (player.isCPU) {
      // Evaluate possible shifts and choose the best using heuristic. If no
      // beneficial shift is found (null returned), the CPU will skip
      // shifting entirely instead of picking up and putting the tile back.
      const shiftResult = evaluateBestShift(player, selectableTiles);
      const target = shouldCpuUseShift(shiftResult) ? shiftResult.shift : null;
      logCpuThought(`${player.name} swap`, [
        `options: ${selectableTiles.map((coord) => {
          const tile = boardState.get(`${coord.row},${coord.col}`);
          return tile ? tile.tile_number : `${coord.row + 1}-${coord.col + 1}`;
        }).join(" / ")}`,
        target ? describeShiftPlan(shiftResult) : `best value ${shiftResult.score.toFixed(1)} is below ${cpuShiftThreshold(shiftResult).toFixed(1)}; skipping`,
      ]);
      if (!target) {
        actionText.textContent = `${player.name} chooses not to shift.`;
        skipShiftBtn.classList.remove("hidden");
        skipShiftBtn.disabled = true;
        skipShiftBtn.classList.add("cpu-active-control");
        scheduleCpuAction(() => {
          endTurn();
        });
        return;
      }
      // Announce which tile the CPU will shift
      const tile = boardState.get(`${target.row},${target.col}`);
      const tileLabel = tile ? tile.tile_number : `${target.row + 1}-${target.col + 1}`;
      actionText.textContent = `${player.name} is shifting tile ${tileLabel}...`;
      showCpuStepControl("Select Tile");
      // First highlight the chosen tile so the player can track what's happening.
      highlightCpuShiftTile(target.row, target.col, () => {
        performShift(target.row, target.col, target.placement);
      });
    } else {
      // Human player: show skip button and let them select a tile.
      actionText.textContent = "You may shift a tile. Select one or skip.";
      skipShiftBtn.classList.remove("hidden");
      skipShiftBtn.onclick = () => {
        if (shouldSendGuestAction()) { sendOnlineAction({ kind: "skipShift" }); return; }
        maybeShowFirstGameTip("skipShift", { humanOnly: true });
        skipShiftBtn.classList.add("hidden");
        actionText.textContent = "";
        completeFirstGameTip("skipShift");
        endTurn();
      };
      if (selectableTiles.length > 0) {
        maybeShowFirstGameTip("shift", { humanOnly: true });
      }
      selectableTiles.forEach((coord) => {
        const tileEl = document.querySelector(
          `.tile[data-row='${coord.row}'][data-col='${coord.col}']`
        );
        if (tileEl) {
          tileEl.classList.add("selectable");
          const handler = (event) => {
            cursorLastClientPos = { x: event.clientX, y: event.clientY };
            if (shouldSendGuestAction()) { sendOnlineAction({ kind: "shiftTile", row: coord.row, col: coord.col }); return; }
            completeFirstGameTip("shift");
            performShift(coord.row, coord.col);
          };
          tileEl._shiftHandler = handler;
          tileEl.addEventListener("click", handler, { once: true });
          highlightedTiles.push(tileEl);
        }
      });
    }
  }

  function evaluateBestShift(cpuPlayer, options) {
    let bestShift = null;
    let bestScore = -Infinity;
    let bestDetails = {
      newDistance: Infinity,
      newWinningCombos: 0,
      newWinningTotals: [],
      blocksImmediateThreat: false,
      ridesFinish: false,
    };
    const cpuOldDist = shortestPathLength(cpuPlayer.pos);
    const cpuOldProfile = exactFinishProfile(cpuPlayer.pos);
    const opponents = players.filter((p) => p !== cpuPlayer);
    const opponentOldDists = opponents.map((p) => shortestPathLength(p.pos));
    const opponentOldProfiles = opponents.map((p) => exactFinishProfile(p.pos));
    options.forEach((coord) => {
      const key = `${coord.row},${coord.col}`;
      const simulatedTile = boardState.get(key);
      if (!simulatedTile) return;
      const carried = players
        .map((p, index) => ({ player: p, index, pos: p.pos ? { ...p.pos } : null }))
        .filter((entry) => entry.pos && entry.pos.row === coord.row && entry.pos.col === coord.col);
      const oldFinish = { row: finishRow, col: finishCol };
      // Remove the tile from the board so we can consider placement elsewhere.
      boardState.delete(key);
      // Determine all empty neighbouring positions where this tile could be placed.
      const positions = computePlacementCandidates(coord.row, coord.col, simulatedTile);
      positions.forEach((pos) => {
        pos.rotations.forEach((rotation) => {
          if (pos.row === coord.row && pos.col === coord.col && (rotation.step || 0) === 0) return;
          const placement = {
            row: pos.row,
            col: pos.col,
            tile: deepCopy(rotation.tile),
            step: rotation.step,
          };
          const placeKey = `${pos.row},${pos.col}`;
          boardState.set(placeKey, deepCopy(rotation.tile));
          carried.forEach((entry) => {
            entry.player.pos = {
              row: pos.row,
              col: pos.col,
              space: rotateSpaceName(entry.pos.space, rotation.step),
            };
          });
          if (simulatedTile.tile_number === "3-4") {
            finishRow = pos.row;
            finishCol = pos.col;
          }
          const cpuNewDist = shortestPathLength(cpuPlayer.pos);
          const cpuNewProfile = exactFinishProfile(cpuPlayer.pos);
          const winningCombosDelta = cpuNewProfile.combos - cpuOldProfile.combos;
          let score = boundedDistanceDelta(cpuOldDist, cpuNewDist) * 7;
          const reasons = [];
          if (cpuOldDist === Infinity && cpuNewDist !== Infinity) reasons.push("opens route");
          if (cpuOldDist !== Infinity && cpuNewDist === Infinity) reasons.push("blocks self");
          if (cpuNewDist < cpuOldDist) reasons.push(`self ${describeDistance(cpuOldDist)} -> ${describeDistance(cpuNewDist)}`);
          score += winningCombosDelta * 14;
          if (winningCombosDelta > 0) {
            reasons.push(`adds winning rolls ${cpuNewProfile.totals.join("/")}`);
          } else if (winningCombosDelta < 0) {
            score -= 80 + Math.abs(winningCombosDelta) * 6;
            reasons.push("spoils winning rolls");
          } else if (cpuOldProfile.combos > 0) {
            score -= 35;
            reasons.push("already has winning rolls");
          }
          if (Number.isFinite(cpuOldDist) && cpuOldDist <= 12 && winningCombosDelta <= 0) {
            score -= 22;
            reasons.push("near finish; shift must matter");
          }
          const ridesFinish = isFinishSpace(cpuPlayer.pos);
          if (ridesFinish) {
            score += 10000;
            reasons.push("rides onto finish");
          }
          const cpuTile = cpuPlayer.pos ? boardState.get(`${cpuPlayer.pos.row},${cpuPlayer.pos.col}`) : null;
          const cpuSpaceColour = cpuTile && cpuPlayer.pos ? cpuTile[cpuPlayer.pos.space] : "";
          if (cpuSpaceColour === "S") {
            score += 22;
            reasons.push("keeps soft water");
          }
          if (cpuSpaceColour === "H") {
            score -= 28;
            reasons.push("keeps hard water");
          }
          let blocksImmediateThreat = false;
          opponents.forEach((opponent, index) => {
            const oldDist = opponentOldDists[index];
            const oldProfile = opponentOldProfiles[index];
            const newDist = shortestPathLength(opponent.pos);
            const newProfile = exactFinishProfile(opponent.pos);
            const delta = boundedDistanceDelta(oldDist, newDist);
            score -= delta * 4;
            const opponentWinDelta = newProfile.combos - oldProfile.combos;
            score -= opponentWinDelta * 12;
            if (oldProfile.combos > 0 && newProfile.combos === 0) {
              score += 45;
              blocksImmediateThreat = true;
              reasons.push(`blocks ${opponent.name}'s winning roll`);
            } else if (oldProfile.combos === 0 && newProfile.combos > 0) {
              score -= 70;
              reasons.push(`gives ${opponent.name} winning rolls`);
            } else if (opponentWinDelta < 0) {
              reasons.push(`cuts ${opponent.name}'s winning rolls`);
            }
            if (oldDist !== Infinity && newDist === Infinity) reasons.push(`strands ${opponent.name}`);
            if (oldDist === Infinity && newDist !== Infinity) reasons.push(`helps ${opponent.name}`);
            if (newDist > oldDist) reasons.push(`${opponent.name} farther`);
          });
          const movedDistance = Math.abs(pos.row - coord.row) + Math.abs(pos.col - coord.col);
          if (movedDistance === 0) {
            score -= 18;
            reasons.push("in-place rotation");
          } else {
            score -= Math.min(18, movedDistance * 1.5);
            reasons.push(`moves tile ${movedDistance} space${movedDistance === 1 ? "" : "s"}`);
          }
          if (score > bestScore) {
            bestScore = score;
            bestShift = {
              row: coord.row,
              col: coord.col,
              placement,
              reasons,
            };
            bestDetails = {
              newDistance: cpuNewDist,
              newWinningCombos: cpuNewProfile.combos,
              newWinningTotals: cpuNewProfile.totals,
              blocksImmediateThreat,
              ridesFinish,
            };
          }
          carried.forEach((entry) => {
            entry.player.pos = entry.pos ? { ...entry.pos } : null;
          });
          finishRow = oldFinish.row;
          finishCol = oldFinish.col;
          // Remove the temporarily placed tile
          boardState.delete(placeKey);
        });
      });
      // After evaluating all positions and rotations, restore the original tile
      boardState.set(key, simulatedTile);
    });
    return {
      shift: bestShift,
      score: bestScore === -Infinity ? 0 : bestScore,
      oldDistance: cpuOldDist,
      newDistance: bestDetails.newDistance,
      oldWinningCombos: cpuOldProfile.combos,
      oldWinningTotals: cpuOldProfile.totals,
      newWinningCombos: bestDetails.newWinningCombos,
      newWinningTotals: bestDetails.newWinningTotals,
      blocksImmediateThreat: bestDetails.blocksImmediateThreat,
      ridesFinish: bestDetails.ridesFinish,
    };
  }

  /**
   * Compute candidate placement positions for a picked-up tile. Returns an
   * array of objects containing row, col and tile (rotated to valid
   * orientation). Only positions adjacent to existing tiles and producing
   * at least one valid connection are included.
   * @param {number} removedRow
   * @param {number} removedCol
   * @param {Object} tile The tile being placed
   */
  function computePlacementCandidates(removedRow, removedCol, tile) {
    const positions = [];
    // Identify potential empty spaces adjacent to existing tiles
    const considered = new Set();
    considered.add(`${removedRow},${removedCol}`);
    boardState.forEach((_, key) => {
      const [r, c] = key.split(",").map((x) => parseInt(x, 10));
      const neighbors = [
        { row: r - 1, col: c },
        { row: r + 1, col: c },
        { row: r, col: c - 1 },
        { row: r, col: c + 1 },
      ];
      neighbors.forEach((n) => {
        const key2 = `${n.row},${n.col}`;
        if (!boardState.has(key2)) {
          considered.add(key2);
        }
      });
    });
    considered.forEach((key) => {
      const [r, c] = key.split(",").map((x) => parseInt(x, 10));
      let rotated = deepCopy(tile);
      const rotations = [];
      for (let i = 0; i < 4; i++) {
        if (i > 0) rotated = rotateTile(rotated);
        if (isRotationValid(rotated, r, c)) {
          rotations.push({ tile: deepCopy(rotated), step: i });
        }
      }
      if (rotations.length > 0) {
        positions.push({ row: r, col: c, rotations });
      }
    });
    return positions;
  }

  function placeShiftedTile(row, col, tile, rotationStep) {
    boardState.set(`${row},${col}`, deepCopy(tile));
    recentlyPlacedTileKey = `${row},${col}`;
    if (pickedUpTileRect) {
      pendingTileFlight = {
        key: `${row},${col}`,
        rect: pickedUpTileRect,
        fromRotation: pickedUpTileRotation,
        toRotation: tileRotationStep(tile),
      };
      pickedUpTileRect = null;
      pickedUpTileRotation = tileRotationStep(tile);
    }
    carriedTokenIndices.forEach((index) => {
      const player = players[index];
      if (player.pos) {
        player.pos = {
          row,
          col,
          space: rotateSpaceName(player.pos.space, rotationStep),
        };
      }
    });
    carriedTokenIndices = [];
  }

  /**
   * Perform shifting of the selected tile. Removes it from the board and
   * highlights valid placement locations. For CPU, automatically chooses
   * placement and rotation. For human, waits for user input to pick a
   * placement then optionally rotates before confirming.
   * @param {number} row
   * @param {number} col
   * @param {Object|null} cpuPlacement Optional CPU-selected placement plan
   */
  function performShift(row, col, cpuPlacement = null) {
    clearHighlights();
    skipShiftBtn.classList.add("hidden");
    // Remove tile
    const key = `${row},${col}`;
    tileInHand = boardState.get(key);
    removedCoord = { row, col };
    const pickedUpTileEl = document.querySelector(`.tile[data-row='${row}'][data-col='${col}']`);
    pickedUpTileRect = pickedUpTileEl ? pickedUpTileEl.getBoundingClientRect() : null;
    pickedUpTileRotation = tileRotationStep(tileInHand);
    carriedTokenIndices = players
      .map((player, index) => (player.pos && player.pos.row === row && player.pos.col === col ? index : null))
      .filter((index) => index !== null);
    boardState.delete(key);
    // (No render here — for CPU we render once after placement so we don't stack
    //  two board zooms in the same tick. Human branch renders before highlighting.)
    const candidates = computePlacementCandidates(removedCoord.row, removedCoord.col, tileInHand)
      .map((candidate) => ({ ...candidate, allowRotation: true }));
    // If no valid placement: return tile to original location and end turn
    if (candidates.length === 0) {
      boardState.set(`${removedCoord.row},${removedCoord.col}`, tileInHand);
      carriedTokenIndices = [];
      // If the tile moved is the finish tile, update finishRow and finishCol
      if (tileInHand && tileInHand.tile_number === "3-4") {
        finishRow = removedCoord.row;
        finishCol = removedCoord.col;
      }
      tileInHand = null;
      removedCoord = null;
      pickedUpTileRect = null;
      renderBoard();
      endTurn();
      return;
    }
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer.isCPU) {
      if (!cpuPlacement) {
        actionText.textContent = `${currentPlayer.name} chooses not to shift.`;
        skipShiftBtn.classList.remove("hidden");
        skipShiftBtn.disabled = true;
        skipShiftBtn.classList.add("cpu-active-control");
        boardState.set(`${removedCoord.row},${removedCoord.col}`, tileInHand);
        tileInHand = null;
        removedCoord = null;
        pickedUpTileRect = null;
        carriedTokenIndices = [];
        renderBoard();
        scheduleCpuAction(() => {
          endTurn();
        });
        return;
      }
      actionText.textContent = `${currentPlayer.name} is placing the tile...`;
      showCpuStepControl("Place Tile");
      const fromRect = pickedUpTileRect;
      const fromRotation = pickedUpTileRotation;
      pickedUpTileRect = null; // suppress default FLIP; custom arc handles visuals
      placeShiftedTile(cpuPlacement.row, cpuPlacement.col, cpuPlacement.tile, cpuPlacement.step || 0);
      if (tileInHand && tileInHand.tile_number === "3-4") {
        finishRow = cpuPlacement.row;
        finishCol = cpuPlacement.col;
      }
      tileInHand = null;
      removedCoord = null;
      renderBoard();
      animateCpuTileFlight(fromRect, cpuPlacement.row, cpuPlacement.col, fromRotation, tileRotationStep(cpuPlacement.tile));
      if (declareAnyPlayerOnFinish()) return;
      scheduleCpuAction(() => {
        endTurn();
      });
      return;
    } else {
      // Human: render the gap state, then highlight candidates and allow placement.
      renderBoard();
      actionText.textContent = "Place the picked-up tile on an empty space (yellow).";
      maybeShowFirstGameTip("placeTile", { humanOnly: true });
      candidates.forEach((cand) => {
        const tileEl = document.querySelector(
          `.tile[data-row='${cand.row}'][data-col='${cand.col}']`
        );
        if (tileEl) {
          tileEl.classList.add("placement");
          const handler = (event) => {
            cursorLastClientPos = { x: event.clientX, y: event.clientY };
            if (shouldSendGuestAction()) { sendOnlineAction({ kind: "placeTile", row: cand.row, col: cand.col }); return; }
            placeTileAt(cand);
          };
          tileEl._placeHandler = handler;
          tileEl.addEventListener("click", handler, { once: true });
          placementCandidates.push(tileEl);
        }
      });
      // Attach a floating tile image that follows the cursor while tile is in hand
      if (tileInHand) {
        const szPx = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--tile-size") || "80", 10);
        const floater = document.createElement("div");
        floater.className = "tile-cursor";
        floater.style.width = szPx + "px";
        floater.style.height = szPx + "px";
        const art = document.createElement("div");
        art.className = "tile-cursor-art";
        art.style.backgroundImage = `url("${assetUrl(`assets/tiles/${tileInHand.tile_number}.png`)}")`;
        floater.style.setProperty("--cursor-rotation", `${pickedUpTileRotation * 90}deg`);
        floater.appendChild(art);
        attachQueuedTokensToFloatingStartTile(floater, tileInHand, szPx);
        document.body.appendChild(floater);
        const startX = pickedUpTileRect ? pickedUpTileRect.left + pickedUpTileRect.width / 2 : null;
        const startY = pickedUpTileRect ? pickedUpTileRect.top + pickedUpTileRect.height / 2 : null;
        if (startX !== null && startY !== null) {
          floater.style.left = `${startX}px`;
          floater.style.top = `${startY}px`;
        } else if (cursorLastClientPos) {
          floater.style.left = `${cursorLastClientPos.x}px`;
          floater.style.top = `${cursorLastClientPos.y}px`;
        }
        if (cursorLastClientPos && startX !== null && startY !== null) {
          floater.classList.add("lifting");
          requestAnimationFrame(() => {
            floater.style.left = `${cursorLastClientPos.x}px`;
            floater.style.top = `${cursorLastClientPos.y}px`;
          });
          setTimeout(() => floater.classList.remove("lifting"), 240);
        }
        const onMove = (e) => {
          const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
          const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
          cursorLastClientPos = { x, y };
          floater.style.left = x + "px";
          floater.style.top = y + "px";
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("touchmove", onMove, { passive: true });
        cursorTileCleanup = () => {
          cursorLastClientPos = null;
          floater.remove();
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("touchmove", onMove);
        };
      }
    }
  }

  /**
   * Place the tile in hand at the selected candidate location and allow
   * rotation. After confirming the placement, the turn ends.
   * @param {Object} cand {row,col,rotations}
   */
  function placeTileAt(cand) {
    // Override the pickup rect with where the cursor currently is so the tile
    // flight animates FROM the cursor drop point instead of the original board position.
    if (cursorLastClientPos && pickedUpTileRect) {
      const sz = pickedUpTileRect.width * 1.08; // match cursor scale
      pickedUpTileRect = {
        left: cursorLastClientPos.x - sz / 2,
        top: cursorLastClientPos.y - sz / 2,
        width: sz,
        height: sz,
      };
    }
    completeFirstGameTip("placeTile");
    clearHighlights();
    // Place first rotation
    rotationIndex = 0;
    availableRotations = cand.rotations;
    // Insert the first rotation of the tile into the board, carrying any tokens on it.
    placeShiftedTile(cand.row, cand.col, availableRotations[rotationIndex].tile, availableRotations[rotationIndex].step || 0);
    // Update finish position if placing finish tile
    if (tileInHand && tileInHand.tile_number === "3-4") {
      finishRow = cand.row;
      finishCol = cand.col;
    }
    tileInHand = null;
    removedCoord = null;
    renderBoard();
    // Highlight the placed tile for reference and attach rotation handler if allowed
    const tileEl = document.querySelector(`.tile[data-row='${cand.row}'][data-col='${cand.col}']`);
    if (tileEl) {
      tileEl.classList.add("selectable");
      highlightedTiles.push(tileEl);
      if (cand.allowRotation !== false) {
        // Define rotation handler
        let isRotating = false;
        const getPlacedTile = () => document.querySelector(`.tile[data-row='${cand.row}'][data-col='${cand.col}']`);
        const rotateHandler = () => {
          if (isRotating) return;
          if (shouldSendGuestAction()) { sendOnlineAction({ kind: "rotatePlacement" }); return; }
          completeFirstGameTip("rotateTile");
          // Guard if no rotations or only one orientation
          if (availableRotations.length === 0) return;
          const activeTile = getPlacedTile();
          if (!activeTile) return;
          // Determine next orientation index
          const currentTile = availableRotations[rotationIndex].tile;
          const nextIndex = (rotationIndex + 1) % availableRotations.length;
          const nextTile = availableRotations[nextIndex].tile;
          isRotating = true;
          animateTileRotation(activeTile, currentTile, nextTile, () => {
            const diffSteps = rotationStepsBetweenTiles(currentTile, nextTile);
            rotationIndex = nextIndex;
            boardState.set(`${cand.row},${cand.col}`, deepCopy(availableRotations[rotationIndex].tile));
            rotatePlayersOnTile(cand.row, cand.col, diffSteps);
            suppressNextBoardZoom = true;
            renderBoard();
            // After re-rendering, find the new tile and reapply selection and rotation handler
            const newTile = getPlacedTile();
            if (newTile) {
              newTile.classList.add("selectable");
              highlightedTiles.push(newTile);
              // Rebind the handler for further rotations and store on the element
              newTile._rotateHandler = rotateHandler;
              newTile.addEventListener("click", rotateHandler, { once: false });
            }
            isRotating = false;
          });
        };
        // Attach rotation handler and store on the element
        tileEl._rotateHandler = rotateHandler;
        tileEl.addEventListener("click", rotateHandler, { once: false });
      }
    }
    // Update announcer message based on whether rotation is allowed
    if (cand.allowRotation !== false && availableRotations.length > 1) {
      actionText.textContent = "Click the placed tile to rotate, then confirm placement.";
      maybeShowFirstGameTip("rotateTile", { humanOnly: true });
    } else {
      actionText.textContent = "Confirm placement.";
      maybeShowFirstGameTip("confirmPlacement", { humanOnly: true });
    }
    // Prepare announcer and dynamic controls
    // Remove any existing temporary buttons
    clearTempControls();
    // Create confirm button for placement
    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Confirm Placement";
    confirmBtn.className = "control-btn temp-btn";
    confirmBtn.addEventListener("click", () => {
      if (shouldSendGuestAction()) { sendOnlineAction({ kind: "confirmPlacement" }); return; }
      completeFirstGameTip("confirmPlacement");
      clearHighlights();
      // Remove temporary controls once confirmed
      clearTempControls();
      if (declareAnyPlayerOnFinish()) return;
      endTurn();
    });
    controlsContainer.appendChild(confirmBtn);
  }

  /**
   * End the current player's turn and proceed to the next player. Applies
   * skipping if the next player has missNextTurn flagged. Resets dice
   * display and updates UI accordingly. If the winner was declared, this
   * function does nothing.
   */
  function endTurn() {
    // If game over, ignore
    if (gamePhase === "GAME_OVER") return;
    const player = players[currentPlayerIndex];
    let nextMessage = "";
    // Soft Water grants one extra turn when landed on. It is consumed here so
    // merely remaining on a Soft Water space does not create an endless loop.
    const takesExtraTurn = Boolean(player.extraTurnPending);
    player.extraTurnPending = false;
    if (takesExtraTurn) {
      nextMessage = `${player.name} takes another turn.`;
    } else {
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    }
    // Handle skip turn
    let loops = 0;
    while (players.length > 1 && players[currentPlayerIndex].missNextTurn && loops < players.length) {
      nextMessage = `${players[currentPlayerIndex].name} misses this turn.`;
      players[currentPlayerIndex].missNextTurn = false;
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
      loops++;
    }
    // Re-render board so the current player's token highlight updates
    renderBoard();
    // Clear announcer message and remove any temporary controls from previous step
    actionText.textContent = nextMessage;
    clearTempControls();
    clearDiceDisplay();
    rollBtn.disabled = false;
    skipShiftBtn.classList.add("hidden");
    skipShiftBtn.disabled = false;
    updateTurnIndicator();
    gamePhase = "AWAITING_ROLL";
    saveLocalGame();
    // If next player is CPU, automatically roll dice
    const nextPlayer = players[currentPlayerIndex];
    if (nextPlayer.isCPU) {
      setTimeout(() => rollDice(), 500);
    } else if (!nextMessage) {
      showRollPrompt();
    }
  }

  /**
   * Update the UI element showing whose turn it is.
   */
  function updateTurnIndicator() {
    const player = players[currentPlayerIndex];
    turnIndicator.textContent = `${player.name}'s Turn${player.isCPU ? " (CPU)" : ""}`;
    // Drive the colored bar above the action panel from the active player's color.
    document.documentElement.style.setProperty("--active-player-color", player.colour);
    // Update the mini token in the action panel.
    if (turnTokenEl) {
      turnTokenEl.style.backgroundColor = player.colour;
      // Rebuild overlay so it reflects the current skin.
      turnTokenEl.innerHTML = "";
      if (player.tokenSkin != null) {
        const ov = document.createElement("span");
        ov.className = "token-skin-overlay";
        ov.style.setProperty("--token-icon", `url("${tokenIconUrl(player.tokenSkin)}")`);
        turnTokenEl.appendChild(ov);
      }
    }
  }

  const DICE_ROLL_DURATION = 720;
  const DICE_ROLL_TICK = 110;
  const PIP_POSITIONS = ["top-left", "top-right", "middle-left", "middle-right", "center", "bottom-left", "bottom-right"];
  const PIP_LAYOUTS = {
    1: ["center"],
    2: ["top-left", "bottom-right"],
    3: ["top-left", "center", "bottom-right"],
    4: ["top-left", "top-right", "bottom-left", "bottom-right"],
    5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
    6: ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"],
  };

  function renderDie(index) {
    return `
      <span class="die" data-die-index="${index}" aria-label="1">
        ${PIP_POSITIONS.map((pip) => `<span class="pip ${pip}"></span>`).join("")}
      </span>
    `;
  }

  function ensureDiceShell() {
    diceDisplay.classList.add("has-dice");
    if (!diceDisplay.querySelector(".dice-pair")) {
      diceDisplay.innerHTML = `
        <span class="dice-pair" aria-label="Dice roll">
          ${renderDie(0)}
          ${renderDie(1)}
        </span>
        <span class="dice-sum" aria-hidden="true"></span>
      `;
    }
  }

  function updateDieFace(dieEl, value) {
    const activePips = PIP_LAYOUTS[value] || PIP_LAYOUTS[1];
    dieEl.setAttribute("aria-label", String(value));
    dieEl.dataset.value = String(value);
    dieEl.querySelectorAll(".pip").forEach((pip) => {
      pip.classList.toggle("active", activePips.includes(pip.classList[1]));
    });
  }

  function setDiceFaces(die1, die2, showTotal = false) {
    ensureDiceShell();
    const dice = diceDisplay.querySelectorAll(".die");
    updateDieFace(dice[0], die1);
    updateDieFace(dice[1], die2);
    const pair = diceDisplay.querySelector(".dice-pair");
    const sum = diceDisplay.querySelector(".dice-sum");
    pair.setAttribute("aria-label", `Dice roll ${die1} and ${die2}`);
    sum.textContent = showTotal ? `= ${die1 + die2}` : "";
    sum.classList.toggle("visible", showTotal);
  }

  function clearDiceDisplay() {
    diceDisplay.classList.remove("rolling", "rolled", "has-dice");
    diceDisplay.textContent = "";
  }

  function renderDiceResult(die1, die2) {
    diceDisplay.classList.remove("rolling");
    diceDisplay.classList.remove("rolled");
    setDiceFaces(die1, die2, true);
    requestAnimationFrame(() => {
      diceDisplay.classList.add("rolled");
    });
  }

  function playDiceRoll(die1, die2, onComplete) {
    const startedAt = performance.now();
    diceDisplay.classList.remove("rolled");
    setDiceFaces(rollDie(), rollDie(), false);
    requestAnimationFrame(() => {
      diceDisplay.classList.add("rolling");
    });

    const rollInterval = setInterval(() => {
      setDiceFaces(rollDie(), rollDie(), false);
    }, DICE_ROLL_TICK);

    setTimeout(() => {
      clearInterval(rollInterval);
      renderDiceResult(die1, die2);
      const elapsed = performance.now() - startedAt;
      const settleDelay = Math.max(120, DICE_ROLL_DURATION - elapsed + 120);
      setTimeout(onComplete, settleDelay);
    }, DICE_ROLL_DURATION);
  }

  /**
   * Roll two six-sided dice. Updates the diceDisplay and triggers movement
   * computation. CPU players roll automatically when it's their turn. This
   * function is bound to the roll button for human players.
   */
  function rollDice() {
    if (gamePhase !== "AWAITING_ROLL") return;
    const player = players[currentPlayerIndex];
    if (players.length === 1 && player.missNextTurn) {
      player.missNextTurn = false;
      actionText.textContent = `${player.name} misses this turn.`;
      clearDiceDisplay();
      renderBoard();
      return;
    }
    rollBtn.disabled = true;
    // If CPU, introduce a delay and narrate the roll
    if (player.isCPU) {
      maybeShowFirstGameTip("cpuTurn");
      actionText.textContent = `${player.name} is rolling the dice...`;
      rollBtn.classList.add("cpu-active-control");
      scheduleCpuAction(() => {
        const [die1, die2] = rollDicePair();
        playDiceRoll(die1, die2, () => {
          rollBtn.classList.remove("cpu-active-control");
          diceRoll = [die1, die2];
          // Announce the result
          actionText.textContent = `${player.name} rolled ${die1} and ${die2}.`;
          logCpuThought(`${player.name} roll`, [`dice: ${die1} and ${die2}`, `move count: ${die1 + die2}`, `swap tiles: ${die1}-${die2}${die1 === die2 ? "" : ` or ${die2}-${die1}`}`]);
          gamePhase = "AWAITING_MOVE";
          // After a short delay, compute and perform the move
          scheduleCpuAction(() => {
            computeValidMoves(die1 + die2);
          });
        });
      });
    } else {
      maybeShowFirstGameTip("roll", { humanOnly: true });
      const [die1, die2] = rollDicePair();
      actionText.textContent = `${player.name} is rolling the dice...`;
      playDiceRoll(die1, die2, () => {
        completeFirstGameTip("roll");
        diceRoll = [die1, die2];
        actionText.textContent = `${player.name} rolled ${die1} and ${die2}.`;
        gamePhase = "AWAITING_MOVE";
        computeValidMoves(die1 + die2);
      });
    }
  }

  /**
   * Declare a winner and show a victory message. Disables further play.
   * @param {Object} player
   */
  function declareWinner(player) {
    gamePhase = "GAME_OVER";
    clearLocalGame();
    clearHighlights();
    completeFirstGameTips();
    actionText.textContent = `${player.name} wins! Congratulations!`;
    // Disable further controls
    rollBtn.disabled = true;
    skipShiftBtn.classList.add("hidden");
    clearTempControls();
    const winnerName = escapeHTML(player.name);
    const winnerColor = escapeHTML(player.colour);
    const winnerSkin = player.tokenSkin;
    const skinAttrs = winnerSkin != null
      ? ` data-skin="${winnerSkin}" style="background-color: ${winnerColor}; --token-icon: url('${tokenIconUrl(winnerSkin)}');"`
      : ` style="background-color: ${winnerColor};"`;
    showOverlayModal(`
      <div class="modal compact win-modal" role="dialog" aria-modal="true" aria-labelledby="winner-title">
        <div class="win-copy">
          <h2 id="winner-title">${winnerName} Wins!</h2>
          <div class="winner-token"${skinAttrs}></div>
        </div>
        <div class="modal-actions">
          <button id="play-again" type="button">Play Again</button>
          <button id="return-title" class="secondary" type="button">Title Screen</button>
        </div>
      </div>
    `);
    const playAgainBtn = document.getElementById("play-again");
    const returnTitleBtn = document.getElementById("return-title");
    if (playAgainBtn) {
      playAgainBtn.addEventListener("click", () => {
        hideOverlay();
        startGame(lastGameConfig.playerCount, lastGameConfig.cpuCount, lastGameConfig.names);
      });
    }
    if (returnTitleBtn) {
      returnTitleBtn.addEventListener("click", returnToMenu);
    }
  }

  /**
   * Start a new game with the specified number of players and CPU seats.
   * Resets all state and UI elements, initializes board and players, and
   * begins the first turn.
   * @param {number} playerCount
   * @param {number} cpuCount
   */
  function normalizeGameConfig(playerCount, cpuCount) {
    const total = Math.max(1, Math.min(maxPlayerSeats(), parseInt(playerCount, 10) || 2));
    const requestedCpuCount = typeof cpuCount === "boolean" ? (cpuCount ? 1 : 0) : cpuCount;
    const cpus = Math.max(0, Math.min(Math.max(0, total - 1), parseInt(requestedCpuCount, 10) || 0));
    return { playerCount: total, cpuCount: cpus };
  }

  function cleanPlayerName(value, fallback) {
    const name = String(value || "").replace(/\s+/g, " ").trim();
    return name ? name.slice(0, 22) : fallback;
  }

  function normalizeSkinIndex(value, fallback = 0) {
    const skin = Number(value);
    if (!Number.isFinite(skin)) return fallback;
    return Math.max(0, Math.min(TOKEN_SKIN_COUNT - 1, Math.round(skin)));
  }

  function normalizeTokenColour(value, fallback) {
    const colour = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(colour) ? colour : fallback;
  }

  function sanitizeSetupNames(names, config) {
    const source = names || {};
    const humanSeats = Math.max(0, config.playerCount - config.cpuCount);
    const result = { humans: [], cpus: [], humanSkins: [], cpuSkins: [], humanColours: [], cpuColours: [] };
    for (let i = 0; i < humanSeats; i++) {
      const fallbackSkin = i % TOKEN_SKIN_COUNT;
      const fallbackColour = PLAYER_COLOURS[i % PLAYER_COLOURS.length];
      result.humans.push(cleanPlayerName(source.humans?.[i], `Player ${i + 1}`));
      result.humanSkins.push(normalizeSkinIndex(source.humanSkins?.[i], fallbackSkin));
      result.humanColours.push(normalizeTokenColour(source.humanColours?.[i], fallbackColour));
    }
    for (let i = 0; i < config.cpuCount; i++) {
      const seatIndex = humanSeats + i;
      const fallbackSkin = seatIndex % TOKEN_SKIN_COUNT;
      const fallbackColour = PLAYER_COLOURS[seatIndex % PLAYER_COLOURS.length];
      result.cpus.push(cleanPlayerName(source.cpus?.[i], `CPU ${i + 1}`));
      result.cpuSkins.push(normalizeSkinIndex(source.cpuSkins?.[i], fallbackSkin));
      result.cpuColours.push(normalizeTokenColour(source.cpuColours?.[i], fallbackColour));
    }
    return result;
  }

  function readSavedSetup() {
    const saved = readPersistedJSON(SETUP_KEY, null);
    if (!saved || typeof saved !== "object") return null;
    const validModes = new Set(["single", "local", "online"]);
    const mode = validModes.has(saved.mode) ? saved.mode : "single";
    const config = normalizeGameConfig(saved.playerCount, saved.cpuCount);
    return {
      mode,
      config: {
        ...config,
        names: sanitizeSetupNames(saved.names, config),
      },
    };
  }

  function saveSetupSnapshot(config = null, names = null) {
    if (!playerCountInput || !cpuCountInput) return;
    const setupConfig = config || configForMode(setupMode);
    const setupNames = sanitizeSetupNames(names || readSetupNames(setupConfig), setupConfig);
    writePersistedJSON(SETUP_KEY, {
      mode: setupMode,
      playerCount: setupConfig.playerCount,
      cpuCount: setupConfig.cpuCount,
      names: setupNames,
    });
  }

  function readSetupNames(config = readSetupConfig()) {
    const humanSeats = Math.max(0, config.playerCount - config.cpuCount);
    const names = { humans: [], cpus: [], humanSkins: [], cpuSkins: [], humanColours: [], cpuColours: [] };
    if (!nameFieldsContainer) return names;
    for (let i = 0; i < humanSeats; i++) {
      const input = nameFieldsContainer.querySelector(`[data-name-kind="human"][data-name-index="${i}"]`);
      names.humans.push(cleanPlayerName(input ? input.value : "", `Player ${i + 1}`));
      const chooser = nameFieldsContainer.querySelector(`[data-chooser-kind="human"][data-chooser-index="${i}"]`);
      const fallbackSkin = i % TOKEN_SKIN_COUNT;
      const fallbackColour = PLAYER_COLOURS[i % PLAYER_COLOURS.length];
      names.humanSkins.push(chooser ? Number(chooser.dataset.skin ?? fallbackSkin) : fallbackSkin);
      names.humanColours.push(chooser ? (chooser.dataset.colour || fallbackColour) : fallbackColour);
    }
    for (let i = 0; i < config.cpuCount; i++) {
      const input = nameFieldsContainer.querySelector(`[data-name-kind="cpu"][data-name-index="${i}"]`);
      names.cpus.push(cleanPlayerName(input ? input.value : "", ""));
      const chooser = nameFieldsContainer.querySelector(`[data-chooser-kind="cpu"][data-chooser-index="${i}"]`);
      const fallbackSkin = (humanSeats + i) % TOKEN_SKIN_COUNT;
      const fallbackColour = PLAYER_COLOURS[(humanSeats + i) % PLAYER_COLOURS.length];
      names.cpuSkins.push(chooser ? Number(chooser.dataset.skin ?? fallbackSkin) : fallbackSkin);
      names.cpuColours.push(chooser ? (chooser.dataset.colour || fallbackColour) : fallbackColour);
    }
    return names;
  }

  function renderNameFields(config, preferredNames = null) {
    if (!nameFieldsContainer) return;
    const existing = preferredNames || readSetupNames(config);
    const humanSeats = Math.max(0, config.playerCount - config.cpuCount);
    const cpuSeats = Math.max(0, config.cpuCount);
    nameFieldsContainer.innerHTML = "";
    const makeField = (kind, index, label, value, placeholder) => {
      const field = document.createElement("label");
      field.className = `name-field ${kind === "cpu" ? "cpu-name-field" : ""}`;
      const span = document.createElement("span");
      span.textContent = label;
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 22;
      input.autocomplete = "off";
      input.spellcheck = false;
      input.dataset.nameKind = kind;
      input.dataset.nameIndex = String(index);
      input.value = value || "";
      input.placeholder = placeholder;
      input.setAttribute("aria-label", `${label} name`);
      input.title = "Click to edit name";

      // Token chooser button to the left of the name input.
      const playerIndex = kind === "cpu" ? humanSeats + index : index;
      const existingSkins = kind === "cpu" ? existing.cpuSkins : existing.humanSkins;
      const existingColours = kind === "cpu" ? existing.cpuColours : existing.humanColours;
      const initialSkin = (existingSkins && existingSkins[index] != null)
        ? existingSkins[index]
        : randomTokenSkin();
      const initialColour = (existingColours && existingColours[index])
        ? existingColours[index]
        : randomTokenColour();

      const chooser = document.createElement("button");
      chooser.type = "button";
      chooser.className = "token-chooser-btn";
      chooser.dataset.chooserKind = kind;
      chooser.dataset.chooserIndex = String(index);
      chooser.dataset.skin = String(initialSkin);
      chooser.dataset.colour = initialColour;
      chooser.setAttribute("aria-label", "Change token");
      chooser.title = "Click to change your token";
      const chooserIcon = document.createElement("span");
      chooserIcon.className = "token-chooser-icon";
      chooserIcon.style.setProperty("--chooser-colour", initialColour);
      chooserIcon.style.setProperty("--chooser-icon", `url("${tokenIconUrl(initialSkin)}")`);
      chooser.appendChild(chooserIcon);

      const applyToChooser = (skin, colour) => {
        chooser.dataset.skin = String(skin);
        chooser.dataset.colour = colour;
        chooserIcon.style.setProperty("--chooser-colour", colour);
        chooserIcon.style.setProperty("--chooser-icon", `url("${tokenIconUrl(skin)}")`);
        saveSetupSnapshot(configForMode(setupMode));
      };

      chooser.addEventListener("click", (event) => {
        event.preventDefault();
        openTokenPicker({
          colour: chooser.dataset.colour,
          currentSkin: Number(chooser.dataset.skin),
          playerName: input.value.trim() || label,
          onPick: applyToChooser,
        });
      });

      const diceBtn = document.createElement("button");
      diceBtn.type = "button";
      diceBtn.className = "token-randomize-btn";
      diceBtn.setAttribute("aria-label", "Randomize token");
      diceBtn.title = "Randomize token";
      // Empty — icon rendered purely via CSS mask-image on assets/shuffle.png
      diceBtn.addEventListener("click", (event) => {
        event.preventDefault();
        applyToChooser(randomTokenSkin(), randomTokenColour());
      });

      const row = document.createElement("div");
      row.className = "name-field-row";
      row.append(diceBtn, chooser, input);

      field.append(span, row);
      nameFieldsContainer.appendChild(field);
    };
    for (let i = 0; i < humanSeats; i++) {
      makeField("human", i, humanSeats === 1 ? "Player" : `Player ${i + 1}`, existing.humans?.[i] || `Player ${i + 1}`, `Player ${i + 1}`);
    }
    for (let i = 0; i < cpuSeats; i++) {
      const fallback = `CPU ${i + 1}`;
      makeField("cpu", i, cpuSeats === 1 ? "CPU" : `CPU ${i + 1}`, existing.cpus?.[i] || fallback, fallback);
    }
  }

  function configForMode(mode) {
    const rawPlayers = parseInt(playerCountInput ? playerCountInput.value : 2, 10) || 2;
    const rawCpus = parseInt(cpuCountInput ? cpuCountInput.value : 1, 10) || 0;
    const maxSeats = maxPlayerSeats();
    if (mode === "single") {
      const cpuSeats = Math.max(1, Math.min(maxSeats - 1, rawCpus)); // always at least 1 CPU
      return normalizeGameConfig(1 + cpuSeats, cpuSeats);
    }
    if (mode === "online") {
      const totalSeats = Math.max(2, Math.min(maxSeats, rawPlayers));
      const cpuSeats = Math.max(0, Math.min(totalSeats - 2, rawCpus));
      return normalizeGameConfig(totalSeats, cpuSeats);
    }
    if (mode === "local") {
      const totalSeats = Math.max(2, Math.min(maxSeats, rawPlayers));
      const cpuSeats = Math.max(0, Math.min(totalSeats - 2, rawCpus));
      return normalizeGameConfig(totalSeats, cpuSeats);
    }
    return normalizeGameConfig(rawPlayers, rawCpus);
  }

  function setSetupMode(mode) {
    const menuStartHeight = menuDiv ? menuDiv.offsetHeight : 0;
    setupMode = mode || "single";
    setupForm.dataset.mode = setupMode;
    modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === setupMode);
      button.setAttribute("aria-pressed", button.dataset.mode === setupMode ? "true" : "false");
    });
    const config = configForMode(setupMode);
    applySetupConfig(config);
    if (setupMode === "single") {
      if (playerCountInput) playerCountInput.disabled = true;
      if (cpuCountInput) cpuCountInput.disabled = false;
    } else {
      if (playerCountInput) playerCountInput.disabled = false;
      if (cpuCountInput) cpuCountInput.disabled = false;
    }
    if (playerCountInput) {
      playerCountInput.min = setupMode === "single" ? "1" : "2";
      playerCountInput.max = setupMode === "single" ? "1" : (playerMaximumsDisabled() ? "" : "4");
    }
    if (menuDiv && menuStartHeight) {
      const menuEndHeight = menuDiv.scrollHeight;
      if (Math.abs(menuEndHeight - menuStartHeight) > 1) {
        menuDiv.style.height = `${menuStartHeight}px`;
        menuDiv.style.overflow = "hidden";
        requestAnimationFrame(() => {
          menuDiv.style.transition = "height 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
          menuDiv.style.height = `${menuEndHeight}px`;
        });
        setTimeout(() => {
          menuDiv.style.height = "";
          menuDiv.style.overflow = "";
          menuDiv.style.transition = "";
        }, 320);
      }
    }
    saveSetupSnapshot(config);
  }

  function applySetupConfig(config) {
    const names = config.names || readSetupNames(config);
    if (playerCountInput) {
      playerCountInput.min = setupMode === "single" ? "1" : "2";
      playerCountInput.max = setupMode === "single" ? "1" : (playerMaximumsDisabled() ? "" : "4");
      playerCountInput.value = String(config.playerCount);
    }
    if (cpuCountInput) {
      cpuCountInput.min = setupMode === "single" ? "1" : "0";
      cpuCountInput.max = setupMode === "single"
        ? (playerMaximumsDisabled() ? "" : "3")
        : String(Math.max(0, config.playerCount - 2));
      cpuCountInput.value = String(config.cpuCount);
    }
    renderNameFields(config, names);
  }

  function readSetupConfig() {
    const config = configForMode(setupMode);
    applySetupConfig(config);
    return config;
  }

  function startGame(playerCount, cpuCount, names = null) {
    clearLocalGame();
    beginFirstGameTips();
    const config = normalizeGameConfig(playerCount, cpuCount);
    const playerNames = names || readSetupNames(config);
    lastGameConfig = { ...config, names: playerNames };
    applySetupConfig({ ...config, names: playerNames });
    saveSetupSnapshot(config, playerNames);
    hideOverlay();
    initBoard();
    initPlayers(config.playerCount, config.cpuCount, playerNames);
    resetCpuDebugLog(config.cpuCount > 0);
    currentPlayerIndex = 0;
    gamePhase = "AWAITING_ROLL";
    document.body.classList.add("game-active");
    menuDiv.classList.add("hidden");
    gameUI.classList.remove("hidden");
    // Clear messages and reset controls
    actionText.textContent = "";
    clearDiceDisplay();
    skipShiftBtn.classList.add("hidden");
    clearTempControls();
    renderBoard();
    updateTurnIndicator();
    rollBtn.disabled = false;
    showRollPrompt();
    // If first player is CPU, auto roll
    if (players[0].isCPU) {
      setTimeout(() => rollDice(), 500);
    }
  }

  // ── Local game save / resume ──────────────────────────────────────────────

  function saveLocalGame() {
    if (onlineSession) return; // don't clobber local save with online state
    if (gamePhase === "INIT" || gamePhase === "GAME_OVER") return;
    try {
      writePersistedJSON(SAVED_GAME_KEY, serializeGameState());
    } catch (e) { /* storage full or unavailable */ }
  }

  function clearLocalGame() {
    removePersistedValue(SAVED_GAME_KEY);
    const btn = document.getElementById("continue-game");
    if (btn) btn.classList.add("hidden");
  }

  function resumeLocalGame() {
    const state = readPersistedJSON(SAVED_GAME_KEY, null);
    if (!state) return;
    beginFirstGameTips();
    hideOverlay();
    boardState = new Map((state.board || []).map(([key, tile]) => [key, deepCopy(tile)]));
    finishRow = state.finishRow ?? 2;
    finishCol = state.finishCol ?? 3;
    players = deepCopy(state.players || []).map((p) => ({
      ...p,
      extraTurnPending: Boolean(p.extraTurnPending),
    }));
    currentPlayerIndex = state.currentPlayerIndex || 0;
    diceRoll = Array.isArray(state.diceRoll) ? [...state.diceRoll] : [0, 0];
    gamePhase = state.gamePhase || "AWAITING_ROLL";
    lastGameConfig = state.lastGameConfig || lastGameConfig;
    document.body.classList.add("game-active");
    menuDiv.classList.add("hidden");
    gameUI.classList.remove("hidden");
    actionText.textContent = state.actionText || "";
    clearDiceDisplay();
    skipShiftBtn.classList.add("hidden");
    clearTempControls();
    renderBoard();
    updateTurnIndicator();
    rollBtn.disabled = false;
    if (diceRoll[0] && diceRoll[1]) renderDiceResult(diceRoll[0], diceRoll[1]);
    if (gamePhase === "AWAITING_ROLL") {
      const cur = players[currentPlayerIndex];
      if (cur && cur.isCPU) {
        setTimeout(() => rollDice(), 500);
      } else {
        showRollPrompt();
      }
    }
  }

  function updateContinueButton() {
    const btn = document.getElementById("continue-game");
    if (!btn) return;
    const saved = readPersistedJSON(SAVED_GAME_KEY, null);
    const hasGame = saved && saved.gamePhase && saved.gamePhase !== "INIT" && saved.gamePhase !== "GAME_OVER";
    btn.classList.toggle("hidden", !hasGame);
    if (hasGame && saved.players) {
      const names = saved.players.map((p) => p.name).join(", ");
      btn.title = `Resume: ${names}`;
    }
  }

  function devBootStartQueueGame() {
    window.__hcmForcedRollQueue = [[1, 1]];
    setSetupMode("local");
    startGame(4, 0, {
      humans: ["Player 1", "Dummy 2", "Dummy 3", "Dummy 4"],
      cpus: [],
    });
  }

  if (setupForm) {
    setupForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const config = readSetupConfig();
      startGame(config.playerCount, config.cpuCount, readSetupNames(config));
    });
  }

  const handleSetupCountInput = () => {
    const config = readSetupConfig();
    saveSetupSnapshot(config);
  };

  if (playerCountInput) {
    playerCountInput.addEventListener("input", handleSetupCountInput);
  }

  if (cpuCountInput) {
    cpuCountInput.addEventListener("input", handleSetupCountInput);
  }

  if (nameFieldsContainer) {
    nameFieldsContainer.addEventListener("input", (event) => {
      if (event.target && event.target.matches("[data-name-kind]")) {
        saveSetupSnapshot(configForMode(setupMode));
      }
    });
    nameFieldsContainer.addEventListener("change", (event) => {
      if (event.target && event.target.matches("[data-name-kind]")) {
        saveSetupSnapshot(configForMode(setupMode));
      }
    });
  }

  document.querySelectorAll(".number-step").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const input = document.getElementById(button.dataset.stepFor || "");
      if (!input || input.disabled) return;
      const step = Number(button.dataset.step) || 0;
      if (
        setupMode === "local" &&
        button.dataset.stepFor === "cpu-count-input" &&
        playerCountInput &&
        !playerCountInput.disabled
      ) {
        const playerMin = playerCountInput.min === "" ? -Infinity : Number(playerCountInput.min);
        const playerMax = playerCountInput.max === "" ? Infinity : Number(playerCountInput.max);
        const cpuMin = input.min === "" ? -Infinity : Number(input.min);
        const currentPlayers = Number(playerCountInput.value) || 0;
        const currentCpus = Number(input.value) || 0;
        const desiredPlayers = Math.max(playerMin, Math.min(playerMax, currentPlayers + step));
        const actualStep = desiredPlayers - currentPlayers;
        if (actualStep === 0) return;
        const nextCpus = Math.max(cpuMin, Math.min(Math.max(0, desiredPlayers - 2), currentCpus + actualStep));
        const nextPlayers = Math.max(playerMin, Math.min(playerMax, currentPlayers + (nextCpus - currentCpus)));
        input.value = String(nextCpus);
        playerCountInput.value = String(nextPlayers);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      const min = input.min === "" ? -Infinity : Number(input.min);
      const max = input.max === "" ? Infinity : Number(input.max);
      const current = Number(input.value) || 0;
      input.value = String(Math.max(min, Math.min(max, current + step)));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  const savedSetup = readSavedSetup();
  if (savedSetup) {
    setupMode = savedSetup.mode;
    lastGameConfig = savedSetup.config;
  }
  applySetupConfig(lastGameConfig);
  setSetupMode(setupMode);

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.mode === "online") return; // Coming Soon — not yet available
      setSetupMode(button.dataset.mode);
    });
  });

  // Continue game button
  const continueGameBtn = document.getElementById("continue-game");
  if (continueGameBtn) {
    continueGameBtn.addEventListener("click", resumeLocalGame);
  }
  updateContinueButton();

  if (menuInstructionsBtn) {
    menuInstructionsBtn.addEventListener("click", showInstructions);
  }

  if (menuSettingsBtn) {
    menuSettingsBtn.addEventListener("click", showSettings);
  }

  if (gameInstructionsBtn) {
    gameInstructionsBtn.addEventListener("click", showInstructions);
  }

  if (gameSettingsBtn) {
    gameSettingsBtn.addEventListener("click", showSettings);
  }

  if (exitGameBtn) {
    exitGameBtn.addEventListener("click", returnToMenu);
  }

  if (tipDismissBtn) {
    tipDismissBtn.addEventListener("click", dismissFirstGameTip);
  }

  if (hostOnlineBtn) {
    hostOnlineBtn.addEventListener("click", () => {
      hostOnlineGame().catch((error) => {
        showOnlineStatus("Online Error", `
          <p>${escapeHTML(error.message)}</p>
          <div class="modal-actions">
            <button type="button" data-close-modal>Close</button>
          </div>
        `);
      });
    });
  }

  if (joinOnlineBtn) {
    joinOnlineBtn.addEventListener("click", showJoinOnlineForm);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.classList.contains("hidden")) {
      const winModal = overlay.querySelector(".win-modal");
      if (!winModal) hideOverlay();
    }
  });

  window.addEventListener("resize", () => {
    if (!gameUI.classList.contains("hidden")) {
      recenterBoardCamera(false);
    }
  });

  // Attach roll button handler
  rollBtn.addEventListener("click", () => {
    if (shouldSendGuestAction()) {
      sendOnlineAction({ kind: "roll" });
      return; // host will roll and broadcast the result
    }
    rollDice();
  });

  if (window.location.hash === "#dev-start-queue") {
    setTimeout(devBootStartQueueGame, 0);
  }
})();
