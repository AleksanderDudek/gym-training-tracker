import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// Adres serwera skrzynek, ten sam co dla zegarka Garmin. Inny serwer:
// ./gradlew assembleDebug -Pzdrowie.apiUrl=https://…
val apiUrl = providers.gradleProperty("zdrowie.apiUrl")
    .getOrElse("https://gym-tracker-api.instrukcje-app.workers.dev")
    .trimEnd('/')

// Wersja przychodzi z tagu zdrowie-android-v1.2.3 (workflow podaje -Pzdrowie.version=1.2.3).
// versionCode wynika z niej (1.2.3 → 10203), żeby każde wydanie dało się zainstalować na poprzednie.
val appVersion = providers.gradleProperty("zdrowie.version").getOrElse("0.1.0")
val appVersionCode = appVersion.split('.').map { it.toIntOrNull() ?: 0 }
    .let { v -> v.getOrElse(0) { 0 } * 10_000 + v.getOrElse(1) { 0 } * 100 + v.getOrElse(2) { 0 } }
    .coerceAtLeast(1)

// Podpis wydania tylko ze zmiennych środowiska albo właściwości Gradle (~/.gradle/gradle.properties).
// Plik klucza nie trafia do repozytorium. Bez niego assembleRelease daje APK niepodpisany.
fun secret(name: String): String? =
    (providers.environmentVariable(name).orNull ?: providers.gradleProperty(name).orNull)
        ?.takeIf { it.isNotBlank() }

val releaseKeystore = secret("ANDROID_KEYSTORE_PATH")?.let { file(it) }?.takeIf { it.isFile }

android {
    namespace = "io.github.aleksanderdudek.gymtracker.zdrowie"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.aleksanderdudek.gymtracker.zdrowie"
        minSdk = 28
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersion
        buildConfigField("String", "API_URL", "\"$apiUrl\"")
    }

    signingConfigs {
        if (releaseKeystore != null) {
            create("release") {
                storeFile = releaseKeystore
                storePassword = secret("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = secret("ANDROID_KEY_ALIAS")
                keyPassword = secret("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            // Bez R8: aplikacja jest mała, a reguł keep nie da się tu sprawdzić na urządzeniu.
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }

    testOptions {
        unitTests.all {
            // Wspólny wektor koperty leży w health/vectors.json, poza projektem Gradle.
            it.systemProperty("vectors", rootProject.file("../vectors.json").absolutePath)
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.androidx.health.connect)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.junit)
    testImplementation(libs.json)
}
