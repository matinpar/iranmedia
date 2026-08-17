#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""اعتبارسنجی APK با androguard: پارس مانیفست، منابع، دکس و امضاها"""
import sys, hashlib
from loguru import logger
logger.remove()
from androguard.core.apk import APK

path = sys.argv[1]
a = APK(path)

print('[apk]  پکیج:', a.get_package())
print('[apk]  نسخه:', a.get_androidversion_name(), '(code', a.get_androidversion_code() + ')')
print('[apk]  minSdk:', a.get_min_sdk_version(), '| targetSdk:', a.get_target_sdk_version())
print('[apk]  اکتیویتی‌ها:', a.get_activities())
print('[apk]  آیکون:', a.get_app_icon() or '—')
print('[apk]  مجوزها:', a.get_permissions() or 'بدون مجوز')
print('[apk]  امضای v1:', a.is_signed_v1())
print('[apk]  امضای v2:', a.is_signed_v2())

certs_v1 = [c.dump() for c in a.get_certificates_v1()]
certs_v2 = a.get_certificates_der_v2()
print('[apk]  گواهی v1:', len(certs_v1), 'عدد | فینگرپرینت:', hashlib.sha256(certs_v1[0]).hexdigest()[:16] if certs_v1 else '—')
print('[apk]  گواهی v2:', len(certs_v2), 'عدد | فینگرپرینت:', hashlib.sha256(certs_v2[0]).hexdigest()[:16] if certs_v2 else '—')
if certs_v1 and certs_v2:
    assert certs_v1[0] == certs_v2[0], 'گواهی v1 و v2 فرق دارند!'
    print('[apk]  گواهی v1 و v2 یکسان است ✓')

# بررسی دکس
dex_data = a.get_dex()
from androguard.core.dex import DEX
d = DEX(dex_data)
classes = [c.get_name() for c in d.get_classes()]
print('[dex] کلاس‌ها:', classes)
main = [c for c in classes if 'MainActivity' in c or 'Bridge' in c or 'MyChrome' in c]
assert len(main) == 3, 'سه کلاس انتظار می‌رفت!'
# متدها
for c in d.get_classes():
    if 'sarkar' in c.get_name():
        print('[dex]  ', c.get_name(), '→', [m.get_name() for m in c.get_methods()])

# فایل‌های ZIP
import zipfile
z = zipfile.ZipFile(path)
names = z.namelist()
print('[zip] تعداد فایل:', len(names))
assert 'classes.dex' in names and 'AndroidManifest.xml' in names
assert any(n.startswith('assets/www/index.html') for n in names), 'فایل وب پیدا نشد!'
info = z.getinfo('resources.arsc')
print('[zip] resources.arsc: method=%s (0=STORED ✓), offset=%d (%%4=%d)' % (info.compress_type, info.header_offset, info.header_offset % 4))
assert info.compress_type == 0
bad = z.testzip()
assert bad is None, 'CRC خراب: %s' % bad
print('[zip] تست CRC همهٔ فایل‌ها ✓')

print()
print('✅ اعتبارسنجی کامل شد — APK سالم است')
