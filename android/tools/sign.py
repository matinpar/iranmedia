#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sign.py — بازسازی ZIP با تراز درست + امضای v1 (JAR) + امضای v2 (APK Signature Scheme v2)
بدون نیاز به ابزار گوگل؛ دقیقاً مطابق فرمت apksig (AOSP).
استفاده: python3 sign.py in.apk out.apk
"""
import sys, os, zlib, struct, hashlib, base64, datetime

from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.serialization import pkcs7
from cryptography import x509
from cryptography.x509.oid import NameOID

HERE = os.path.dirname(os.path.abspath(__file__))
KEY_DIR = os.path.join(HERE, '..', 'keystore')
KEY_PEM = os.path.join(KEY_DIR, 'key.pem')
CERT_PEM = os.path.join(KEY_DIR, 'cert.pem')

MAGIC = b'APK Sig Block 42'
V2_BLOCK_ID = 0x7109871a
VERITY_PADDING_BLOCK_ID = 0x42726577
SIG_ALGO_RSA_PKCS1_SHA256 = 0x0103   # CHUNKED_SHA256
CHUNK_SIZE = 1024 * 1024


# ---------------------------------------------------------------- کلید
def load_or_create_key_cert():
    if os.path.exists(KEY_PEM) and os.path.exists(CERT_PEM):
        key = serialization.load_pem_private_key(open(KEY_PEM, 'rb').read(), None)
        cert = x509.load_pem_x509_certificate(open(CERT_PEM, 'rb').read())
        return key, cert
    os.makedirs(KEY_DIR, exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, u'سرکار'),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, u'matinpar'),
        x509.NameAttribute(NameOID.COUNTRY_NAME, u'IQ'),
    ])
    now = datetime.datetime(2026, 1, 1)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=365 * 30))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    open(KEY_PEM, 'wb').write(key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption()))
    open(CERT_PEM, 'wb').write(cert.public_bytes(serialization.Encoding.PEM))
    print('[sign] کلید و گواهی جدید ساخته شد: android/keystore/')
    return key, cert


# ---------------------------------------------------------------- ZIP
def u16(n): return struct.pack('<H', n)
def u32(n): return struct.pack('<I', n)
def u64(n): return struct.pack('<Q', n)

DOS_DATE = 0x0021  # 1980-01-01
DOS_TIME = 0x0000


def build_zip(entries):
    """entries: list of (name, data, force_store). خروجی: بایت‌های ZIP کامل + آفست CD"""
    local = bytearray()
    central = bytearray()
    offset = 0
    for name, data, force_store in entries:
        nb = name.encode('ascii')
        crc = zlib.crc32(data) & 0xffffffff
        if force_store:
            method, cdata = 0, data
        else:
            co = zlib.compressobj(9, zlib.DEFLATED, -15)
            cdata = co.compress(data) + co.flush()
            method = 8
        # تراز ۴ بایتی برای ورودی‌های STORED (resources.arsc و ...)
        if method == 0:
            pad = (4 - ((offset + 30 + len(nb)) % 4)) % 4
        else:
            pad = 0
        extra = b'\x00' * pad
        lh = struct.pack('<IHHHHHIIIHH', 0x04034b50, 20, 0, method, DOS_TIME, DOS_DATE,
                         crc, len(cdata), len(data), len(nb), len(extra)) + nb + extra
        local += lh
        local += cdata
        ch = struct.pack('<IHHHHHHIIIHHHHHII', 0x02014b50, 20, 20, 0, method, DOS_TIME, DOS_DATE,
                         crc, len(cdata), len(data), len(nb), len(extra), 0, 0, 0, 0, offset) + nb + extra
        central += ch
        offset += len(lh) + len(cdata)
    cd_offset = offset
    eocd = struct.pack('<IHHHHIIH', 0x06054b50, 0, 0, len(entries), len(entries),
                       len(central), cd_offset, 0)
    return bytes(local) + bytes(central) + eocd, cd_offset, len(central)


# ---------------------------------------------------------------- v1 (JAR)
def wrap72(s):
    b = s.encode('utf-8')
    lines = []
    while b:
        n = 72 if not lines else 71
        lines.append(b[:n])
        b = b[n:]
    return '\r\n '.join(x.decode('utf-8') for x in lines)


def b64d(data):
    return base64.b64encode(data).decode('ascii')


def make_v1(entries, key, cert):
    """entries: [(name, data)] بدون فایل‌های امضا. خروجی: سه فایل META-INF"""
    mf = 'Manifest-Version: 1.0\r\nCreated-By: 1.0 (Android)\r\n\r\n'
    for name, data in entries:
        mf += wrap72('Name: ' + name) + '\r\n'
        mf += wrap72('SHA-256-Digest: ' + b64d(hashlib.sha256(data).digest())) + '\r\n'
        mf += '\r\n'
    mf_bytes = mf.encode('utf-8')

    sf = ('Signature-Version: 1.0\r\n'
          'Created-By: 1.0 (Android)\r\n'
          'X-Android-APK-Signed: 2\r\n'
          'SHA-256-Digest-Manifest: ' + b64d(hashlib.sha256(mf_bytes).digest()) + '\r\n')
    sf_bytes = sf.encode('utf-8')

    rsa_bytes = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(sf_bytes)
        .add_signer(cert, key, hashes.SHA256())
        .sign(serialization.Encoding.DER, [
            pkcs7.PKCS7Options.DetachedSignature,
            pkcs7.PKCS7Options.Binary,
            pkcs7.PKCS7Options.NoAttributes,
        ])
    )
    return (b'META-INF/MANIFEST.MF', mf_bytes), (b'META-INF/CERT.SF', sf_bytes), (b'META-INF/CERT.RSA', rsa_bytes)


# ---------------------------------------------------------------- v2
def lpe(blob):
    """length-prefixed element (uint32)"""
    return u32(len(blob)) + blob


def chunks_of(data):
    return [data[i:i + CHUNK_SIZE] for i in range(0, len(data), CHUNK_SIZE)] or [b'']


def chunk_digests(section1, cd, eocd_patched):
    all_chunks = []
    for section in (section1, cd, eocd_patched):
        for c in chunks_of(section):
            all_chunks.append(hashlib.sha256(b'\xa5' + u32(len(c)) + c + b'\x5a').digest())
    top = hashlib.sha256(b'\x5a' + u32(len(all_chunks)) + b''.join(all_chunks)).digest()
    return top


def make_v2_block(section1, cd, eocd_patched, key, cert):
    digest = chunk_digests(section1, cd, eocd_patched)

    # signed data = [digests][certs][attrs]
    digests_seq = lpe(u32(SIG_ALGO_RSA_PKCS1_SHA256) + lpe(digest))
    certs_seq = lpe(cert.public_bytes(serialization.Encoding.DER))
    attrs = b''
    signed_data = lpe(digests_seq) + lpe(certs_seq) + lpe(attrs)

    signature = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    sigs_seq = lpe(u32(SIG_ALGO_RSA_PKCS1_SHA256) + lpe(signature))
    pubkey_der = key.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)

    signer = lpe(signed_data) + lpe(sigs_seq) + lpe(pubkey_der)
    v2_value = lpe(lpe(signer))

    pair = u64(4 + len(v2_value)) + u32(V2_BLOCK_ID) + v2_value

    result_size = 8 + len(pair) + 8 + 16
    padding_pair = b''
    if result_size % 4096 != 0:
        pad = 4096 - (result_size % 4096)
        if pad < 12:
            pad += 4096
        padding_pair = u64(pad - 8) + u32(VERITY_PADDING_BLOCK_ID) + b'\x00' * (pad - 12)
        result_size += pad

    block_size = result_size - 8
    block = u64(block_size) + pair + padding_pair + u64(block_size) + MAGIC
    return block


# ---------------------------------------------------------------- اصلی
def sign_apk(in_path, out_path):
    import zipfile
    key, cert = load_or_create_key_cert()

    zin = zipfile.ZipFile(in_path)
    names = zin.namelist()
    app_entries = [(n, zin.read(n)) for n in names if not n.startswith('META-INF/')]

    # ترتیب: مانیفست، دکس، منابع، بقیه؛ META-INF آخر
    def order(n):
        if n == 'AndroidManifest.xml': return (0, n)
        if n == 'classes.dex': return (1, n)
        if n == 'resources.arsc': return (2, n)
        return (3, n)
    app_entries.sort(key=lambda t: order(t[0]))

    v1 = make_v1([(n, d) for n, d in app_entries], key, cert)

    zip_entries = [(n, d, n.endswith('.arsc')) for n, d in app_entries]
    zip_entries += [(n.decode(), d, False) for n, d in v1]

    zip_bytes, cd_offset, cd_size = build_zip(zip_entries)

    section1 = zip_bytes[:cd_offset]
    cd = zip_bytes[cd_offset:cd_offset + cd_size]
    eocd = zip_bytes[cd_offset + cd_size:]
    assert len(eocd) == 22, 'EOCD طول غیرمنتظره دارد'

    # هضم v2: فیلد آفست CD در EOCD باید برابر «آفست بلوک امضا» باشد
    eocd_patched = bytearray(eocd)
    eocd_patched[16:20] = u32(cd_offset)

    block = make_v2_block(section1, cd, bytes(eocd_patched), key, cert)

    # خروجی نهایی: ورودی‌ها + بلوک امضا + CD + EOCD(اصلاح‌شده با اندازهٔ بلوک)
    final_eocd = bytearray(eocd)
    final_eocd[16:20] = u32(cd_offset + len(block))
    with open(out_path, 'wb') as f:
        f.write(section1 + block + cd + bytes(final_eocd))

    print('[sign] APK امضا شد: %s (%.1f KB)' % (out_path, os.path.getsize(out_path) / 1024))

    # ---- خودآزمایی امضا ----
    pub = key.public_key()
    # v2 را دوباره از فایل نهایی جدا کن و امضا را وارسی کن
    with open(out_path, 'rb') as f:
        data = f.read()
    eocd_pos = data.rfind(b'PK\x05\x06')
    cd_start = struct.unpack('<I', data[eocd_pos + 16:eocd_pos + 20])[0]
    assert data[cd_start - len(MAGIC):cd_start] == MAGIC, 'magic پیدا نشد'
    size = struct.unpack('<Q', data[cd_start - 24:cd_start - 16])[0]
    block_start = cd_start - 8 - size
    size2 = struct.unpack('<Q', data[block_start:block_start + 8])[0]
    assert size == size2, 'اندازهٔ بلوک امضا ناسازگار'
    # جفت‌ها
    p = block_start + 8
    found = False
    while p < cd_start - 24:
        plen = struct.unpack('<Q', data[p:p + 8])[0]
        pid = struct.unpack('<I', data[p + 8:p + 12])[0]
        val = data[p + 12:p + plen]
        if pid == V2_BLOCK_ID:
            found = True
            # signer → signedData → verify
            q = 4  # بعد از size_sequence
            signer_len = struct.unpack('<I', val[q:q + 4])[0]
            q += 4
            sd_len = struct.unpack('<I', val[q:q + 4])[0]
            signed_data = val[q + 4:q + 4 + sd_len]
            q2 = q + 4 + sd_len
            sigs_len = struct.unpack('<I', val[q2:q2 + 4])[0]
            sq = q2 + 4
            rec_len = struct.unpack('<I', val[sq:sq + 4])[0]
            algo = struct.unpack('<I', val[sq + 4:sq + 8])[0]
            sig_len = struct.unpack('<I', val[sq + 8:sq + 12])[0]
            sig = val[sq + 12:sq + 12 + sig_len]
            assert algo == SIG_ALGO_RSA_PKCS1_SHA256
            pub.verify(sig, signed_data, padding.PKCS1v15(), hashes.SHA256())
            print('[sign] وارسی v2: امضای RSA روی signed-data درست است ✓')
        p += plen
    assert found, 'بلوک v2 پیدا نشد'
    # هضم v2 فایل نهایی را بازتولید و مقایسه کن
    s1 = data[:block_start]
    real_cd_off = cd_start
    top = chunk_digests(s1, data[real_cd_off:eocd_pos], patch_eocd_cdoff(data[eocd_pos:], block_start))
    # digest ذخیره‌شده:
    print('[sign] وارسی هضم تکه‌ای v2 …', 'تطابق ✓' if top == extract_digest(data) else 'عدم تطابق ✗')
    if top != extract_digest(data):
        raise SystemExit('هضم v2 مطابقت ندارد!')


def patch_eocd_cdoff(eocd, new_off):
    e = bytearray(eocd)
    e[16:20] = u32(new_off)
    return bytes(e)


def extract_digest(data):
    eocd_pos = data.rfind(b'PK\x05\x06')
    cd_start = struct.unpack('<I', data[eocd_pos + 16:eocd_pos + 20])[0]
    size = struct.unpack('<Q', data[cd_start - 24:cd_start - 16])[0]
    block_start = cd_start - 8 - size
    p = block_start + 8
    while p < cd_start - 24:
        plen = struct.unpack('<Q', data[p:p + 8])[0]
        pid = struct.unpack('<I', data[p + 8:p + 12])[0]
        if pid == V2_BLOCK_ID:
            val = data[p + 12:p + plen]
            q = 4
            q += 4  # signer len
            sd_len = struct.unpack('<I', val[q:q + 4])[0]
            signed_data = val[q + 4:q + 4 + sd_len]
            # digests
            dg_len = struct.unpack('<I', signed_data[:4])[0]
            rec = signed_data[4:4 + dg_len]
            rec_elem_len = struct.unpack('<I', rec[:4])[0]
            algo = struct.unpack('<I', rec[4:8])[0]
            dlen = struct.unpack('<I', rec[8:12])[0]
            return rec[12:12 + dlen]
        p += plen
    raise SystemExit('digest پیدا نشد')


if __name__ == '__main__':
    sign_apk(sys.argv[1], sys.argv[2])
