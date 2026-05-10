const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("script.js", "utf8");
const match = source.match(/const TILE_DATA = (\[[\s\S]*?\n  \]);/);

if (!match) {
  throw new Error("Could not find TILE_DATA in script.js");
}

assert(
  /if\s*\(\s*isFinishSpace\(pos\)\s*\)\s*return;/.test(source),
  "Movement paths must stop when they reach Hey Culligan Man before the final count",
);
assert(
  /extraTurnPending\s*=\s*true/.test(source) &&
  /const takesExtraTurn = Boolean\(player\.extraTurnPending\);/.test(source) &&
  /player\.extraTurnPending = false;/.test(source),
  "Soft Water must grant exactly one pending extra turn instead of checking where the token still stands",
);
assert(
  /\(index \+ steps\) % order\.length \+ order\.length/.test(source),
  "Space-name rotation must normalize negative steps so rotated tiles do not collapse hitboxes into the center",
);

const TILE_DATA = vm.runInNewContext(`(${match[1]})`);
const SPACES = ["top", "left", "middle", "right", "bottom"];
const SIDE_DELTAS = {
  top: [-1, 0, "bottom"],
  right: [0, 1, "left"],
  bottom: [1, 0, "top"],
  left: [0, -1, "right"],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function key(row, col) {
  return `${row},${col}`;
}

function posKey(pos) {
  return `${pos.row},${pos.col},${pos.space}`;
}

function rotateTile(tile) {
  const rotated = JSON.parse(JSON.stringify(tile));
  const mapping = { top: "right", right: "bottom", bottom: "left", left: "top", middle: "middle" };
  rotated.top = tile.left;
  rotated.right = tile.top;
  rotated.bottom = tile.right;
  rotated.left = tile.bottom;
  rotated.middle = tile.middle;
  rotated.connections = {};
  Object.entries(tile.connections).forEach(([space, exits]) => {
    rotated.connections[mapping[space]] = exits.map((exit) => mapping[exit]);
  });
  return rotated;
}

function assertTileIntegrity(tile) {
  SPACES.forEach((space) => {
    const exits = tile.connections[space] || [];
    assert(Array.isArray(exits), `${tile.tile_number} ${space} connections must be an array`);
    assert(Boolean(tile[space]) === exits.length > 0, `${tile.tile_number} ${space} color/connection mismatch`);
    exits.forEach((exit) => {
      assert(SPACES.includes(exit), `${tile.tile_number} ${space} connects to unknown space ${exit}`);
      assert(tile[exit], `${tile.tile_number} ${space} connects to blank ${exit}`);
      const back = tile.connections[exit] || [];
      assert(back.includes(space), `${tile.tile_number} ${space}->${exit} is not reciprocal`);
    });
  });
}

function buildInitialBoard() {
  const board = new Map();
  TILE_DATA.forEach((tile) => {
    const [r, c] = tile.tile_number.split("-").map((n) => Number(n) - 1);
    board.set(key(r, c), JSON.parse(JSON.stringify(tile)));
  });
  return board;
}

function getNeighbors(board, pos) {
  const tile = board.get(key(pos.row, pos.col));
  if (!tile || !tile[pos.space]) return [];
  const neighbors = [];
  (tile.connections[pos.space] || []).forEach((space) => {
    neighbors.push({ row: pos.row, col: pos.col, space });
  });
  const side = SIDE_DELTAS[pos.space];
  if (side) {
    const [dr, dc, opposite] = side;
    const neighbor = board.get(key(pos.row + dr, pos.col + dc));
    if (neighbor && neighbor[opposite]) {
      neighbors.push({ row: pos.row + dr, col: pos.col + dc, space: opposite });
    }
  }
  return neighbors;
}

function samePos(a, b) {
  return Boolean(a && b && a.row === b.row && a.col === b.col && a.space === b.space);
}

function getCommittedContinuations(board, prev, pos) {
  if (!prev || !pos) return getNeighbors(board, pos);
  return getNeighbors(board, pos).filter((candidate) => !samePos(candidate, prev));
}

function findCommittedPaths(board, start, steps, finish, initialPrev = null, initialCommitted = false) {
  const paths = [];
  function dfs(prev, pos, remaining, path, committed) {
    if (remaining === 0) {
      paths.push([...path, pos]);
      return;
    }
    if (samePos(pos, finish)) return;
    const neighbors = committed ? getCommittedContinuations(board, prev, pos) : getNeighbors(board, pos);
    neighbors.forEach((next) => dfs(pos, next, remaining - 1, [...path, pos], true));
  }
  dfs(initialPrev, start, steps, [], initialCommitted);
  return paths;
}

function shortestPathLength(board, start, finish) {
  const queue = [{ pos: start, steps: 0 }];
  const seen = new Set([posKey(start)]);
  while (queue.length) {
    const { pos, steps } = queue.shift();
    if (pos.row === finish.row && pos.col === finish.col && pos.space === finish.space) return steps;
    getNeighbors(board, pos).forEach((next) => {
      const id = posKey(next);
      if (!seen.has(id)) {
        seen.add(id);
        queue.push({ pos: next, steps: steps + 1 });
      }
    });
  }
  return Infinity;
}

assert(TILE_DATA.length === 36, `Expected 36 tiles, found ${TILE_DATA.length}`);

const numbers = new Set(TILE_DATA.map((tile) => tile.tile_number));
for (let row = 1; row <= 6; row += 1) {
  for (let col = 1; col <= 6; col += 1) {
    assert(numbers.has(`${row}-${col}`), `Missing tile ${row}-${col}`);
  }
}

TILE_DATA.forEach((tile) => {
  assertTileIntegrity(tile);
  let rotated = tile;
  for (let i = 0; i < 3; i += 1) {
    rotated = rotateTile(rotated);
    assertTileIntegrity(rotated);
  }
});

const board = buildInitialBoard();
const startDistance = shortestPathLength(board, { row: 0, col: 0, space: "top" }, { row: 2, col: 3, space: "middle" });
assert(Number.isFinite(startDistance), "Initial board has no connected route from 1-1 start to Hey Culligan Man");

const finishTile = TILE_DATA.find((tile) => tile.tile_number === "3-4");
assert(finishTile.middle === "N", "3-4 middle must be the Hey Culligan Man finish space");
assert(finishTile.top === "" && finishTile.left === "" && finishTile.right === "" && finishTile.bottom === "N", "3-4 should be a dead-end tile in its default orientation");
assert(
  JSON.stringify(finishTile.connections) === JSON.stringify({ middle: ["bottom"], bottom: ["middle"] }),
  "3-4 should connect only between bottom and middle",
);
assert(
  /pos\.space\s*!==\s*["']middle["']/.test(source),
  "Finish detection must require the middle space, not just the 3-4 tile",
);
const finishEntryPrev = { row: 3, col: 3, space: "top" };
const finishEntry = { row: 2, col: 3, space: "bottom" };
const exactFinishPaths = findCommittedPaths(board, finishEntry, 1, { row: 2, col: 3, space: "middle" }, finishEntryPrev, true);
assert(exactFinishPaths.length === 1 && samePos(exactFinishPaths[0][1], { row: 2, col: 3, space: "middle" }), "Exact movement onto Hey Culligan Man should be legal");
const runThroughFinishPaths = findCommittedPaths(board, finishEntry, 2, { row: 2, col: 3, space: "middle" }, finishEntryPrev, true);
assert(runThroughFinishPaths.length === 0, "Movement paths must not run through Hey Culligan Man");

const softTile = TILE_DATA.find((tile) => tile.tile_number === "2-5");
["left", "middle", "bottom"].forEach((space) => {
  assert(softTile[space] === "S", `2-5 ${space} should be Soft Water`);
});

console.log(`Sanity checks passed: 36 tiles, reciprocal pipe data, rotations, rotated hitboxes, one-shot soft turns, finish terminal behavior, and initial route (${startDistance} steps).`);
