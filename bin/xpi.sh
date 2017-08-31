#!/usr/bin/env bash

echo $@

set -eu

BASE_DIR="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
TMP_DIR=$(mktemp -d)
DEST="${TMP_DIR}/cloud-storage-addon"
XPI="${XPI:-cloud-storage-addon.xpi}"
mkdir -p $DEST

# deletes the temp directory
function cleanup {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo $PWD

cp -rp cloud-storage-addon/* $DEST

pushd $DEST
zip -r $DEST/${XPI} *
mkdir -p $BASE_DIR/dist
mv "${XPI}" $BASE_DIR/dist
echo "xpi at ${BASE_DIR}/dist/${XPI}"
popd
