#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Stopping existing services...${NC}"
fuser -k 5001/tcp 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true

echo -e "${GREEN}Starting Backend on port 5001...${NC}"
export PYTHONPATH=$PYTHONPATH:.
uv run uvicorn backend.app.main:app --host 0.0.0.0 --port 5001 --reload &
BACKEND_PID=$!

echo -e "${GREEN}Starting Frontend on port 3001...${NC}"
cd frontend && npm run dev -- -p 3001 &
FRONTEND_PID=$!

# Function to handle script termination
cleanup() {
    echo -e "\n${BLUE}Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

echo -e "${BLUE}Services are running!${NC}"
echo -e "Backend: http://localhost:5001"
echo -e "Frontend: http://localhost:3001"
echo -e "Press Ctrl+C to stop all services."

# Keep script running
wait
