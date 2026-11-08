#!/usr/bin/env bash
# Builds BackbeatBlitz.apk without Gradle, using the Debian/Ubuntu Android SDK packages:
#   sudo apt-get install android-sdk-platform-23 aapt zipalign apksigner dalvik-exchange
set -euo pipefail
cd "$(dirname "$0")"
SDK=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
B=build
rm -rf "$B" && mkdir -p "$B/gen" "$B/classes"

echo "== verifying every level is beatable"
javac -nowarn -d "$B/solver" src/com/backbeat/blitz/Level.java src/com/backbeat/blitz/Sim.java tools/Solver.java
java -cp "$B/solver" Solver 12

echo "== resources"
aapt package -f -m -J "$B/gen" -M AndroidManifest.xml -S res -I "$SDK" -F "$B/app.unsigned.apk"

echo "== compile"
javac -nowarn --release 8 -Xlint:-options -classpath "$SDK" -d "$B/classes" \
    $(find src "$B/gen" -name '*.java')

echo "== dex"
dalvik-exchange --dex --min-sdk-version=21 --output="$B/classes.dex" "$B/classes"
(cd "$B" && zip -q -j app.unsigned.apk classes.dex)

echo "== align + sign"
zipalign -f -p 4 "$B/app.unsigned.apk" "$B/app.aligned.apk"
if [ ! -f debug.keystore ]; then
  keytool -genkeypair -keystore debug.keystore -storepass android -keypass android -alias debug \
      -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Backbeat Blitz Debug"
fi
apksigner sign --ks debug.keystore --ks-pass pass:android --key-pass pass:android \
    --v4-signing-enabled false --out BackbeatBlitz.apk "$B/app.aligned.apk"
apksigner verify --verbose BackbeatBlitz.apk | head -4
ls -la BackbeatBlitz.apk
