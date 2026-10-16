import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const home = resolve(import.meta.dirname, "..");
const app = resolve(home, "android/app");
const manifestPath = resolve(app, "src/main/AndroidManifest.xml");
const gradlePath = resolve(app, "build.gradle");
const rootGradlePath = resolve(home, "android/build.gradle");
if (!existsSync(manifestPath) || !existsSync(gradlePath) || !existsSync(rootGradlePath)) {
  throw new Error("Generate Android source first: npm run android:init");
}
let xml = readFileSync(manifestPath, "utf8");
xml = xml.replace('android:allowBackup="true"', 'android:allowBackup="false"');
xml = xml.replace(/android:icon="@[^"]+"/, 'android:icon="@drawable/pantomime_icon"');
xml = xml.replace(/android:roundIcon="@[^"]+"/, 'android:roundIcon="@drawable/pantomime_icon"');
// WebView navigator.vibrate requires the Android VIBRATE permission.
if (!xml.includes("android.permission.VIBRATE")) {
  xml = xml.replace("</manifest>", '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>');
}
xml = xml.replace(/<activity\b[\s\S]*?>/, tag => {
  let value = tag;
  if (!value.includes("android:screenOrientation=")) value = value.replace("<activity", '<activity android:screenOrientation="portrait"');
  if (!value.includes("android:windowSoftInputMode=")) value = value.replace("<activity", '<activity android:windowSoftInputMode="adjustResize"');
  return value;
});
writeFileSync(manifestPath, xml, "utf8");
const icon = resolve(app, "src/main/res/drawable-nodpi/pantomime_icon.png");
mkdirSync(dirname(icon), { recursive: true });
copyFileSync(resolve(home, "public/icons/icon-512.png"), icon);

const marker = "// PANTOMIME_RELEASE_SIGNING_V1";
let gradle = readFileSync(gradlePath, "utf8");
if (!gradle.includes(marker)) {
  const appendix = [
    "",
    marker,
    "// Optional release keystore, configured only by environment variables.",
    "def pantomimeStorePath = System.getenv('PANTOMIME_KEYSTORE_PATH')",
    "if (pantomimeStorePath && file(pantomimeStorePath).exists()) {",
    "    android.signingConfigs {",
    "        pantomimeRelease {",
    "            storeFile file(pantomimeStorePath)",
    "            storePassword System.getenv('PANTOMIME_KEYSTORE_PASSWORD')",
    "            keyAlias System.getenv('PANTOMIME_KEY_ALIAS')",
    "            keyPassword System.getenv('PANTOMIME_KEY_PASSWORD')",
    "        }",
    "    }",
    "    android.buildTypes.release.signingConfig android.signingConfigs.pantomimeRelease",
    "}",
    ""
  ].join("\n");
  gradle += appendix;
  writeFileSync(gradlePath, gradle, "utf8");
}

// Maven mirrors MUST be configured in the ROOT android/build.gradle.
// The Android Gradle Plugin and Google Services are root buildscript classpath
// dependencies; adding a repository to app/build.gradle has no effect on them.
// This opt-in patch is idempotent and leaves version numbers untouched.
if (process.env.PANTOMIME_MAVEN_MIRROR === "aliyun") {
  const mirror = "maven { url 'https://maven.aliyun.com/repository/google' }";
  let rootGradle = readFileSync(rootGradlePath, "utf8");
  const original = rootGradle;

  if (!rootGradle.includes(mirror)) {
    let count = 0;
    rootGradle = rootGradle.replace(/(repositories\s*\{\s*)(google\(\))/g, (_, prefix, google) => {
      count++;
      return prefix + mirror + "\n        " + google;
    });
    if (count < 2) {
      throw new Error("Expected buildscript and allprojects repositories in android/build.gradle; aborting mirror change.");
    }
    writeFileSync(rootGradlePath, rootGradle, "utf8");
  }
  console.log("Aliyun enabled in android/build.gradle (root): " + (rootGradle !== original ? "updated" : "already configured"));
}

console.log("Native manifest, portrait mode, launcher icon, and optional signing ready.");
