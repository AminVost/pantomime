import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import sharp from "sharp";

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
xml = xml.replace(/android:icon="@[^"]+"/, 'android:icon="@mipmap/adazi_launcher"');
xml = xml.replace(/android:roundIcon="@[^"]+"/, 'android:roundIcon="@mipmap/adazi_launcher"');
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
const res = resolve(app, "src/main/res");
const writeResource = (path, contents) => {
  const target = resolve(res, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
};
for (const [density, size] of [["mdpi", 48], ["hdpi", 72], ["xhdpi", 96], ["xxhdpi", 144], ["xxxhdpi", 192]]) {
  const target = resolve(res, `mipmap-${density}/adazi_launcher.png`);
  mkdirSync(dirname(target), { recursive: true });
  await sharp(resolve(home, "public/icons/icon-512.png")).resize(size, size).png().toFile(target);
}
for (const [file, drawable] of [["adazi-adaptive-foreground.png", "adazi_launcher_foreground.png"], ["adazi-splash.png", "adazi_splash.png"]]) {
  const target = resolve(res, "drawable-nodpi", drawable);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(home, "public/brand", file), target);
}
writeResource("values/adazi_colors.xml", '<resources><color name="adazi_icon_background">#f2eeff</color></resources>\n');
writeResource("mipmap-anydpi-v26/adazi_launcher.xml", '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/adazi_icon_background"/><foreground android:drawable="@drawable/adazi_launcher_foreground"/></adaptive-icon>\n');
const stringsPath = resolve(res, "values/strings.xml");
let strings = readFileSync(stringsPath, "utf8");
for (const key of ["app_name", "title_activity_main"]) {
  const tag = new RegExp(`<string name="${key}">[^<]*</string>`);
  if (!tag.test(strings)) throw new Error("Missing native label resource: " + key);
  strings = strings.replace(tag, `<string name="${key}">ادازی</string>`);
}
writeFileSync(stringsPath, strings, "utf8");

// Replace Capacitor's template splash with the approved Adazi splash. Keep this
// reproducible: android/ is generated, so never rely on manual resource edits.
const stylesPath = resolve(app, "src/main/res/values/styles.xml");
let styles = readFileSync(stylesPath, "utf8");
const launchTheme = /<style name="AppTheme.NoActionBarLaunch"[\s\S]*?<\/style>/;
if (!launchTheme.test(styles)) throw new Error("Cannot locate Android launch theme");
styles = styles.replace(launchTheme, `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">#f6f3ef</item>
        <item name="windowSplashScreenBackground">#f6f3ef</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/adazi_splash</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`);
writeFileSync(stylesPath, styles, "utf8");

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
