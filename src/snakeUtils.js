// Utility functions for snake/contiguous algorithms

/**
 * Builds an adjacency chain from a set of cells
 * @param {Array} cells - Array of cell objects with x,y coordinates
 * @returns {Array} - Array of connected cell chains
 */
export function buildAdjacencyChain(cells) {
  if (cells.length === 0) return [];
  
  const visited = new Set();
  const chains = [];
  
  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`;
    if (visited.has(key)) continue;
    
    const chain = [];
    const queue = [cell];
    
    while (queue.length > 0) {
      const current = queue.shift();
      const currentKey = `${current.x},${current.y}`;
      
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);
      chain.push(current);
      
      // Check 4-directional neighbors
      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 }
      ];
      
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;
        if (cells.some(c => c.x === neighbor.x && c.y === neighbor.y) && !visited.has(neighborKey)) {
          queue.push(neighbor);
        }
      }
    }
    
    if (chain.length > 0) {
      chains.push(chain);
    }
  }
  
  return chains;
}

/**
 * Checks if a set of cells forms a contiguous shape
 * @param {Array} cells - Array of cell objects with x,y coordinates
 * @returns {boolean} - True if cells form a contiguous shape
 */
export function isContiguous(cells) {
  if (cells.length === 0) return false;
  
  const chains = buildAdjacencyChain(cells);
  return chains.length === 1;
}

/**
 * Calculates the Euclidean distance between two points
 * @param {Object} a - First point with x,y coordinates
 * @param {Object} b - Second point with x,y coordinates
 * @returns {number} - Euclidean distance
 */
export function euclid(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
} 