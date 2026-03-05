#!/bin/bash

cd "$(dirname "$0")/.." || exit
docker compose -f docker/docker-compose.yml up --build -d
