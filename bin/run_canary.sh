#!/bin/bash

set -e
set -o pipefail

# run canary from inside the lambda monitor
curl -w '\n' -X POST 'http://localhost:8080/2015-03-31/functions/function/invocations' -d '{"env": {"signed_XPI": "https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/test/xpcshell/data/signing_checks/signed1.xpi", "unsigned_XPI": "https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/test/xpcshell/data/signing_checks/unsigned.xpi"}}'
