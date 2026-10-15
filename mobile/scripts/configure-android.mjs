import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const home = resolve(import.meta.dirname, "..");
const app = resolve(home, "android/app");
const manifestPath = resolve(app, "src/main/AndroidManifest.xml");
const gradlePath = resolve(app, "build.gradle");
if (!existsSync(manifestPath) || !existsSync(gradlePath)) {
  throw new Error("Generate Android source first: npm run android:init");
}
let xml = readFileSync(manifestPath, "utf8");
xml = xml.replace('android:allowBackup="true"', 'android:allowBackup="false"');
xml = xml.replace(/android:icon="@[^"]+"/, 'android:icon="@drawable/pantomime_icon"');
xml = xml.replace(/android:roundIcon="@[^"]+"/, 'android:roundIcon="@drawable/pantomime_icon"');
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
console.log("Native manifest, portrait mode, launcher icon, and optional signing ready.");
