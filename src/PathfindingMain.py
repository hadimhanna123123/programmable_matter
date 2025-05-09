import numpy as np
import random
import pygame
import pandas as pd
import matplotlib.pyplot as plt

# === CONFIGURATION ===
GRID_SIZE    = 10
# OBSTACLE     = [(1, 1), (2, 2), (3, 3)]
OBSTACLE     = []

REWARD_GOAL    = 10
REWARD_MOVE    = -1
REWARD_INVALID = -10

EPSILON  = 0.1   # exploration rate
ALPHA    = 0.1   # learning rate
GAMMA    = 0.9   # discount factor
EPISODES = 1000  # Increased episodes for better training with larger grid

# Agents' start positions and targets:
# Agents start at bottom row, evenly spaced
# For row 9 (bottom row)
# Or for agents in both rows 9 and 8 (20 agents total):
# For agents in rows 9 and 8 (20 agents total)
# 10 agents in the bottom row
INITIAL_POSITIONS = [
    (9, 0), (9, 1), (9, 2), (9, 3), (9, 4),
    (9, 5), (9, 6), (9, 7), (9, 8), (9, 9)
]

# 10 targets in the middle area
TARGETS = [
    (4, 4), (4, 5), (5, 4), (5, 5),  # center 2x2
    (4, 3), (4, 6), (5, 3), (5, 6),  # extend out
    (3, 4), (6, 5)                    # complete the set
]

N_AGENTS = len(INITIAL_POSITIONS)
assert N_AGENTS == len(TARGETS), "Need one target per agent"

# Pygame setup
pygame.init()
screen = pygame.display.set_mode((400, 400))
pygame.display.set_caption('Multi-Agent Pathfinding')

# Colors
WHITE = (255, 255, 255)
BLACK = (  0,   0,   0)
RED   = (255,   0,   0)  # obstacles
import colorsys

AGENT_COLORS = []
for i in range(N_AGENTS):
    # Generate distinct colors using HSV color space
    hue = i / N_AGENTS
    r, g, b = colorsys.hsv_to_rgb(hue, 1.0, 1.0)
    AGENT_COLORS.append((int(r*255), int(g*255), int(b*255)))
TARGET_COLOR = (  0, 255,   0)

# Actions: up, down, left, right, and diagonals
ACTIONS = [
    (-1,  0),  # up
    ( 1,  0),  # down
    ( 0, -1),  # left
    ( 0,  1),  # right
    (-1, -1),  # up-left
    (-1,  1),  # up-right
    ( 1, -1),  # down-left
    ( 1,  1)   # down-right
]
N_ACTIONS = len(ACTIONS)

# === AGENT CLASS ===
class Agent:
    def __init__(self, start_pos):
        self.start_pos = start_pos
        self.position  = start_pos

    def reset(self):
        self.position = self.start_pos

    def propose(self, action_idx):
        dy, dx = ACTIONS[action_idx]
        y, x = self.position
        return (y + dy, x + dx)

    def apply_move(self, new_pos):
        self.position = new_pos

agents = [Agent(pos) for pos in INITIAL_POSITIONS]

# Q-table: one slice per agent
q_table = np.zeros((N_AGENTS, GRID_SIZE, GRID_SIZE, N_ACTIONS))

def choose_action(agent_idx, state):
    y, x = state
    if random.random() < EPSILON:
        return random.randrange(N_ACTIONS)  # 10% of the time choose random action
    return int(np.argmax(q_table[agent_idx, y, x]))  # 90% of the time choose best action

def update_q(agent_idx, state, action, reward, next_state):
    y, x = state
    ny, nx = next_state
    current = q_table[agent_idx, y, x, action]
    future_max = np.max(q_table[agent_idx, ny, nx]) 
    q_table[agent_idx, y, x, action] = current + ALPHA * (reward + GAMMA * future_max - current) # Q-learning formula

def draw_grid():
    screen.fill(WHITE)
    cell = 400 // GRID_SIZE

    # grid & obstacles
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            rect = pygame.Rect(x*cell, y*cell, cell, cell)
            pygame.draw.rect(screen, BLACK, rect, 1)
            if (y, x) in OBSTACLE:
                pygame.draw.rect(screen, RED, rect)

    # targets
    for ty, tx in TARGETS:
        rect = pygame.Rect(tx*cell, ty*cell, cell, cell)
        pygame.draw.rect(screen, TARGET_COLOR, rect)

    # agents
    for idx, ag in enumerate(agents):
        ay, ax = ag.position
        rect = pygame.Rect(ax*cell, ay*cell, cell, cell)
        color = AGENT_COLORS[idx % len(AGENT_COLORS)]
        pygame.draw.rect(screen, color, rect)

    pygame.display.flip()

# Track rewards per episode
all_rewards = [[] for _ in range(N_AGENTS)]

# === TRAINING ===
for ep in range(EPISODES):
    # reset agents
    for ag in agents:
        ag.reset()

    ep_rewards = [0]*N_AGENTS
    steps = 0

    # run until all reach their targets
    while not all(ag.position == tgt for ag, tgt in zip(agents, TARGETS)):
        for evt in pygame.event.get():
            if evt.type == pygame.QUIT:
                pygame.quit()
                exit()

        # 1) each agent chooses & proposes
        proposals = []
        for idx, ag in enumerate(agents):
            if ag.position == TARGETS[idx]:
                # already finished → no new move
                proposals.append((idx, ag.position, None, ag.position))
            else:
                state  = ag.position
                action = choose_action(idx, state)
                prop   = ag.propose(action)
                proposals.append((idx, state, action, prop))

        # 2) count valid proposals for collision detection
        counts = {}
        for _, _, action, prop in proposals:
            if action is not None:
                counts[prop] = counts.get(prop, 0) + 1

        # 3) figure out which targets are already occupied
        occupied_targets = {
            ag.position
            for ag, tgt in zip(agents, TARGETS)
            if ag.position == tgt
        }

        # 4) validate & apply each move
        for idx, state, action, prop in proposals:
            if action is None:
                # no move; stays put
                continue

            y, x = prop
            invalid = (
                # out of grid
                not (0 <= y < GRID_SIZE and 0 <= x < GRID_SIZE)
                # hit static obstacle
                or prop in OBSTACLE
                # two agents tried same cell
                or counts[prop] > 1
                # blocked by a finished agent
                or prop in occupied_targets
            )

            if invalid:
                new_pos = state
                reward  = REWARD_INVALID
            else:
                new_pos = prop
                reward  = REWARD_GOAL if new_pos == TARGETS[idx] else REWARD_MOVE

            update_q(idx, state, action, reward, new_pos)
            ep_rewards[idx] += reward
            agents[idx].apply_move(new_pos)

        steps += 1
        draw_grid()
        pygame.time.delay(30)

    # record & print
    for i in range(N_AGENTS):
        all_rewards[i].append(ep_rewards[i])
    print(f"Episode {ep}: steps={steps}, rewards={ep_rewards}")

pygame.quit()

# === PLOT RESULTS ===
for i in range(N_AGENTS):
    plt.plot(all_rewards[i], label=f"Agent {i}")
plt.xlabel("Episode")
plt.ylabel("Total Reward")
plt.title("Multi-Agent Rewards per Episode")
plt.legend()
plt.show()

# === SAVE Q-TABLES ===
with pd.ExcelWriter("q_table_multi_agents.xlsx") as writer:
    for i in range(N_AGENTS):
        flat = q_table[i].reshape(-1, N_ACTIONS)
        df = pd.DataFrame(flat, columns=[
    "Up", "Down", "Left", "Right",
    "Up-Left", "Up-Right", "Down-Left", "Down-Right"
])
        df.to_excel(writer, sheet_name=f"agent_{i}", index=False)

print("Saved each agent's Q-table to 'q_table_multi_agents.xlsx'")
