# نسخهٔ اندروید (APK) — سرکار

اپ وب «سرکار» داخل یک WebView اندروید بسته‌بندی شده — کاملاً آفلاین، بدون هیچ مجوزی، با پشتیبان‌گیری مستقیم در پوشهٔ Downloads.

## نصب روی گوشی

1. فایل `sarkar-v1.0.apk` را روی گوشی منتقل کن (تلگرام/کابل/بلوتوث/…)
2. روی فایل بزن؛ اگر پرسید، اجازهٔ «نصب از منابع ناشناس» را بده
3. تمام! اپ مثل هر اپ دیگری با آیکون خودش نصب می‌شود

- پکیج: `ir.matinpar.sarkar` — نسخهٔ 1.0 (code 1)
- اندروید ۵ به بالا (minSdk 21، targetSdk 33)
- **بدون هیچ مجوزی** — اینترنت هم نمی‌خواهد
- داده‌ها در حافظهٔ خود اپ ذخیره می‌شوند (localStorage)
- «خروجی پشتیبان» در نسخهٔ اندروید فایل JSON را مستقیم در **Downloads** می‌گذارد و «بازیابی» با انتخاب فایل از گوشی کار می‌کند

## ساخت دوباره (برای توسعه)

```bash
# پیش‌نیاز یک‌باره:
pip install --break-system-packages jdk4py==17.0.9.2   # جاوا
python3 -m venv android/tools/venv
android/tools/venv/bin/pip install androguard cryptography
curl -L -o android/tools/apktool-jar.tgz https://registry.npmjs.org/apktool-jar/-/apktool-jar-2.4.1.tgz
tar xzf android/tools/apktool-jar.tgz -C /tmp && cp /tmp/package/bin/apktool_2.4.1.jar android/tools/apktool.jar

# ساخت:
bash android/build.sh
```

خط لوله:
1. فایل‌های وب (`index.html`, `css/`, `js/`, آیکون) داخل `assets/www` کپی می‌شوند (بدون manifest و service worker)
2. `apktool b` — اسمبل smali → classes.dex و کامپایل منابع (aapt)
3. `tools/sign.py` — بازسازی ZIP با تراز درست + امضای v1 (JAR/PKCS7) و v2 (APK Signature Scheme v2، دقیقاً مطابق apksig) با کلید `keystore/`
4. `tools/validate.py` — اعتبارسنجی کامل با androguard

## مهم: کلید امضا (keystore)

پوشهٔ `keystore/` (key.pem و cert.pem) کلید امضای شخصی این اپ است. برای اینکه نسخه‌های بعدی **روی نسخهٔ فعلی نصب شوند** (بدون حذف و از دست رفتن داده‌ها) باید با همین کلید امضا شوند — پس نگهش دار. اگر این ریپو عمومی است و نگرانی داری، keystore را از ریپو حذف کن و جایی امن نگهش دار.
