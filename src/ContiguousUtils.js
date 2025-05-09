// ────────────────────────────────────────────────────────────────
//  src/ContiguousUtils.js
//  Parallel-Peeling Engine  •  v7-euclid-reach-locked-cascade-fixed
//
//  – Euclidean A* everywhere
//  – Furthest-reachable booking for each peeled head
//  – Re-booking when a goal becomes unreachable
//  – Push-inside cascade can traverse any non-barrier square
//  – Once an agent parks on its destination, it is removed from
//    `peeled`, added to `lockedIds`, and can never move again
//  – Cascades now skip entirely if any locked agent would be pushed
//  – Exports: astarPath • findHead • peelingTick
// ────────────────────────────────────────────────────────────────

import { buildAdjacencyChain, isContiguous } from './snakeUtils';
const euclid = (a,b) => Math.hypot(a.x - b.x, a.y - b.y);

/*================================================================
  1.  A* PATHFINDER (8-connected, no diagonal corner-cuts)
================================================================*/
export function astarPath(start, goal, barriers, grid = 10) {
  const h = euclid;
  const DIRS = [
    {dx:1,dy:0},{dx:-1,dy:0},
    {dx:0,dy:1},{dx:0,dy:-1},
    {dx:1,dy:1},{dx:-1,dy:-1},
    {dx:1,dy:-1},{dx:-1,dy:1}
  ];

  const sKey = `${start.x},${start.y}`;
  const gKey = `${goal.x},${goal.y}`;
  const open = [{pos:start, g:0, h:h(start,goal), f:0, parent:null}];
  open[0].f = open[0].h;
  const closed = new Map([[sKey, open[0]]]);

  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++)
      if (open[i].f < open[best].f) best = i;

    const cur = open.splice(best, 1)[0];
    if (`${cur.pos.x},${cur.pos.y}` === gKey) {
      const path = [];
      for (let n = cur; n; n = n.parent) path.push(n.pos);
      return path.reverse();
    }

    for (const {dx,dy} of DIRS) {
      // forbid diagonal corner-cuts
      if (dx && dy &&
          (barriers.has(`${cur.pos.x+dx},${cur.pos.y}`) ||
           barriers.has(`${cur.pos.x},${cur.pos.y+dy}`)))
        continue;

      const nx = cur.pos.x + dx, ny = cur.pos.y + dy;
      if (nx<0||nx>=grid||ny<0||ny>=grid) continue;
      const k = `${nx},${ny}`;
      if (barriers.has(k)) continue;

      const g2 = cur.g + euclid(cur.pos, {x:nx,y:ny});
      const h2 = h({x:nx,y:ny}, goal);
      const f2 = g2 + h2;
      const seen = closed.get(k);
      if (seen && g2 >= seen.g) continue;

      const node = {pos:{x:nx,y:ny}, g:g2, h:h2, f:f2, parent:cur};
      open.push(node);
      closed.set(k, node);
    }
  }

  return null;
}

/*================================================================
  2.  FURTHEST-REACHABLE BOOKING
================================================================*/
function pickFurthestReachable(freeSet, alpha, fromPos, barriers, grid) {
  let best = null, bestD = -1;
  for (const k of freeSet) {
    const [x,y] = k.split(',').map(Number);
    const d = euclid({x,y}, alpha);
    if (d <= bestD) continue;
    if (astarPath(fromPos, {x,y}, barriers, grid)) {
      best = {x,y};
      bestD = d;
    }
  }
  return best;
}

/*================================================================
  3.  PUSH-INSIDE CASCADE BFS
================================================================*/
function findPushCascade(blocked, mask, occupied, barriers, lockedIds, grid) {
  const key = (x,y) => `${x},${y}`;
  const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];

  const q = [blocked];
  const prev = new Map([[key(blocked.x,blocked.y), null]]);

  while (q.length) {
    const {x,y} = q.shift();
    for (const [dx,dy] of DIRS) {
      const nx = x+dx, ny = y+dy, k = key(nx,ny);
      if (nx<0||nx>=grid||ny<0||ny>=grid) continue;
      if (barriers.has(k) || prev.has(k)) continue;

      prev.set(k, {x,y});
      if (!occupied.has(k)) {
        // we've found a free hole at k → build chain free→…→blocked
        const chain = [{x:nx, y:ny}];
        for (let p={x,y}; p; p=prev.get(key(p.x,p.y))) {
          chain.push(p);
        }

        // ABORT if any occupant along this chain is locked
        for (let i=1; i<chain.length; i++) {
          const cellKey = key(chain[i].x, chain[i].y);
          const occId = [...occupied].findIndex(t=>t===cellKey);
          if (lockedIds.has(occId)) return null;
        }

        return chain;
      }

      // occupied: skip locked agents, else enqueue
      const occId = [...occupied].findIndex(t=>t===k);
      if (!lockedIds.has(occId)) {
        q.push({x:nx, y:ny});
      }
    }
  }

  return null;
}

/*================================================================
  4.  HEAD PICKER
================================================================*/
export function findHead(agents, destinations, barriers, grid = 10) {
  let best = null, bestD = Infinity;
  const destSet = new Set(destinations.map(d=>`${d.x},${d.y}`));
  const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];

  const bfs = (sx,sy) => {
    const seen = new Set([`${sx},${sy}`]);
    const q = [{x:sx, y:sy, d:0}];
    while (q.length) {
      const {x,y,d} = q.shift();
      if (destSet.has(`${x},${y}`)) return d;
      for (const [dx,dy] of DIRS) {
        if (dx&&dy &&
            (barriers.has(`${x+dx},${y}`) ||
             barriers.has(`${x},${y+dy}`)))
          continue;
        const nx=x+dx, ny=y+dy, k=`${nx},${ny}`;
        if (nx<0||nx>=grid||ny<0||ny>=grid) continue;
        if (barriers.has(k) || seen.has(k)) continue;
        seen.add(k);
        q.push({x:nx, y:ny, d:d+1});
      }
    }
    return null;
  };

  for (const a of agents) {
    const dist = bfs(a.x, a.y);
    if (dist !== null && dist < bestD) {
      best = a;
      bestD = dist;
    }
  }
  return best;
}

/*================================================================
  5.  SINGLE-TICK PARALLEL-PEELING ENGINE
================================================================*/
export function peelingTick(prev, barriers, grid = 10) {
  // 5.0  Clone state AND persist lockedIds
  const next = {
    positions : new Map(prev.positions),
    chain     : [...prev.chain],
    peeled    : new Map(prev.peeled),
    alpha     : prev.alpha,
    freeDest  : new Set(prev.freeDest),
    lockedIds : new Set(prev.lockedIds || [])
  };

  const key = ([x,y]) => `${x},${y}`;
  const occupied = new Set([...next.positions.values()].map(key));

  // helper: re-book a peeled agent if its path fails
  const rebook = (id, here) => {
    if (next.lockedIds.has(id)) return false;
    const newDest = pickFurthestReachable(
      next.freeDest, next.alpha, {x:here[0], y:here[1]}, barriers, grid
    );
    if (!newDest) return false;
    // free old, claim new
    const old = next.peeled.get(id).dest;
    next.freeDest.add(`${old.x},${old.y}`);
    next.freeDest.delete(`${newDest.x},${newDest.y}`);
    const info = next.peeled.get(id);
    info.dest = newDest;
    info.path = astarPath({x:here[0],y:here[1]}, newDest, barriers, grid) || [newDest];
    info.idx  = 0;
    return true;
  };

  const mask = new Set([...next.freeDest, ...[...next.positions.values()].map(key)]);

  // 5.1  Move all peeled agents
  for (const [id, info] of [...next.peeled]) {
    const here = next.positions.get(id);

    // 5.1.a  Lock permanently if parked
    if (here[0] === info.dest.x && here[1] === info.dest.y) {
      next.lockedIds.add(id);
      next.peeled.delete(id);
      continue;
    }

    // 5.1.b  Ensure path exists
    const refresh = () => {
      info.path = astarPath({x:here[0],y:here[1]}, info.dest, barriers, grid) || [];
      info.idx  = 0;
    };
    if (!info.path.length) refresh();
    if (!info.path.length && !rebook(id, here)) continue;

    // 5.1.c  Check next step
    const step = () => info.idx < info.path.length - 1
      ? info.path[info.idx + 1]
      : null;
    let nxt = step();
    if (!nxt || occupied.has(key([nxt.x, nxt.y]))) {
      refresh();
      nxt = step();
    }

    // 5.1.d  Cascade if still blocked
    if (!nxt || occupied.has(key([nxt.x, nxt.y]))) {
      const start = nxt
        ? {x:nxt.x,y:nxt.y}
        : {x:info.dest.x,y:info.dest.y};
      const chain = findPushCascade(start, mask, occupied, barriers, next.lockedIds, grid);
      if (chain) {
        for (let i = chain.length - 2; i >= 0; i--) {
          const cur = chain[i], dst = chain[i+1];
          const occId = [...next.positions]
            .find(([,p]) => p[0] === cur.x && p[1] === cur.y)?.[0];
          if (occId === undefined || next.lockedIds.has(occId)) break;
          next.positions.set(occId, [dst.x, dst.y]);
          occupied.delete(key([cur.x,cur.y]));
          occupied.add(key([dst.x,dst.y]));
          if (next.peeled.has(occId)) {
            const pr = next.peeled.get(occId);
            if (pr.dest.x === cur.x && pr.dest.y === cur.y) {
              pr.dest = {x:dst.x, y:dst.y};
            }
            pr.path = astarPath({x:dst.x,y:dst.y}, pr.dest, barriers, grid) || [pr.dest];
            pr.idx  = 0;
          }
        }
        refresh();
        nxt = step();
      }
    }

    // 5.1.e  Rebook if still blocked
    if ((!nxt || occupied.has(key([nxt.x, nxt.y]))) && !rebook(id, here)) {
      continue;
    }

    // 5.1.f  Finally take one step
    if (nxt && !occupied.has(key([nxt.x, nxt.y]))) {
      next.positions.set(id, [nxt.x, nxt.y]);
      occupied.delete(key(here));
      occupied.add(key([nxt.x, nxt.y]));
      info.idx += 1;
    }
  }

  // 5.2  Move the contiguous snake & peel head
  if (next.chain.length) {
    const headId = next.chain[0];
    const [hx, hy] = next.positions.get(headId);
    const pathToAlpha = astarPath({x:hx,y:hy}, next.alpha, barriers, grid);

    // one-step movement
    if (pathToAlpha && pathToAlpha.length > 1) {
      const s = pathToAlpha[1];
      if (!occupied.has(key([s.x, s.y])) && !barriers.has(key([s.x, s.y]))) {
        const old = next.chain.map(id => next.positions.get(id));
        next.positions.set(headId, [s.x, s.y]);
        occupied.delete(key(old[old.length - 1]));
        occupied.add(key([s.x, s.y]));
        for (let i = 1; i < next.chain.length; i++) {
          next.positions.set(next.chain[i], old[i - 1]);
        }
      }
    }

    // peel off head if at α
    const [cx, cy] = next.positions.get(headId);
    if (cx === next.alpha.x && cy === next.alpha.y) {
      const dest = pickFurthestReachable(
        next.freeDest, next.alpha, {x:cx, y:cy}, barriers, grid
      );
      if (dest) next.freeDest.delete(`${dest.x},${dest.y}`);
      const headPath = dest
        ? astarPath({x:cx,y:cy}, dest, barriers, grid)
        : [{x:cx,y:cy}];
      next.peeled.set(headId, { dest: dest || {x:cx,y:cy}, path: headPath, idx: 0 });
      next.chain = next.chain.slice(1);
      if (next.chain.length) {
        const order = buildAdjacencyChain(next.positions, next.chain[0], next.alpha);
        next.chain = order;
      }
    }
  }

  // 5.3  Integrity checks
  if (next.chain.length) {
    const m = new Map(next.chain.map(id => [id, next.positions.get(id)]));
    if (!isContiguous(m)) return prev;
  }
  const seen = new Set();
  for (const [,pos] of next.positions) {
    const k = key(pos);
    if (seen.has(k)) return prev;
    seen.add(k);
  }

  return next;
}