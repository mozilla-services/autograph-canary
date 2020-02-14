#!/usr/bin/env bash

ENV=${ENV:-autographstage}
STACK_ID=${STACK_ID:-test}
ARTIFACT_NAME=${ARTIFACT_NAME:-"autograph-canary-monitor-${STACK_ID}-${ENV}.zip"}
PROJECT_ROOT="$( cd "$(dirname "$0")/.." >/dev/null 2>&1 ; pwd -P )"
cd $PROJECT_ROOT

if [ ! -d 'venv' ]; then
  python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt

pushd venv/lib/python3.7/site-packages
zip -r "${OLDPWD}/${ARTIFACT_NAME}" .
popd
zip -r -g "${ARTIFACT_NAME}" autograph.py tests
