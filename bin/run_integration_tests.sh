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

# parse logs because RIE doesn't block on lambda execution and
# there's on obvious way to fetch the logs locally
docker-compose logs emulator
# grep has exit code 1 if no lines were selected
test "$(docker-compose logs --no-log-prefix emulator | grep 'exited with error:' || echo -n $?)" = "1"
# also fail if a JS error occurs
# surface errors

echo "checking for JS errors:"
docker-compose logs --no-log-prefix emulator | grep 'Reader tlscanary.tools.xpcshell_worker JS error from worker' || true

echo "checking for invalid output:"
docker-compose logs --no-log-prefix emulator | grep 'Reader tlscanary.tools.xpcshell_worker Invalid output from worker' || true
