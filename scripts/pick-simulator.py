#!/usr/bin/env python3
"""Print the UDID of an available iPhone simulator on the newest installed iOS runtime."""
import json
import re
import subprocess
import sys


def runtime_version(identifier: str) -> tuple:
    match = re.search(r"iOS-(\d+)-(\d+)", identifier)
    return (int(match.group(1)), int(match.group(2))) if match else (0, 0)


def main() -> int:
    raw = subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "-j"])
    devices = json.loads(raw)["devices"]
    best = None
    for runtime, entries in devices.items():
        if "iOS" not in runtime:
            continue
        for device in entries:
            if not device["name"].startswith("iPhone"):
                continue
            key = runtime_version(runtime)
            if best is None or key > best[0]:
                best = (key, device["udid"], device["name"])
    if best is None:
        print("No iPhone simulator available", file=sys.stderr)
        return 1
    print(f"Using {best[2]} (iOS {best[0][0]}.{best[0][1]})", file=sys.stderr)
    print(best[1])
    return 0


if __name__ == "__main__":
    sys.exit(main())
