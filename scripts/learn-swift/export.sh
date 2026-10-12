#!/bin/sh
# Rebuilds content/fixtures from the Swift engines (needs a Swift toolchain, 6.x, on Linux or macOS).
set -e
cd "$(dirname "$0")"
./link.sh
swift build --product LearnExport
.build/debug/LearnExport ../../content/fixtures
