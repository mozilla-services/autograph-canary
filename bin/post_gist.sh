#!/bin/bash

set -e
set -o pipefail

# hexdump a file and create a gist with with it. Requires the env var
# GIST_PAT set to a PAT with gist create permission.
#
# We assume the filename doesn't need json encoding (i.e. does not contain ["',] type chars)
#
filename=$1

# NB: do not need to json encode hex output since it's hex
cat <<EOF > "${filename}.json"
{"public":false,"files":{"$filename":{"content":"$(xxd -p "$filename")"}}}
EOF
curl -vX POST -H "Authorization: bearer ${GIST_PAT}" -d "@${filename}.json" https://api.github.com/gists
