#!/bin/bash

set -e
set -o pipefail

# invoke a test canary run in a lambda monitor
ERROR=$(curl -w '\n' -X POST 'http://localhost:8080/2015-03-31/functions/function/invocations' -d '{"env": {"signed_XPI": "https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/test/xpcshell/data/signing_checks/signed1.xpi", "unsigned_XPI": "https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/test/xpcshell/data/signing_checks/unsigned.xpi"}}')
echo "got err: '${ERROR}' and exit code: '$?'"
# TODO: check for failure
test "$ERROR = null"
