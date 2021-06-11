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
for core_file in $(ls -1 /tmp/core*);
do
    echo "$core_file"
    gzip -c "$core_file" | xxd
done
