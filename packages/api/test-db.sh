#!/bin/bash

# Test database management script
set -e

COMPOSE_FILE="docker-compose.test.yml"
DB_URL="postgres://test_user:test_password@localhost:5433/packrat_test"

case "$1" in
  "start")
    echo "🐳 Starting PostgreSQL test container..."
    docker compose -f "$COMPOSE_FILE" up -d --wait
    echo "✅ PostgreSQL test container started"
    ;;
    
  "stop")
    echo "🧹 Stopping PostgreSQL test container..."
    docker compose -f "$COMPOSE_FILE" down -v
    echo "✅ PostgreSQL test container stopped and cleaned up"
    ;;
    
  "reset")
    echo "🔄 Resetting PostgreSQL test container..."
    docker compose -f "$COMPOSE_FILE" down -v
    docker compose -f "$COMPOSE_FILE" up -d --wait
    echo "✅ PostgreSQL test container reset completed"
    ;;
    
  *)
    echo "Usage: $0 {start|stop|reset}"
    exit 1
    ;;
esac