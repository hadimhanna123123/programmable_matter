// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Munkres } from 'munkres-js';
import {
  Box,
  Drawer,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  Paper,
  Stack
} from '@mui/material';

const GRID_SIZE = 10;
const SIMULATION_STEPS = 20;
const CELL_SIZE = 40;
const DRAWER_WIDTH = 260;
const UNREACHABLE_COST = 100000;

// Shape generators
const generateRectangle = (n = GRID_SIZE) => {
  const cx = Math.floor(n / 2), cy = Math.floor(n / 2);
  const out = [];
  for (let dx = -2; dx < 2; dx++) {
    for (let dy = -2; dy < 3; dy++) {
      out.push({ x: cx + dx, y: cy + dy });
    }
  }
  return out;
};
const generateDiamond = (n = GRID_SIZE) => {
  const cx = Math.floor(n / 2), cy = Math.floor(n / 2);
  const offs = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-2, 0], [2, 0], [0, -2], [0, 2],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
    [-2, -1], [-2, 1], [2, -1], [2, 1],
    [-1, -2], [-1, 2], [1, -2], [1, 2],
  ];
  return offs
    .map(([dx, dy]) => ({ x: cx + dx, y: cy + dy }))
    .filter(p => p.x >= 0 && p.x < n && p.y >= 0 && p.y < n);
};

// A* + Hungarian helpers
const heuristic = (p, g) => Math.abs(p.x - g.x) + Math.abs(p.y - g.y);
// include wait-in-place move
const neighbors = ({ x, y }) => [
  { x, y },
  { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 },
  { x: x + 1, y: y + 1 }, { x: x - 1, y: y - 1 },
  { x: x + 1, y: y - 1 }, { x: x - 1, y: y + 1 },
];
const within = (p, n = GRID_SIZE) => p.x >= 0 && p.x < n && p.y >= 0 && p.y < n;

function planPath(start, goal, t0, barriers, occupied) {
  const open = [{ pos: start, t: t0, g: 0, h: heuristic(start, goal), parent: null }];
  open[0].f = open[0].g + open[0].h;
  const closed = new Map();
  closed.set(`${start.x},${start.y},${t0}`, open[0]);

  while (open.length) {
    let iMin = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[iMin].f) iMin = i;
    }
    const cur = open.splice(iMin, 1)[0];
    if (cur.pos.x === goal.x && cur.pos.y === goal.y) {
      const path = [];
      let node = cur;
      while (node) {
        path.unshift({ pos: node.pos, t: node.t });
        node = node.parent;
      }
      return path;
    }
    const nt = cur.t + 1;
    for (const nb of neighbors(cur.pos)) {
      if (!within(nb)) continue;
      if (barriers.has(`${nb.x},${nb.y}`)) continue;
      if (occupied.has(`${nb.x},${nb.y},${nt}`)) continue;
      const g2 = cur.g + 1;
      const key = `${nb.x},${nb.y},${nt}`;
      const ex = closed.get(key);
      if (!ex || g2 < ex.g) {
        const node = { pos: nb, t: nt, g: g2, h: heuristic(nb, goal), parent: cur };
        node.f = node.g + node.h;
        open.push(node);
        closed.set(key, node);
      }
    }
  }
  return null;
}

function hungarianAssignment(agents, cells, barriers) {
  const costMatrix = cells.map(c =>
    agents.map(a => {
      const path = planPath(
        { x: a.x, y: a.y },
        { x: c.x, y: c.y },
        0,
        barriers,
        new Set()
      );
      return path ? path.length - 1 : UNREACHABLE_COST;
    })
  );
  const m = new Munkres();
  const assignments = m.compute(costMatrix);
  return assignments.reduce((map, [r, c]) => {
    map[agents[c].id] = cells[r];
    return map;
  }, {});
}

export default function AStarAlgo() {
  // modes & data
  const [shapeType, setShapeType] = useState('diamond');
  const [customShapeMode, setCustomShapeMode] = useState(false);
  const [customShapeCells, setCustomShapeCells] = useState([]);
  const [barrierMode, setBarrierMode] = useState(false);
  const [agentMode, setAgentMode] = useState('none');
  const [barriers, setBarriers] = useState(new Set());
  const [customAgents, setCustomAgents] = useState([]);
  const nextAgentId = useRef(0);

  // final shape
  const [shapeCells, setShapeCells] = useState([]);

  // simulation state
  const [agents, setAgents] = useState([]);
  const [iter, setIter] = useState(0);
  const [history, setHistory] = useState([]);
  const reservationRef = useRef(new Set());
  const intervalRef = useRef(null);
  const iterRef = useRef(iter);
  const historyRef = useRef(history);
  const stallCountRef = useRef(0);

  // keep refs in sync
  useEffect(() => { iterRef.current = iter; }, [iter]);
  useEffect(() => { historyRef.current = history; }, [history]);

  // initialize agent pool
  useEffect(() => {
    const defs = [];
    let id = 0;
    [1, 0].forEach(pyY => {
      const y = GRID_SIZE - 1 - pyY;
      for (let x = 0; x < GRID_SIZE; x++) {
        defs.push({ x, y, id });
        id++;
      }
    });
    setCustomAgents(defs);
    nextAgentId.current = defs.length;
  }, []);

  // planning & replanning
  const replan = (starts) => {
    const list = starts.map(a => ({ x: a.x, y: a.y, id: a.id, dest: null, path: [] }));
    const assignMap = hungarianAssignment(list, shapeCells, barriers);
    const occ = new Set();
    list.forEach(a => occ.add(`${a.x},${a.y},0`));

    list.forEach(a => {
      a.dest = assignMap[a.id];
      let raw = planPath({ x: a.x, y: a.y }, a.dest, 0, barriers, occ);
      if (!raw) {
        raw = planPath({ x: a.x, y: a.y }, a.dest, 0, barriers, new Set());
      }
      if (!raw) {
        raw = [
          { pos: { x: a.x, y: a.y }, t: 0 },
          { pos: { x: a.x, y: a.y }, t: 1 }
        ];
      }
      a.path = raw.map(s => s.pos);
      raw.forEach(s => occ.add(`${s.pos.x},${s.pos.y},${s.t}`));
      const last = raw[raw.length - 1];
      for (let t = last.t + 1; t <= SIMULATION_STEPS; t++) {
        occ.add(`${last.pos.x},${last.pos.y},${t}`);
        a.path.push({ x: last.pos.x, y: last.pos.y });
      }
    });

    reservationRef.current = occ;
    setAgents(list);
    setIter(0);
    setHistory([ list.map(a => ({ x: a.x, y: a.y })) ]);
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  // auto-replan on barrier/shape change
  useEffect(() => {
    if (!shapeCells.length) return;
    const starts = agents.length ? agents : customAgents;
    replan(starts);
  }, [customAgents, shapeCells, barriers]);

  // update final shape
  useEffect(() => {
    if (shapeType === 'diamond' || shapeType === 'rectangle') {
      const raw = shapeType === 'diamond'
        ? generateDiamond(GRID_SIZE)
        : generateRectangle(GRID_SIZE);
      setShapeCells(
        raw.map(p => ({ x: p.x, y: GRID_SIZE - 1 - p.y }))
           .sort((a, b) => a.x - b.x || a.y - b.y)
      );
    } else if (shapeType === 'custom' && !customShapeMode) {
      setShapeCells(
        customShapeCells.slice()
          .sort((a, b) => a.x - b.x || a.y - b.y)
      );
    }
  }, [shapeType, customShapeMode, customShapeCells]);

  // stop when all in shape
  const allInShape = agents.length > 0 && agents.every(a =>
    shapeCells.some(c => c.x === a.x && c.y === a.y)
  );
  useEffect(() => {
    if (intervalRef.current && allInShape) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [agents, allInShape]);

  // movement with stall detection & dynamic replan
  const moveTo = (step) => {
    let newAgents;
    setAgents(prev => {
      const reserved = new Set();
      newAgents = prev.map(agent => {
        const desired = step < agent.path.length
          ? agent.path[step]
          : agent.path[agent.path.length - 1];
        const key = `${desired.x},${desired.y}`;
        if (reserved.has(key)) {
          reserved.add(`${agent.x},${agent.y}`);
          return agent;
        } else {
          reserved.add(key);
          return { ...agent, x: desired.x, y: desired.y };
        }
      });
      return newAgents;
    });

    // detect stall by comparing to history
    const prevSnap = historyRef.current[iterRef.current] || [];
    const moved = newAgents.some((a, i) => {
      if (!prevSnap[i]) return true;
      return a.x !== prevSnap[i].x || a.y !== prevSnap[i].y;
    });

    if (!moved) {
      stallCountRef.current++;
      if (stallCountRef.current >= 1) {
        // stuck -> replan from current positions
        replan(newAgents);
        stallCountRef.current = 0;
        // if we were auto-running, restart
        if (!intervalRef.current) handleRun();
        return;
      }
    } else {
      stallCountRef.current = 0;
    }

    // normal history & iter update
    setHistory(h => [...h, newAgents.map(a => ({ x: a.x, y: a.y }))]);
    setIter(step);
  };

  const handleNext = () => {
    if (!allInShape) moveTo(Math.min(iter + 1, SIMULATION_STEPS));
  };
  const handleBack = () => {
    if (iter === 0) return;
    const ni = iter - 1, snap = history[ni];
    setAgents(prev => prev.map((a, i) => ({
      ...a, x: snap[i].x, y: snap[i].y
    })));
    setIter(ni);
  };
  const handleRun = () => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      const curr = iterRef.current;
      if (curr < SIMULATION_STEPS && !allInShape) {
        moveTo(curr + 1);
      } else {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 500);
  };
  const handleStop = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  // reset everything
  const handleReset = () => {
    setBarriers(new Set());
    setBarrierMode(false);
    setAgentMode('none');
    setShapeType('diamond');
    setCustomShapeMode(false);
    setCustomShapeCells([]);
    const defs = [];
    let id = 0;
    [1, 0].forEach(pyY => {
      const y = GRID_SIZE - 1 - pyY;
      for (let x = 0; x < GRID_SIZE; x++) {
        defs.push({ x, y, id });
        id++;
      }
    });
    setCustomAgents(defs);
    nextAgentId.current = defs.length;
  };

  const locked = barrierMode || agentMode !== 'none' || customShapeMode;

  return (
    <Box sx={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            p: 3,
            backgroundColor: '#37474f',
            color: '#eceff1',
            border: 'none'
          }
        }}
      >
        <Typography variant="h5" gutterBottom>Controls</Typography>
        <Stack spacing={2}>
          {/* Shape selector */}
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: '#eceff1' }}>Shape</InputLabel>
            <Select
              value={shapeType}
              onChange={e => {
                const v = e.target.value;
                setShapeType(v);
                setCustomShapeMode(v === 'custom');
                if (v === 'custom') setCustomShapeCells([]);
              }}
              disabled={locked}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#90a4ae' },
                '& .MuiSvgIcon-root': { color: '#eceff1' },
                color: '#eceff1'
              }}
            >
              <MenuItem value="diamond">Diamond</MenuItem>
              <MenuItem value="rectangle">Rectangle</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>

          {/* Custom finish/reset */}
          {customShapeMode && (
            <>
              <Button
                fullWidth size="small"
                variant="contained"
                onClick={() => setCustomShapeMode(false)}
                disabled={customShapeCells.length < 20}
                sx={{
                  backgroundColor: '#26a69a',
                  '&:disabled': { backgroundColor: '#80cbc4' }
                }}
              >Finish Custom</Button>
              <Button
                fullWidth size="small"
                variant="outlined"
                onClick={() => setCustomShapeCells([])}
                sx={{ borderColor: '#90a4ae', color: '#eceff1' }}
              >Reset Custom</Button>
            </>
          )}

          {/* Barriers / Add / Remove */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button
              sx={{ flex: 1 }}
              variant={barrierMode ? 'contained' : 'outlined'}
              onClick={() => {
                setBarrierMode(!barrierMode);
                if (!barrierMode) setAgentMode('none');
              }}
              disabled={agentMode !== 'none' || customShapeMode}
              color={barrierMode ? 'success' : 'inherit'}
            >Barriers</Button>
            <Button
              sx={{ flex: 1 }}
              variant={agentMode === 'add' ? 'contained' : 'outlined'}
              onClick={() => {
                setAgentMode(agentMode === 'add' ? 'none' : 'add');
                setBarrierMode(false);
              }}
              disabled={barrierMode || customAgents.length >= 20 || customShapeMode}
              color={agentMode === 'add' ? 'success' : 'inherit'}
            >Add</Button>
            <Button
              sx={{ flex: 1 }}
              variant={agentMode === 'remove' ? 'contained' : 'outlined'}
              onClick={() => {
                setAgentMode(agentMode === 'remove' ? 'none' : 'remove');
                setBarrierMode(false);
              }}
              disabled={barrierMode || customAgents.length === 0 || customShapeMode}
              color={agentMode === 'remove' ? 'success' : 'inherit'}
            >Remove</Button>
          </Box>

          {/* Simulation */}
          <Typography variant="subtitle1" sx={{ mt: 2, color: '#eceff1' }}>
            Simulation
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              sx={{ flex: 1 }} variant="contained" size="small"
              onClick={handleBack} disabled={locked || iter === 0}
            >Back</Button>
            <Button
              sx={{ flex: 1 }} variant="contained" size="small"
              onClick={handleNext} disabled={locked || allInShape}
            >Next</Button>
            <Button
              sx={{ flex: 1 }} variant="contained" size="small"
              onClick={handleRun} disabled={locked || allInShape}
            >Run</Button>
            <Button
              sx={{ flex: 1 }} variant="contained" size="small"
              onClick={handleStop} disabled={locked}
            >Stop</Button>
          </Box>

          {/* Reset */}
          <Button
            fullWidth size="small"
            variant="outlined"
            onClick={handleReset}
            disabled={locked}
            sx={{ mt: 1, borderColor: '#90a4ae', color: '#eceff1' }}
          >Reset</Button>
        </Stack>
      </Drawer>

      {/* Main area */}
      <Box component="main" sx={{
        flexGrow: 1,
        position: 'relative',
        p: 3,
        backgroundColor: '#e0f7fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Stats bubble */}
        <Box sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          backgroundColor: '#fff',
          p: 2,
          borderRadius: 2,
          boxShadow: '0px 2px 6px rgba(0,0,0,0.2)'
        }}>
          <Typography variant="body2" align="right">Step: <strong>{iter}</strong></Typography>
          <Typography variant="body2" align="right">Agents: <strong>{customAgents.length}/20</strong></Typography>
          <Typography variant="body2" align="right">
            Blocks: <strong>{
              shapeType === 'custom' ? customShapeCells.length : shapeCells.length
            }/20</strong>
          </Typography>
        </Box>

        {/* Grid */}
        <Paper elevation={4} sx={{
          p: 2,
          backgroundColor: '#fff',
          borderRadius: 2,
          boxShadow: '0px 4px 10px rgba(0,0,0,0.1)'
        }}>
          <svg width={GRID_SIZE * CELL_SIZE} height={GRID_SIZE * CELL_SIZE}>
            {/* Grid lines */}
            {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
              <React.Fragment key={i}>
                <line x1={0} y1={i * CELL_SIZE}
                  x2={GRID_SIZE * CELL_SIZE} y2={i * CELL_SIZE}
                  stroke="#ccc" />
                <line x1={i * CELL_SIZE} y1={0}
                  x2={i * CELL_SIZE} y2={GRID_SIZE * CELL_SIZE}
                  stroke="#ccc" />
              </React.Fragment>
            ))}

            {/* Interaction overlay */}
            {Array.from({ length: GRID_SIZE }).flatMap((_, y) =>
              Array.from({ length: GRID_SIZE }).map((_, x) => {
                const key = `${x},${y}`;
                return (
                  <rect
                    key={key}
                    x={x * CELL_SIZE} y={y * CELL_SIZE}
                    width={CELL_SIZE} height={CELL_SIZE}
                    fill="transparent"
                    onClick={() => {
                      if (barrierMode) {
                        if (shapeCells.some(c => c.x === x && c.y === y)) return;
                        if (customAgents.some(a => a.x === x && a.y === y)) return;
                        setBarriers(prev => {
                          const next = new Set(prev);
                          next.has(key) ? next.delete(key) : next.add(key);
                          return next;
                        });
                      } else if (agentMode === 'add') {
                        if (customAgents.length >= 20) return;
                        if (shapeCells.some(c => c.x === x && c.y === y)) return;
                        if (barriers.has(key)) return;
                        if (customAgents.some(a => a.x === x && a.y === y)) return;
                        setCustomAgents(prev => [
                          ...prev, { x, y, id: nextAgentId.current++ }
                        ]);
                      } else if (agentMode === 'remove') {
                        setCustomAgents(prev =>
                          prev.filter(a => !(a.x === x && a.y === y))
                        );
                      } else if (customShapeMode) {
                        if (customShapeCells.some(c => c.x === x && c.y === y)) {
                          setCustomShapeCells(prev =>
                            prev.filter(c => !(c.x === x && c.y === y))
                          );
                        } else {
                          if (customShapeCells.length >= 20) return;
                          if (customAgents.some(a => a.x === x && a.y === y)) return;
                          if (barriers.has(key)) return;
                          setCustomShapeCells(prev => [...prev, { x, y }]);
                        }
                      }
                    }}
                  />
                );
              })
            )}

            {/* Preview custom shape */}
            {customShapeMode && customShapeCells.map((c, i) => (
              <rect
                key={`custom-${i}`}
                x={c.x * CELL_SIZE} y={c.y * CELL_SIZE}
                width={CELL_SIZE} height={CELL_SIZE}
                fill="#00897b" opacity={0.4}
              />
            ))}

            {/* Final shape */}
            {!customShapeMode && shapeCells.map((c, i) => (
              <rect
                key={`shape-${i}`}
                x={c.x * CELL_SIZE} y={c.y * CELL_SIZE}
                width={CELL_SIZE} height={CELL_SIZE}
                fill="#d32f2f" opacity={0.6}
              />
            ))}

            {/* Barriers */}
            {Array.from(barriers).map(str => {
              const [x, y] = str.split(',').map(Number);
              return ( 
                <rect
                  key={`barrier-${str}`}
                  x={x * CELL_SIZE} y={y * CELL_SIZE}
                  width={CELL_SIZE} height={CELL_SIZE}
                  fill="#37474f"
                />
              );
            })}

            {/* Agents */}
            {agents.map(a => (
              <React.Fragment key={a.id}>
                <circle
                  cx={a.x * CELL_SIZE + CELL_SIZE / 2}
                  cy={a.y * CELL_SIZE + CELL_SIZE / 2}
                  r={CELL_SIZE * 0.3}
                  fill="#ffab00" opacity={0.8}
                />
                <text
                  x={a.x * CELL_SIZE + CELL_SIZE / 2}
                  y={a.y * CELL_SIZE + CELL_SIZE / 2 + 4}
                  fontSize={12} textAnchor="middle" fill="#000"
                >
                  {a.id}
                </text>
              </React.Fragment>
            ))}
          </svg>
        </Paper>
      </Box>
    </Box>
  );
}
