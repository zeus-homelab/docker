#!/usr/bin/env bash
# Builds dist/ZanesNightmarePizzaShop.apk without the Android SDK, using only artifacts from Maven Central:
#   aapt2 + framework resources (bundled in apktool-lib), dalvik-dx (dexer), apksig (signer),
#   and the android API stub jar for javac. Needs: JDK 11+, curl, unzip, zip.
set -euo pipefail
cd "$(dirname "$0")"
TOOLS=.tools; OUT=build; DIST=dist
M=https://repo1.maven.org/maven2
mkdir -p "$TOOLS" "$DIST"

fetch() { [ -s "$TOOLS/$2" ] || { echo "Downloading $2"; curl -fsSL -o "$TOOLS/$2" "$1"; }; }
fetch $M/org/apktool/apktool-lib/3.0.3/apktool-lib-3.0.3.jar apktool-lib.jar
fetch $M/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar dx.jar
fetch $M/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar apksig.jar
fetch $M/com/google/android/android/4.1.1.4/android-4.1.1.4.jar android-api.jar
if [ ! -x "$TOOLS/aapt2" ]; then
  (cd "$TOOLS" && unzip -o -q apktool-lib.jar prebuilt/linux/aapt2 prebuilt/android-framework.jar \
    && mv prebuilt/linux/aapt2 aapt2 && mv prebuilt/android-framework.jar android-framework.jar \
    && rm -rf prebuilt && chmod +x aapt2)
fi

rm -rf "$OUT"; mkdir -p "$OUT/classes" "$OUT/gen" "$OUT/signer"

echo "== resources"
"$TOOLS/aapt2" compile --dir app/res -o "$OUT/res.zip"
"$TOOLS/aapt2" link -o "$OUT/unsigned.apk" -I "$TOOLS/android-framework.jar" \
  --manifest app/AndroidManifest.xml -A app/assets --java "$OUT/gen" \
  --min-sdk-version 24 --target-sdk-version 34 "$OUT/res.zip"

echo "== java -> dex"
javac --release 8 -nowarn -cp "$TOOLS/android-api.jar" -d "$OUT/classes" $(find app/src "$OUT/gen" -name '*.java')
java -cp "$TOOLS/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && zip -q -j unsigned.apk classes.dex)
python3 tools/zipalign.py "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "== sign"
KS=${KEYSTORE:-pizza-patrol.p12}; PASS=${KEYSTORE_PASS:-pizzapatrol}
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storetype PKCS12 -storepass "$PASS" -keypass "$PASS" -alias pizzapatrol \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Midnight Pizza Patrol" >/dev/null 2>&1
fi
javac --release 8 -nowarn -cp "$TOOLS/apksig.jar" -d "$OUT/signer" tools/Sign.java
java --add-exports java.base/sun.security.x509=ALL-UNNAMED \
  --add-exports java.base/sun.security.util=ALL-UNNAMED -cp "$TOOLS/apksig.jar:$OUT/signer" Sign "$KS" "$PASS" pizzapatrol "$OUT/aligned.apk" "$DIST/ZanesNightmarePizzaShop.apk"
echo "Built $DIST/ZanesNightmarePizzaShop.apk ($(du -h "$DIST/ZanesNightmarePizzaShop.apk" | cut -f1))"
