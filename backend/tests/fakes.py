"""Lightweight chainable stand-in for the supabase-py client, for tests.

Mirrors the builder API the services use: db.schema(s).table(t).select(...).
eq(...)...execute(). Every builder method records the call and returns self;
.execute() returns a per-table FakeResp (or a default). Services in this repo
take `db` as a parameter, so tests just pass a FakeDB — no monkeypatching.
"""
from __future__ import annotations


class FakeResp:
    def __init__(self, data=None, count=None):
        self.data = data if data is not None else []
        self.count = count


class _Builder:
    def __init__(self, table: str, db: "FakeDB"):
        self._table = table
        self._db = db

    def __getattr__(self, name):
        # Any builder method (select/eq/in_/upsert/insert/update/delete/single/...)
        def method(*args, **kwargs):
            self._db.calls.append((self._table, name, args, kwargs))
            return self
        return method

    def execute(self):
        self._db.calls.append((self._table, "execute", (), {}))
        return self._db.responses.get(self._table, self._db.default)


class FakeDB:
    def __init__(self, responses=None, default=None):
        self.responses = responses or {}
        self.default = default if default is not None else FakeResp(data=[])
        self.calls: list = []

    def schema(self, *a, **k):
        return self

    def table(self, name: str):
        self.calls.append(("__table__", name, (), {}))
        return _Builder(name, self)
