import React from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography, Paper, Stack } from '@mui/material';
import AStarAlgo from './AStarAlgo';
import ReinforcementLearning from './ReinforcementLearning';
import Contiguous from './Contiguous';

function HomePage() {
  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Algorithm Visualizer
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 4 }}>
          Select an algorithm to visualize
        </Typography>
        <Stack spacing={2}>
          <Button
            component={Link}
            to="/astar"
            variant="contained"
            size="large"
            fullWidth
          >
            A* Algorithm
          </Button>
          <Button
            component={Link}
            to="/RL"
            variant="contained"
            size="large"
            fullWidth
          >
            Reinforcement Learning
          </Button>
          <Button
            component={Link}
            to="/contiguous"
            variant="contained"
            size="large"
            fullWidth
          >
            Contiguous Algorithm
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

// Wrapper component to add back button to each algorithm page
function AlgorithmWrapper({ children }) {
  const navigate = useNavigate();
  return (
    <Box>
      <Button
        onClick={() => navigate('/')}
        variant="outlined"
        sx={{ m: 2 }}
      >
        Back to Home
      </Button>
      {children}
    </Box>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/astar" element={
          <AlgorithmWrapper>
            <AStarAlgo />
          </AlgorithmWrapper>
        } />
        <Route path="/RL" element={
          <AlgorithmWrapper>
            <ReinforcementLearning />
          </AlgorithmWrapper>
        } />
        <Route path="/contiguous" element={
          <AlgorithmWrapper>
            <Contiguous />
          </AlgorithmWrapper>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;