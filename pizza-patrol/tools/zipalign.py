"""Minimal zipalign: rewrites an APK so every STORED entry's data starts on a 4-byte boundary.
Usage: python3 zipalign.py in.apk out.apk"""
import sys, zipfile

src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w') as zout:
    for info in zin.infolist():
        data = zin.read(info.filename)
        out = zipfile.ZipInfo(info.filename, date_time=info.date_time)
        out.compress_type = info.compress_type
        out.external_attr = info.external_attr
        if info.compress_type == zipfile.ZIP_STORED:
            header_end = zout.fp.tell() + 30 + len(info.filename.encode('utf-8'))
            out.extra = b'\0' * ((4 - header_end % 4) % 4)
        zout.writestr(out, data)
