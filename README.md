# 🧩 Programmable Matter Visualizer

Interactive React application that **simulates and visualises how collections of simple agents can rearrange themselves into target shapes**.  
It currently showcases three path‑planning approaches:

| Algorithm | Purpose | Highlights |
|-----------|---------|------------|
| **A\*** | Single‑agent shortest‑path search | Admissible heuristic, instant path preview |
| **Q‑learning (multi‑agent)** | Decentralised reinforcement learning for up to 10 agents | Pre‑trained Q‑table, step‑by‑step animation |
| **Contiguity heuristic** | Ensures the swarm stays connected while moving | Simple rules, no learning required |


---

## ✨ Features

* **One‑click algorithm switch** – explore A\*, RL, or the contiguity heuristic from the home screen.  
* **Real‑time visualisation** – each grid update is rendered with [MUI](https://mui.com/) components.  
* **Python 🡒 JS pipeline** – train a Q‑table in Python (`PathfindingMain.py`), convert it to JSON (`convert.js`), and feed the React front‑end.  
* **Zero‑backend** – everything runs locally in the browser after build.  
* **MIT‑licensed** – free for personal, academic, or commercial use.

---

## 🗂 Directory Overview

programmable‑matter‑main/
├── src/ # React code + assets
│ ├── AStarAlgo.jsx
│ ├── ReinforcementLearning.jsx
│ ├── Contiguous.jsx
│ ├── PathfindingMain.py # RL training script
│ └── q_table.json # Converted Q‑table used by the UI
├── convert.js # XLSX → JSON converter for Q‑tables
├── q_table_multi_agents.xlsx # Pre‑trained table (one sheet per agent)
├── public/ # Static assets served by Vite
├── package.json # Front‑end dependencies & scripts
├── vite.config.js
└── LICENSE # MIT


---

## 🚀 Quick Start

### 1. Clone & install then Visualize

```bash
git clone https://github.com/your‑org/programmable‑matter.git
cd programmable‑matter
npm install          # installs front‑end deps

### 2. Launch the visualiser
npm run dev
```

The default build already includes a pre‑trained Q‑table, so all three visualisers should work out‑of‑the‑box.

## 🧱 Tech Stack
- React 18 + Vite 6 – lightweight front‑end scaffold

- Material UI v7 – UI components & theming

-Python 3.11 – RL training script

-NumPy / Pandas / Pygame – environment simulation

-xlsx – XLSX parsing in Node

-ESLint – opinionated linting config


