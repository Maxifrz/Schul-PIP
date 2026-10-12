plugins {
    kotlin("jvm") version "2.2.21"
    kotlin("plugin.serialization") version "2.2.21"
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
java { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }

val app = "../../android/app/src"

sourceSets {
    main {
        kotlin.srcDir("$app/main/java")
        kotlin.include("de/maxifrz/lernwerk/learn/**", "de/maxifrz/lernwerk/review/**")
    }
    test {
        kotlin.srcDir("$app/test/java")
        kotlin.include("de/maxifrz/lernwerk/learn/**", "de/maxifrz/lernwerk/AnswerCheckTest.kt")
    }
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    testImplementation("junit:junit:4.13.2")
}

tasks.test {
    // The tests read content/ from the repository root.
    systemProperty("repo.root", file("../..").canonicalPath)
    maxHeapSize = "2g"
}
