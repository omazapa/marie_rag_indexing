# Use a slim Python image
FROM python:3.11-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock* ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Copy the rest of the application code
COPY backend/ ./backend/

# Expose the port the app runs on
EXPOSE 5001

# Set environment variables
ENV PYTHONPATH=/app

# Run the application with uvicorn
CMD ["uv", "run", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "5001", "--reload", "--reload-exclude", "backend/tests/*"]
