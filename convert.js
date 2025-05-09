// convertQTable.js
// (requires your package.json to have "type": "module")
// Usage: npm install xlsx && node convertQTable.js

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// CONFIGURATION
const INPUT_FILE  = path.join(__dirname, 'q_table_multi_agents.xlsx');
const OUTPUT_FILE = path.join(__dirname, 'src', 'q_table.json');
const GRID_SIZE   = 10;
const N_ACTIONS   = 8;  // Up,Down,Left,Right,Up-Left,Up-Right,Down-Left,Down-Right

// read workbook
const wb = XLSX.readFile(INPUT_FILE);
const allAgents = [];

for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  // read rows, skipping Excel header row 0
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: [
      'Up','Down','Left','Right',
      'Up-Left','Up-Right','Down-Left','Down-Right'
    ],
    range: 1,       // skip the very first row
    defval: 0
  });

  // initialize empty 10×10×8 array
  const table = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () =>
      Array(N_ACTIONS).fill(0)
    )
  );

  // fill in row by row (max 100 rows)
  rows.slice(0, GRID_SIZE*GRID_SIZE).forEach((r, idx) => {
    const y = Math.floor(idx / GRID_SIZE);
    const x = idx % GRID_SIZE;
    table[y][x] = [
      r['Up'], r['Down'], r['Left'], r['Right'],
      r['Up-Left'], r['Up-Right'], r['Down-Left'], r['Down-Right']
    ];
  });

  allAgents.push(table);
}

// ensure output folder and write JSON
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allAgents, null, 2), 'utf8');
console.log(`✅ Wrote JSON to ${OUTPUT_FILE}`);
