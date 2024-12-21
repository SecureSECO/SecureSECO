#!/usr/bin/env bash

if [ ! -x "$(command -v docker)" ]; then
    echo "Please make sure docker is installed."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "Please make sure docker compose is installed."
    exit 1
fi

echo 'Starting up SecureSECO'

# pull and build docker image dependencies
docker compose -f docker-compose-deps.yml pull
docker compose -f docker-compose-deps.yml build

# run docker containers as a daemon
docker compose up -d --build

