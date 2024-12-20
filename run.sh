#!/usr/bin/env bash
if [ ! -x "$(command -v docker)" ]; then
    echo "Please make sure docker is installed."
    exit 0
fi

if [ "$(command -v docker-compose)" ]; then
    COMPOSE_CMD="docker-compose"
elif [ "$(command -v docker compose)" ]; then
    COMPOSE_CMD="docker compose"
else
    echo "Please make sure docker-compose is installed."
    exit 0
fi

echo 'Starting up SecureSECO'

# pull and build docker image dependencies
$COMPOSE_CMD -f docker-compose-deps.yml pull
$COMPOSE_CMD -f docker-compose-deps.yml build

# run docker containers
$COMPOSE_CMD up --build

# This program has been developed by students from the bachelor Computer Science at Utrecht University within the Software Project course.
# © Copyright Utrecht University (Department of Information and Computing Sciences)
