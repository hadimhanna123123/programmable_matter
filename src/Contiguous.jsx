// ────────────────────────────────────────────────────────────────
//  src/Contiguous.jsx
//  Interactive playground – Parallel Peeling demo
// ────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Drawer, FormControl, InputLabel, Select, MenuItem,
  Button, Typography, Stack
} from '@mui/material';

import {
  findHead,
  astarPath,
  peelingTick
} from './ContiguousUtils';
import { buildAdjacencyChain } from './snakeUtils';

const GRID_SIZE      = 10;
const CELL_SIZE      = 40;
const DRAWER_WIDTH   = 260;

/*------------------------- shape helpers ------------------------*/
const generateRectangle = (n = GRID_SIZE) => {
  const cx = Math.floor(n / 2), cy = Math.floor(n / 2);
  const out = [];
  for (let dx = -2; dx < 2; dx++)
    for (let dy = -2; dy < 3; dy++) out.push({ x: cx + dx, y: cy + dy });
  return out;
};
const generateDiamond = (n = GRID_SIZE) => {
  const cx = Math.floor(n / 2), cy = Math.floor(n / 2);
  const offs = [
    [-1,0],[1,0],[0,-1],[0,1],[-2,0],[2,0],[0,-2],[0,2],
    [-1,-1],[-1,1],[1,-1],[1,1],[-2,-1],[-2,1],[2,-1],[2,1],
    [-1,-2],[-1,2],[1,-2],[1,2]
  ];
  return offs
    .map(([dx,dy]) => ({ x: cx + dx, y: cy + dy }))
    .filter(p => p.x >= 0 && p.x < n && p.y >= 0 && p.y < n);
};

export default function ContiguousPage() {
  /*--------------------- local UI state ----------------------*/
  const [shapeType, setShapeType]         = useState('diamond');
  const [customShapeMode, setCustomShape] = useState(false);
  const [customShapeCells, setShapeCells] = useState([]);
  const [barrierMode, setBarrierMode]     = useState(false);
  const [agentMode, setAgentMode]         = useState('none');  // 'none' | 'add' | 'remove'

  const [barriers, setBarriers]           = useState(new Set());
  const [customAgents, setCustomAgents]   = useState([]);
  const nextAgentId = useRef(0);

  const [destCells, setDestCells]         = useState([]);
  const [history, setHistory]             = useState([]);
  const [iter, setIter]                   = useState(0);

  /*---------------- initial snake (two bottom rows) ----------*/
  useEffect(() => {
    const defs = [];
    let id = 0;
    [1,0].forEach(row => {
      const y = GRID_SIZE - 1 - row;
      for (let x = 0; x < GRID_SIZE; x++) defs.push({ x, y, id: id++ });
    });
    setCustomAgents(defs);
    nextAgentId.current = defs.length;
  }, []);

  /*---------------- recompute destination shape --------------*/
  useEffect(() => {
    let cells = [];
    if (shapeType === 'custom') cells = [...customShapeCells];
    else if (shapeType === 'diamond') cells = generateDiamond(GRID_SIZE);
    else cells = generateRectangle(GRID_SIZE);
    setDestCells(cells);
  }, [shapeType, customShapeMode, customShapeCells]);

  /*--------------------- grid click handler ------------------*/
  const handleGridClick = (x, y) => {
    const key = `${x},${y}`;
    if (customShapeMode) {
      setShapeCells(prev =>
        prev.some(p => p.x === x && p.y === y)
          ? prev.filter(p => !(p.x === x && p.y === y))
          : [...prev, { x, y }]
      );
      setShapeType('custom');
    } else if (barrierMode) {
      setBarriers(prev => {
        const nxt = new Set(prev);
        nxt.has(key) ? nxt.delete(key) : nxt.add(key);
        return nxt;
      });
    } else if (agentMode === 'add') {
      setCustomAgents(prev => [...prev, { x, y, id: nextAgentId.current++ }]);
    } else if (agentMode === 'remove') {
      setCustomAgents(prev => prev.filter(a => !(a.x === x && a.y === y)));
    }
  };

  /*--------------------- reset everything --------------------*/
  const handleReset = () => {
    setBarriers(new Set());
    setBarrierMode(false);
    setAgentMode('none');
    setShapeType('diamond');
    setCustomShape(false);
    setShapeCells([]);

    const defs = [];
    let id = 0;
    [1,0].forEach(row => {
      const y = GRID_SIZE - 1 - row;
      for (let x = 0; x < GRID_SIZE; x++) defs.push({ x, y, id: id++ });
    });
    setCustomAgents(defs);
    nextAgentId.current = defs.length;
    setHistory([]);
    setIter(0);
  };

  /*--------------------- PARALLEL PEELING --------------------*/
  const handleParallelPeeling = () => {
    const head0 = findHead(customAgents, destCells, barriers, GRID_SIZE);
    if (!head0) { alert('No reachable head'); return; }

    /* choose α = closest reachable destination to initial head */
    let alpha = null, bestLen = Infinity;
    for (const d of destCells) {
      const p = astarPath({ x: head0.x, y: head0.y }, d, barriers, GRID_SIZE);
      if (p && p.length < bestLen) { bestLen = p.length; alpha = d; }
    }
    if (!alpha) { alert('α unreachable'); return; }

    /* build initial peeling state */
    const positions = new Map(customAgents.map(a => [a.id, [a.x, a.y]]));
    const chain     = buildAdjacencyChain(positions, head0.id, alpha);
    const freeDest  = new Set(destCells.map(c => `${c.x},${c.y}`));
    freeDest.delete(`${alpha.x},${alpha.y}`);

    let state = { positions, chain, peeled: new Map(), alpha, freeDest };
    const hist = [];

    for (let tick = 0; tick < 500; tick++) {
      hist.push(Array.from(state.positions, ([id,[x,y]]) => ({ id, x, y })));

      const done =
        state.freeDest.size === 0 &&
        [...state.peeled.values()].every(p => p.idx === p.path.length - 1) &&
        state.chain.length === 0;

      if (done) break;
      state = peelingTick(state, barriers, GRID_SIZE);
    }

    setHistory(hist);
    setIter(0);
    setCustomAgents(hist[0] || []);
  };

  /*---------------------- navigation helpers -----------------*/
  const handleNext = () => {
    if (iter < history.length - 1) {
      const ni = iter + 1;
      setIter(ni);
      setCustomAgents(history[ni]);
    }
  };
  const handleBack = () => {
    if (iter > 0) {
      const pi = iter - 1;
      setIter(pi);
      setCustomAgents(history[pi]);
    }
  };

  /*========================  RENDER  =========================*/
  return (
    <Box sx={{ display: 'flex' }}>
      {/*────────────── sidebar controls ──────────────*/}
      <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH }} open>
        <Stack spacing={2} m={2}>

          <FormControl fullWidth>
            <InputLabel>Shape</InputLabel>
            <Select
              value={shapeType}
              onChange={e => setShapeType(e.target.value)}
              disabled={barrierMode || agentMode !== 'none' || customShapeMode}
            >
              <MenuItem value="diamond">Diamond</MenuItem>
              <MenuItem value="rectangle">Rectangle</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant={customShapeMode ? 'contained' : 'outlined'}
            onClick={() => { setCustomShape(!customShapeMode); if (!customShapeMode) setShapeType('custom'); }}
            disabled={barrierMode || agentMode !== 'none'}
          >
            {customShapeMode ? 'Finish Custom Shape' : 'Custom Shape'}
          </Button>

          <Button
            variant={barrierMode ? 'contained' : 'outlined'}
            onClick={() => { setBarrierMode(!barrierMode); if (!barrierMode) setAgentMode('none'); }}
            disabled={agentMode !== 'none' || customShapeMode}
          >
            {barrierMode ? 'Finish Barriers' : 'Add Barriers'}
          </Button>

          <Button
            variant={agentMode === 'add' ? 'contained' : 'outlined'}
            onClick={() => { setAgentMode(agentMode === 'add' ? 'none' : 'add'); setBarrierMode(false); }}
            disabled={barriers.size >= GRID_SIZE * GRID_SIZE || customShapeMode}
          >
            {agentMode === 'add' ? 'Finish Adding' : 'Add Agent'}
          </Button>

          <Button
            variant={agentMode === 'remove' ? 'contained' : 'outlined'}
            onClick={() => { setAgentMode(agentMode === 'remove' ? 'none' : 'remove'); setBarrierMode(false); }}
            disabled={customShapeMode}
          >
            {agentMode === 'remove' ? 'Finish Removing' : 'Remove Agent'}
          </Button>

          <Button variant="outlined" onClick={handleReset}>Reset All</Button>
          <Button variant="contained" onClick={handleParallelPeeling}>Parallel Peeling</Button>
          <Button variant="outlined" onClick={handleBack} disabled={iter === 0}>Back</Button>
          <Button variant="outlined" onClick={handleNext} disabled={iter >= history.length - 1}>Next</Button>
        </Stack>
      </Drawer>

      {/*────────────── main canvas ──────────────*/}
      <Box component="main" sx={{ flexGrow: 1, p: 2 }}>
        <svg width={GRID_SIZE * CELL_SIZE} height={GRID_SIZE * CELL_SIZE}>
          {/* background grid */}
          {Array.from({ length: GRID_SIZE }).map((_, r) =>
            Array.from({ length: GRID_SIZE }).map((__, c) => (
              <rect key={`${c},${r}`}
                x={c * CELL_SIZE} y={r * CELL_SIZE}
                width={CELL_SIZE - 1} height={CELL_SIZE - 1}
                fill="#fff" stroke="#ccc"
                onClick={() => handleGridClick(c, r)}
              />
            ))
          )}

          {/* destination shape */}
          {destCells.map((d, i) => (
            <rect key={`dest-${i}`}
              x={d.x * CELL_SIZE} y={d.y * CELL_SIZE}
              width={CELL_SIZE} height={CELL_SIZE}
              fill="#d32f2f" opacity={0.35}
            />
          ))}

          {/* barriers */}
          {[...barriers].map((s, i) => {
            const [x, y] = s.split(',').map(Number);
            return (
              <rect key={`bar-${i}`}
                x={x * CELL_SIZE} y={y * CELL_SIZE}
                width={CELL_SIZE} height={CELL_SIZE}
                fill="#000" opacity={0.6}
              />
            );
          })}

          {/* agents */}
          {customAgents.map(a => (
            <React.Fragment key={a.id}>
              <circle
                cx={a.x * CELL_SIZE + CELL_SIZE / 2}
                cy={a.y * CELL_SIZE + CELL_SIZE / 2}
                r={CELL_SIZE * 0.3}
                fill="#1976d2"
              />
              <text
                x={a.x * CELL_SIZE + CELL_SIZE / 2}
                y={a.y * CELL_SIZE + CELL_SIZE / 2 + 4}
                fontSize={12}
                textAnchor="middle"
                fill="#fff"
              >
                {a.id}
              </text>
            </React.Fragment>
          ))}
        </svg>
      </Box>
    </Box>
  );
}