#!/usr/bin/env bash
# Builds dist/DrumRiot.apk with no Gradle / Android Studio needed.
# Requires (Ubuntu/Debian): sudo apt install aapt apksigner dalvik-exchange zipalign android-sdk-platform-23 openjdk-17-jdk python3-pil
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk
ANDROID_JAR=$(ls $SDK/platforms/*/android.jar | sort -V | tail -1)
BT=$(ls -d $SDK/build-tools/* | sort -V | tail -1)
OUT=build; DIST=dist
rm -rf $OUT && mkdir -p $OUT/gen $OUT/obj $OUT/res $DIST

echo "== icons"
python3 app/make_icon.py $OUT/res

echo "== resources"
aapt package -f -m -J $OUT/gen -M app/AndroidManifest.xml -S $OUT/res -A app/assets \
  -I "$ANDROID_JAR" -F $OUT/unsigned.apk -0 arsc

echo "== java"
javac -nowarn -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -d $OUT/obj \
  $(find app/src $OUT/gen -name '*.java') 2>&1 | grep -v 'bootstrap\|source value 8\|target value 8\|To suppress' || true

echo "== dex"
"$BT/dx" --dex --min-sdk-version=21 --output=$OUT/classes.dex $OUT/obj
(cd $OUT && aapt add unsigned.apk classes.dex >/dev/null)

echo "== align + sign"
zipalign -f -p 4 $OUT/unsigned.apk $OUT/aligned.apk
KS=debug.keystore
if [ ! -f $KS ]; then
  keytool -genkeypair -keystore $KS -storepass android -keypass android -alias drumriot \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Drum Riot,O=Drum Riot,C=US" >/dev/null 2>&1
fi
apksigner sign --v4-signing-enabled false --ks $KS --ks-pass pass:android --key-pass pass:android --ks-key-alias drumriot \
  --out $DIST/DrumRiot.apk $OUT/aligned.apk
apksigner verify --print-certs $DIST/DrumRiot.apk | head -1
ls -la $DIST/DrumRiot.apk
