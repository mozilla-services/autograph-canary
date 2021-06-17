#!/bin/bash

# set -v
set -o pipefail

printenv

df -h

mount

ldd /function/firefox/firefox/firefox

sysctl kernel.core_pattern

uname -a

rm -f /tmp/core.firefox*

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
    curl -H "Max-Downloads: 1" -H "Max-Days: 5" --upload-file "/tmp/canary-wip/${core_file}.gz" "https://transfer.sh/${core_file}.gz"
done

ls -lh /tmp/canary-wip
rm -rf /tmp/canary-wip
