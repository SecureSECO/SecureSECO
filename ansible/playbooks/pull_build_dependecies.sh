#!/usr/bin/env bash

if [ ! -x "$(command -v docker)" ]; then
    echo "Please make sure docker is installed."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "Please make sure docker compose is installed."
    exit 1
fi

# pull and build docker image dependencies
docker compose -f docker-compose-deps.yml pull
docker compose -f docker-compose-deps.yml build
