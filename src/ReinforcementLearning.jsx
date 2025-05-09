// src/ReinforcementLearning.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import qTableJson from './q_table.json';

// derive everything from the JSON itself
const N_AGENTS = qTableJson.length;
const GRID_SIZE = qTableJson[0]?.length ?? 10;
const ACTIONS = [
  [-1,  0], [ 1,  0], [ 0, -1], [ 0,  1],
  [-1, -1], [-1,  1], [ 1, -1], [ 1,  1]
];
const CELL_SIZE = 40;

// exact starts & goals from your Python
const INITIAL_POSITIONS = [
  [8,0],[9,1],[9,2],[9,3],[9,4],
  [9,5],[9,6],[9,7],[9,8],[9,9]
];
const TARGETS = [
  [4,4],[4,5],[5,4],[5,5],
  [4,3],[4,6],[5,3],[5,6],
  [3,4],[6,5]
];
// no static obstacles
const OBSTACLES = [];

export default function ReinforcementLearning() {
  const [agents, setAgents] = useState([]);
  const [step, setStep]     = useState(0);
  const intervalRef         = useRef(null);

  // init agents once
  useEffect(() => {
    const init = INITIAL_POSITIONS.map((pos,i) => ({
      id: i, row: pos[0], col: pos[1]
    }));
    setAgents(init);
    return () => clearInterval(intervalRef.current);
  }, []);

const nextStep = () => {
  console.groupCollapsed(`→ nextStep (Step ${step})`);

  // 1) PROPOSAL PHASE
  const proposals = agents.map(a => {
    const { id, row, col } = a;
    const [tr, tc] = TARGETS[id];
    
    if (row === tr && col === tc) {
      console.log(` Agent ${id} @ (${row},${col}) → finished, stays`);
      return { ...a, proposal: { row, col }, action: null };
    }

    // fetch Q-values
    const qVals = qTableJson[id]?.[row]?.[col] || [];
    if (qVals.length !== ACTIONS.length) {
      console.error(` Agent ${id} @ (${row},${col}) → bad qVals.length=${qVals.length}`);
      return { ...a, proposal: { row, col }, action: null };
    }

    // tie-break among best
    const maxQ    = Math.max(...qVals);
    const bestIDs = qVals.map((v,i)=> v===maxQ?i:-1).filter(i=>i>=0);
    const actIdx  = bestIDs[Math.floor(Math.random()*bestIDs.length)];
    const [dr, dc] = ACTIONS[actIdx];

    const nr = row + dr, nc = col + dc;
    console.log(` Agent ${id} @ (${row},${col}) picks action ${actIdx}→(${dr},${dc}) => (${nr},${nc})`);

    return { ...a, proposal: { row: nr, col: nc }, action: actIdx };
  });

  // 2) COLLISION + FINISHED BLOCKING
  const countMap = {};
  agents.forEach(a => {
    // finished agents occupy their goal permanently
    const [tr, tc] = TARGETS[a.id];
    if (a.row===tr && a.col===tc) {
      countMap[`${tr},${tc}`] = Infinity;
    }
  });
  proposals.forEach(p => {
    const key = `${p.proposal.row},${p.proposal.col}`;
    countMap[key] = (countMap[key]||0) + (p.action!==null ? 1 : 0);
  });

  // 3) APPLY PHASE
  const nextAgents = proposals.map(p => {
    const { id, row, col, proposal, action } = p;
    if (action === null) return { id, row, col };

    const key = `${proposal.row},${proposal.col}`;
    const valid = (
      proposal.row >= 0 && proposal.row < GRID_SIZE &&
      proposal.col >= 0 && proposal.col < GRID_SIZE &&
      countMap[key] === 1  // no collision, not occupied by finished agent
    );

    console.log(`  → Agent ${id}: collision?${countMap[key]>1}, valid?${valid}`);
    return valid
      ? { id, row: proposal.row, col: proposal.col }
      : { id, row, col };
  });

  setAgents(nextAgents);
  setStep(s => s + 1);
  console.groupEnd();
};


  const run = () => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(nextStep, 300);
  };
  const stop = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };
  const reset = () => {
    stop();
    setAgents(INITIAL_POSITIONS.map((pos,i) => ({
      id: i, row: pos[0], col: pos[1]
    })));
    setStep(0);
  };

  return (
    <Box sx={{ p:2 }}>
      <Typography variant="h6" gutterBottom>
        Q-Learning (10×10, 10 agents)
      </Typography>

      <Paper sx={{ display:'inline-block', p:1, backgroundColor:'#fafafa' }}>
        <svg width={GRID_SIZE*CELL_SIZE} height={GRID_SIZE*CELL_SIZE}>
          {/* grid */}
          {Array.from({length:GRID_SIZE+1}).map((_,i)=>(
            <React.Fragment key={i}>
              <line x1={0} y1={i*CELL_SIZE}
                    x2={GRID_SIZE*CELL_SIZE} y2={i*CELL_SIZE}
                    stroke="#ccc" />
              <line x1={i*CELL_SIZE} y1={0}
                    x2={i*CELL_SIZE} y2={GRID_SIZE*CELL_SIZE}
                    stroke="#ccc" />
            </React.Fragment>
          ))}
          {/* targets */}
          {TARGETS.map(([r,c],i)=>(
            <rect key={i}
                  x={c*CELL_SIZE} y={r*CELL_SIZE}
                  width={CELL_SIZE} height={CELL_SIZE}
                  fill="#4caf50" opacity={0.6} />
          ))}
          {/* agents */}
          {agents.map(a=>(
            <circle key={a.id}
                    cx={a.col*CELL_SIZE + CELL_SIZE/2}
                    cy={a.row*CELL_SIZE + CELL_SIZE/2}
                    r={CELL_SIZE*0.3} fill="#ff5722" />
          ))}
        </svg>
      </Paper>

      <Stack direction="row" spacing={1} sx={{ mt:2 }}>
        <Button onClick={nextStep}>Next</Button>
        <Button onClick={run}>Run</Button>
        <Button onClick={stop}>Stop</Button>
        <Button onClick={reset}>Reset</Button>
      </Stack>

      <Typography sx={{ mt:1 }}>Step: {step}</Typography>
    </Box>
  );
}
