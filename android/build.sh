#!/usr/bin/env bash
# ------------------------------------------------------------
# ساخت APK «سرکار» — کاملاً آفلاین (بدون Android Studio)
# پیش‌نیازها: pip install jdk4py cryptography androguard
#           : tools/apktool.jar (از npm: apktool-jar)
# ------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

JAVA=${JAVA:-/usr/local/lib/python3.11/dist-packages/jdk4py/java-runtime/bin/java}
APKTOOL=tools/apktool.jar
WWW=project/assets/www

echo "== ۱) کپی فایل‌های وب داخل assets =="
rm -rf "$WWW"
mkdir -p "$WWW/icons" "$WWW/css" "$WWW/js"
cp ../index.html "$WWW/index.html"
cp ../css/styles.css "$WWW/css/"
cp ../js/jalali.js ../js/core.js ../js/app.js "$WWW/js/"
cp ../icons/icon-192.png "$WWW/icons/"
# حذف ارجاع به manifest (فقط برای PWA لازم است، نه APK)
sed -i 's#<link rel="manifest"[^>]*>##' "$WWW/index.html"
echo "   فایل‌ها: $(find $WWW -type f | wc -l)"

echo "== ۲) اسمبل APK با apktool (smali → dex + منابع) =="
"$JAVA" -jar "$APKTOOL" b project --output unsigned.apk -q 2>/dev/null || "$JAVA" -jar "$APKTOOL" b project --output unsigned.apk
ls -la unsigned.apk

echo "== ۳) امضا (v1 + v2) و بسته‌بندی نهایی =="
tools/venv/bin/python tools/sign.py unsigned.apk sarkar-v1.0.apk

echo "== ۴) اعتبارسنجی =="
tools/venv/bin/python tools/validate.py sarkar-v1.0.apk

echo
echo "✅ آماده است: $(pwd)/sarkar-v1.0.apk"
