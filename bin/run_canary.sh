#!/bin/bash

set -e
set -o pipefail

# run canary from inside the lambda monitor
curl -w '\n' -X POST 'http://localhost:8080/2015-03-31/functions/function/invocations' -d '{}'
