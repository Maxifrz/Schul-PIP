#!/bin/sh
# Recreates the symlinks of the Linux harness. Run from scripts/learn-swift.
set -e
cd "$(dirname "$0")"
root=../..
rm -rf Sources/Lernwerk/* Tests/LernwerkTests/*
mkdir -p Sources/Lernwerk Sources/Export Tests/LernwerkTests
ln -s ../../$root/Lernwerk/Services/Learn Sources/Lernwerk/Learn
ln -s ../../$root/Lernwerk/Services/Review/AnswerCheck.swift Sources/Lernwerk/AnswerCheck.swift
ln -s ../../$root/Lernwerk/Services/Review/SpacedRepetition.swift Sources/Lernwerk/SpacedRepetition.swift
ln -s ../../$root/Lernwerk/Services/Studio/PipRun.swift Sources/Lernwerk/PipRun.swift
cp LinuxShim.swift.txt Sources/Lernwerk/LinuxShim.swift
for t in $TESTS; do ln -s ../../$root/LernwerkTests/$t Tests/LernwerkTests/$t; done
