# coding: utf-8 -*-
import os
import stat
import sys
from os import path
from sys import stdout, stderr


class B:
    def __init__(self, value):
        self.value = value

    def __repr__(self):
        return 'true' if self.value else 'false'


class S():
    def __init__(self, value):
        self.value = value

    def __repr__(self):
        if self.value is None:
            return 'null'
        escaped = "".join(map(lambda i: S.escape_ch(self.value[i]), range(0, len(self.value))))
        return '"' + escaped + '"'

    @staticmethod
    def escape_ch(ch):
        # type: (str) -> str
        if ch in '\x08\x09\x0a\x0c\x0d\x22\x2f\x5c':
            return '\\' + ch
        else:
            return ch


def file_item(parent, name):
    # type: (str, str) -> dict
    abspath = path.join(parent, name)
    lstat = os.lstat(abspath)

    item = {
        S('name'): S(name),
        S('abspath'): S(abspath)
    }
    if stat.S_ISLNK(lstat.st_mode):
        target = None
        broken = False
        try:
            target = os.readlink(abspath)
            lstat = os.stat(abspath)
        except OSError:
            broken = True
        item[S('link')] = {
            S('target'): S(target),
            S('broken'): B(broken)
        }
    item[S('stat')] = {
        S('mode'): lstat.st_mode,
        S('uid'): lstat.st_uid,
        S('gid'): lstat.st_gid,
        S('size'): int(lstat.st_size),
        S('atime'): lstat.st_atime,
        S('mtime'): lstat.st_mtime,
        S('ctime'): lstat.st_ctime,
    }
    return item


if __name__ == '__main__':
    d = sys.argv[1]
    entries = []
    try:
        entries = os.listdir(d)
    except OSError as e:
        stderr.write(str({S('errno'): e.errno, S('message'): S(e.strerror)}))
        exit(1)
    stdout.write(str(list(map(lambda x: file_item(d, x), entries))))
