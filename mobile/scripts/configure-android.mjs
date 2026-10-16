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

// Opt-in regional Maven mirror.
// Capacitor's Android library declares its OWN buildscript.repositories, so
// patching only the root Gradle repositories does not cover :capacitor-android.
// Patch the generated Android files and the installed Capacitor Gradle files.
// This is idempotent, does not alter library versions, and is re-applied after npm install.
if (process.env.PANTOMIME_MAVEN_MIRROR === "aliyun") {
  const mirror = "maven { url 'https://maven.aliyun.com/repository/google' }";
  const gradleFiles = [
    { path: rootGradlePath, required: 2, module: "root" },
    { path: resolve(home, "node_modules/@capacitor/android/capacitor/build.gradle"), required: 2, module: ":capacitor-android" },
    { path: resolve(home, "android/capacitor-cordova-android-plugins/build.gradle"), required: 2, module: ":capacitor-cordova-android-plugins" },
    { path: resolve(home, "node_modules/@capacitor/app/android/build.gradle"), required: 0, module: ":capacitor-app" }
  ];
  for (const entry of gradleFiles) {
    if (!existsSync(entry.path)) {
      if (entry.required) throw new Error("Required Gradle file missing: " + entry.path);
      continue;
    }
    let contents = readFileSync(entry.path, "utf8");
    // Only match google() at the beginning of repositories blocks. The mirror
    // stays before google(), avoiding inaccessible Google Maven lookups.
    let count = 0;
    contents = contents.replace(/(repositories\s*\{\s*)(google\(\))/g, (_match, prefix, googleRepo) => {
      count += 1;
      return prefix + mirror + "\n        " + googleRepo;
    });
    const existingMirrors = (contents.match(/maven\.aliyun\.com\/repository\/google/g) || []).length;
    if (count === 0 && existingMirrors === 0 && entry.required) {
      throw new Error("Cannot configure Aliyun for " + entry.module + ": Gradle repositories layout changed.");
    }
    if (existingMirrors < entry.required) {
      throw new Error("Aliyun not configured for enough repositories in " + entry.module);
    }
    writeFileSync(entry.path, contents, "utf8");
    console.log("Aliyun Gradle mirror verified for " + entry.module + " (" + existingMirrors + " repositories).");
  }
}

console.log("Native manifest, portrait mode, launcher icon, and optional signing ready.");
