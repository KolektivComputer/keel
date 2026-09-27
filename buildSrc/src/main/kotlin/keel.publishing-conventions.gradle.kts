plugins {
    `maven-publish`
    signing
}

val febDisplayName = providers.gradleProperty("keel.displayName").orElse("Keel")
val febDescription = providers.gradleProperty("keel.description")
    .orElse("Host-owned routing and swappable frontend packs for Kotlin servers.")
val febUrl = providers.gradleProperty("keel.url").orElse("https://github.com/KolektivComputer/keel")
val febScm = providers.gradleProperty("keel.scm").orElse("scm:git:https://github.com/KolektivComputer/keel.git")
val febLicenseName = providers.gradleProperty("keel.licenseName").orElse("Apache-2.0")
val febLicenseUrl = providers.gradleProperty("keel.licenseUrl")
    .orElse("https://www.apache.org/licenses/LICENSE-2.0.txt")

val versionString = project.version.toString()
val isCanonicalSnapshot = versionString.endsWith("-SNAPSHOT")

publishing {
    publications {
        create<MavenPublication>("maven") {
            pom {
                name.set(febDisplayName.map { "$it (${project.name})" })
                description.set(febDescription)
                url.set(febUrl)
                licenses {
                    license {
                        name.set(febLicenseName)
                        url.set(febLicenseUrl)
                    }
                }
                developers {
                    developer {
                        id.set("kolektiv")
                        name.set("Kolektiv")
                        organization.set("Kolektiv")
                    }
                }
                scm {
                    url.set(febUrl)
                    connection.set(febScm)
                    developerConnection.set(febScm)
                }
            }
        }
    }

    repositories {
        mavenLocal()

        // GitHub Packages (optional dual-publish; never the primary consumer path)
        val ghActor = providers.environmentVariable("GITHUB_ACTOR")
        val ghToken = providers.environmentVariable("GITHUB_TOKEN")
        if (ghActor.isPresent && ghToken.isPresent) {
            maven {
                name = "GitHubPackages"
                url = uri("https://maven.pkg.github.com/KolektivComputer/keel")
                credentials {
                    username = ghActor.get()
                    password = ghToken.get()
                }
            }
        }

        val yuriUser = providers.gradleProperty("keel.publishing.yuriCapitalRepoUsername")
            .orElse(providers.environmentVariable("YURI_CAPITAL_REPO_USERNAME"))
        val yuriPass = providers.gradleProperty("keel.publishing.yuriCapitalRepoPassword")
            .orElse(providers.environmentVariable("YURI_CAPITAL_REPO_PASSWORD"))
        if (yuriUser.isPresent && yuriPass.isPresent) {
            val user = yuriUser.get()
            val pass = yuriPass.get()
            maven {
                name = if (isCanonicalSnapshot) "kolektivSnapshots" else "kolektivReleases"
                url = uri(
                    if (isCanonicalSnapshot) "https://repo.kolektiv.computer/repository/maven-snapshots/"
                    else "https://repo.kolektiv.computer/repository/maven-releases/"
                )
                credentials {
                    username = user
                    password = pass
                }
            }
        }
    }
}

signing {
    val hasSigning = providers.gradleProperty("signing.keyId").isPresent
    isRequired = hasSigning && !isCanonicalSnapshot
    if (hasSigning) {
        sign(publishing.publications)
    }
}

pluginManager.withPlugin("java") {
    publishing.publications.named<MavenPublication>("maven") {
        from(components["java"])
    }
}
