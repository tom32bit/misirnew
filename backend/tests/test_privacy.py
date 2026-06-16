"""Privacy / DSAR: consent (incl. GPC), erasure ownership, export, retention."""
import pytest
from fastapi import HTTPException

from infrastructure.services import account_service, consent_service, retention_service
from interfaces.api.subspaces import _assert_space_owned
from tests.fakes import FakeDB, FakeResp


def _last_upsert(db):
    return next(payload for (t, m, args, kw) in db.calls if m == "upsert" for payload in [args[0]])


def test_consent_gpc_forces_optout():
    db = FakeDB()
    consent_service.set_consent(db, "uid", "web_capture", granted=True, gpc=True)
    payload = _last_upsert(db)
    assert payload["granted"] is False   # GPC overrides the requested grant
    assert payload["gpc"] is True


def test_consent_granted_without_gpc():
    db = FakeDB()
    consent_service.set_consent(db, "uid", "web_capture", granted=True, gpc=False)
    assert _last_upsert(db)["granted"] is True


def test_set_consent_rejects_unknown_purpose():
    with pytest.raises(ValueError):
        consent_service.set_consent(FakeDB(), "uid", "not_a_purpose", granted=True)


def test_has_consent_true_and_false():
    db = FakeDB(responses={"consent": FakeResp(data=[{"granted": True}])})
    assert consent_service.has_consent(db, "uid", "web_capture") is True
    assert consent_service.has_consent(FakeDB(), "uid", "web_capture") is False


def test_export_omits_embeddings_includes_tags_and_sessions():
    db = FakeDB()
    out = account_service.export_user_data(db, "uid")
    assert {"artifacts", "artifact_tags", "sessions", "consents"} <= set(out)
    art_select = next(args[0] for (t, m, args, kw) in db.calls if t == "artifact" and m == "select")
    assert "content_embedding" not in art_select       # embeddings excluded
    assert "extracted_text" in art_select


def test_retention_purge_counts():
    db = FakeDB(responses={
        "artifact": FakeResp(data=[{}, {}]),
        "gap": FakeResp(data=[{}]),
        "nudge": FakeResp(data=[]),
    })
    res = retention_service.purge_expired(db, retention_days=30)
    assert res["artifacts_deleted"] == 2
    assert res["gaps_deleted"] == 1
    assert res["nudges_deleted"] == 0
    assert res["retention_days"] == 30


def test_assert_space_owned_rejects_unowned():
    with pytest.raises(HTTPException) as ei:
        _assert_space_owned(FakeDB(), 1, "uid")          # no row → 404
    assert ei.value.status_code == 404


def test_assert_space_owned_allows_owner():
    db = FakeDB(responses={"space": FakeResp(data=[{"id": 1}])})
    _assert_space_owned(db, 1, "uid")                     # no raise
