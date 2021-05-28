#!/bin/bash

set -e
set -o pipefail

BUCKET_NAMES=$(curl -s -w '\n' https://firefox.settings.services.mozilla.com/v1/buckets | jq -r '.data[] | .id')

for bucket in $BUCKET_NAMES
do
    for collection in $(curl -s -w '\n' "https://firefox.settings.services.mozilla.com/v1/buckets/${bucket}/collections" | jq -r '.data[] | .id')
    do
	echo "${bucket}/${collection}"
    done
done
