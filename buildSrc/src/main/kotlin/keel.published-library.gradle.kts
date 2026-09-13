plugins {
    id("keel.kotlin-conventions")
    kotlin("plugin.serialization")
    id("keel.publishing-conventions")
}

tasks.named<Jar>("jar") {
    from(rootProject.file("CHANGELOG.md")) {
        into("META-INF")
    }
}
