// A plain-JVM build of the Android app's learning logic (package de.maxifrz.lernwerk.learn), so its tests run in seconds
// without the Android toolchain. It compiles the very same source files the app module compiles.
pluginManagement { repositories { gradlePluginPortal(); mavenCentral() } }
dependencyResolutionManagement { repositories { mavenCentral() } }
rootProject.name = "learn-kotlin"
