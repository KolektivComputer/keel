plugins {
    id("keel.published-library")
}

publishing {
    publications.named<MavenPublication>("maven") {
        artifactId = "ktor"
    }
}

dependencies {
    api(project(":lib"))
    api(libs.ktor.server.core)
    api(libs.ktor.server.sse)
    api(libs.ktor.server.websockets)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.ktor.server.netty)
    testImplementation(libs.ktor.client.websockets)
    testImplementation(libs.ktor.client.cio)
    testImplementation(libs.junit.jupiter)
    testRuntimeOnly(libs.junit.jupiter.engine)
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
