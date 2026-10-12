// swift-tools-version:5.9
// Builds the Foundation-only learning logic of the iOS app on Linux, so its tests and the fixture export
// (scripts/learn-swift/Sources/Export) run without Xcode. The sources are symlinks into Lernwerk/; nothing is copied.
import PackageDescription

let package = Package(
    name: "LernwerkLearn",
    targets: [
        .target(name: "Lernwerk", path: "Sources/Lernwerk", exclude: ["Learn/DistractorService.swift", "Learn/Material"]),
        .executableTarget(name: "LearnExport", dependencies: ["Lernwerk"], path: "Sources/Export"),
        .testTarget(name: "LernwerkTests", dependencies: ["Lernwerk"], path: "Tests/LernwerkTests"),
    ]
)
