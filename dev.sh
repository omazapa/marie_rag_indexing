#!/bin/bash
# Development helper script

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Marie RAG Indexing - Development Mode${NC}"
echo ""

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

case "${1:-up}" in
    up)
        echo -e "${YELLOW}📦 Starting development environment...${NC}"
        docker compose -f docker-compose.yml -f docker-compose.dev.yml up
        ;;
    down)
        echo -e "${YELLOW}🛑 Stopping development environment...${NC}"
        docker compose -f docker-compose.yml -f docker-compose.dev.yml down
        ;;
    restart)
        echo -e "${YELLOW}🔄 Restarting development environment...${NC}"
        docker compose -f docker-compose.yml -f docker-compose.dev.yml restart
        ;;
    logs)
        docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f "${2:-}"
        ;;
    test)
        echo -e "${YELLOW}🧪 Running backend tests...${NC}"
        docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend uv run pytest "${@:2}"
        ;;
    shell)
        service="${2:-backend}"
        echo -e "${YELLOW}🐚 Opening shell in $service...${NC}"
        docker compose -f docker-compose.yml -f docker-compose.dev.yml exec "$service" sh
        ;;
    rebuild)
        echo -e "${YELLOW}🔨 Rebuilding images...${NC}"
        docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
        ;;
    clean)
        echo -e "${YELLOW}🧹 Cleaning up...${NC}"
        docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
        ;;
    *)
        echo "Usage: ./dev.sh {up|down|restart|logs|test|shell|rebuild|clean}"
        echo ""
        echo "Commands:"
        echo "  up       - Start development environment (default)"
        echo "  down     - Stop development environment"
        echo "  restart  - Restart services"
        echo "  logs     - Follow logs (optional: specify service)"
        echo "  test     - Run backend tests"
        echo "  shell    - Open shell (optional: specify service)"
        echo "  rebuild  - Rebuild and restart"
        echo "  clean    - Remove containers and volumes"
        exit 1
        ;;
esac
