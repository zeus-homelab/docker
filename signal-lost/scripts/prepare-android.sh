#!/usr/bin/env bash
# Patches the generated Capacitor Android project: portrait lock, fullscreen, game icon + splash.
# Run from signal-lost/ after `npx cap add android`. Needs ImageMagick (convert).
set -euo pipefail
RES=android/app/src/main/res
MANIFEST=android/app/src/main/AndroidManifest.xml
ICON=web/icons/icon-512.png

# Portrait only
if ! grep -q 'screenOrientation' "$MANIFEST"; then
  sed -i 's|android:name=".MainActivity"|android:name=".MainActivity"\n            android:screenOrientation="portrait"|' "$MANIFEST"
fi

# Fullscreen, dark window background
grep -q windowFullscreen "$RES/values/styles.xml" || sed -i 's|<item name="android:background">@null</item>|<item name="android:background">@null</item>\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowBackground">@android:color/black</item>|' "$RES/values/styles.xml"

# Launcher icons (plain PNGs, drop the adaptive XML so ours is used)
rm -rf "$RES/mipmap-anydpi-v26"
for pair in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  d=${pair%%:*}; s=${pair##*:}
  convert "$ICON" -resize "${s}x${s}" "$RES/mipmap-$d/ic_launcher.png"
  convert "$ICON" -resize "${s}x${s}" "$RES/mipmap-$d/ic_launcher_round.png"
  rm -f "$RES/mipmap-$d/ic_launcher_foreground.png"
done

# Splash: dark background with the icon in the middle
for f in $(find "$RES" -name 'splash.png'); do
  wh=$(identify -format '%w %h' "$f")
  w=${wh% *}; h=${wh#* }
  s=$(( (w < h ? w : h) / 3 ))
  convert -size "${w}x${h}" xc:'#05060c' \( "$ICON" -resize "${s}x${s}" \) -gravity center -composite "$f"
done
echo "Android project patched."
