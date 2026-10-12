package de.maxifrz.lernwerk.learn

import java.io.File

/** Finds the repository root (for content/ and the Swift fixtures), whatever the working directory of the test run is. */
object TestPaths {
    val repoRoot: File by lazy {
        val prop = System.getProperty("repo.root")
        if (prop != null && File(prop, "content").isDirectory) return@lazy File(prop)
        var dir: File? = File(System.getProperty("user.dir")).absoluteFile
        while (dir != null) {
            if (File(dir, "content/fixtures").isDirectory) return@lazy dir
            dir = dir.parentFile
        }
        error("repository root with content/fixtures not found")
    }

    /** A file below content/, like `content("fixtures/random.json")`. */
    fun content(path: String): File = File(repoRoot, "content/$path")

    /** A file below the repository root. */
    fun repo(path: String): File = File(repoRoot, path)
}
