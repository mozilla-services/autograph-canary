#!/bin/bash

set -e
set -o pipefail

docker-compose stop

# stop everything currently running and clean up volumes
docker-compose down --volumes

# start the lambda emulator
docker-compose up -d emulator
echo "waiting for autograph-canary-lambda-emulator to start"
while test "true" != "$(docker inspect -f {{.State.Running}} autograph-canary-lambda-emulator)"; do
  echo -n "."
  sleep 1 # wait before checking again
done

# exec in containers to workaround https://circleci.com/docs/2.0/building-docker-images/#accessing-services
docker-compose exec emulator "/usr/local/bin/run_canary.sh"
docker-compose logs emulator
