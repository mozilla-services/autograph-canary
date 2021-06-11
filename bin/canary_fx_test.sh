#!/bin/bash

set -v
set -o pipefail

df -h

mount

sysctl kernel.core_pattern

/function/firefox/firefox/firefox -xpcshell -g /function/firefox/firefox/ -a /function/firefox/firefox/browser -f /function/tlscanary/js/worker_common.js /function/tests/content_signature_test.js <<EOF
{"mode":"wakeup"}
{"mode":"quit"}
EOF

ls -lh /tmp/core*
cd /tmp/
mkdir -p /tmp/canary-wip
for core_file in $(ls -1 core*);
do
    echo "$core_file"
    gzip -c "$core_file" > "canary-wip/${core_file}.gz"
    xxd -p "canary-wip/${core_file}.gz" > "canary-wip/${core_file}.gz.hex"
    ls -lh "${core_file}" "canary-wip/${core_file}.gz" "canary-wip/${core_file}.gz.hex"
    curl -vX POST -F "format=url" -F "content=<canary-wip/${core_file}.gz.hex" https://paste.mozilla.org/api/
done
