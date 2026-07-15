"""Cross-space linking: cosine math + the gates that decide a link is created.

The gate that matters most is ownership: gaps are fetched across spaces, so the
only thing keeping one user's artifact from linking to another user's gap is the
user_space_ids filter. That is asserted explicitly below.
"""
import pytest

from infrastructure.services import cross_space_linker as csl
from tests.fakes import FakeDB, FakeResp


def _upserts(db):
    return [args[0] for (t, m, args, kw) in db.calls if m == "upsert"]


def _db_for(artifact_vec, gaps, user_space_ids):
    """FakeDB wired for find_links. All responses are LISTS of rows — the code
    uses .limit(1) + data[0] (not .single(), which raises APIError on 0 rows)."""
    return FakeDB(responses={
        "artifact": FakeResp(data=[{"content_embedding": artifact_vec}]),
        "gap": FakeResp(data=gaps),
        "space": FakeResp(data=[{"id": i} for i in user_space_ids]),
    })


@pytest.fixture
def linker(monkeypatch):
    """find_links resolves its client via get_supabase() rather than taking db,
    so the module-level lookup is what has to be patched."""
    def _make(db):
        monkeypatch.setattr(csl, "get_supabase", lambda: db)
        return csl.CrossSpaceLinker()
    return _make


# ── cosine ───────────────────────────────────────────────────────────────────

def test_cosine_of_identical_vectors_is_one():
    assert csl._cosine([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)


def test_cosine_of_orthogonal_vectors_is_zero():
    assert csl._cosine([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)


def test_cosine_of_opposite_vectors_is_negative_one():
    assert csl._cosine([1.0, 0.0], [-1.0, 0.0]) == pytest.approx(-1.0)


def test_cosine_ignores_magnitude():
    # Normalised by construction, so a scaled vector is the same direction.
    assert csl._cosine([1.0, 0.0], [50.0, 0.0]) == pytest.approx(1.0)


@pytest.mark.parametrize("a, b", [([0.0, 0.0], [1.0, 0.0]), ([1.0, 0.0], [0.0, 0.0]), ([0.0, 0.0], [0.0, 0.0])])
def test_cosine_zero_vector_returns_zero_instead_of_dividing_by_zero(a, b):
    assert csl._cosine(a, b) == 0.0


# ── find_links gates ─────────────────────────────────────────────────────────

async def test_link_created_when_similarity_clears_threshold(linker):
    # cos([1,0], [0.8,0.6]) = 0.8 ≥ 0.72 default threshold.
    db = _db_for([1.0, 0.0], [{"id": 7, "space_id": 2, "gap_text_embedding": [0.8, 0.6]}], user_space_ids=[2])
    await linker(db).find_links(artifact_id=1, user_id="uid", artifact_space_id=1)

    payloads = _upserts(db)
    assert len(payloads) == 1
    link = payloads[0][0]
    assert link["target_gap_id"] == 7
    assert link["source_artifact_id"] == 1
    assert link["user_id"] == "uid"
    assert link["similarity"] == pytest.approx(0.8, abs=1e-3)


async def test_no_link_when_similarity_below_threshold(linker):
    # cos([1,0], [0.6,0.8]) = 0.6 < 0.72.
    db = _db_for([1.0, 0.0], [{"id": 7, "space_id": 2, "gap_text_embedding": [0.6, 0.8]}], user_space_ids=[2])
    await linker(db).find_links(artifact_id=1, user_id="uid", artifact_space_id=1)
    assert _upserts(db) == []


async def test_gap_in_a_space_the_user_does_not_own_is_never_linked(linker):
    """Ownership gate. The gap query spans spaces, so without this filter a
    perfectly-similar gap belonging to someone else would be linked."""
    db = _db_for(
        [1.0, 0.0],
        [{"id": 7, "space_id": 999, "gap_text_embedding": [1.0, 0.0]}],  # similarity 1.0
        user_space_ids=[1, 2],                                            # 999 is not the user's
    )
    await linker(db).find_links(artifact_id=1, user_id="uid", artifact_space_id=1)
    assert _upserts(db) == []


async def test_artifact_without_an_embedding_is_a_no_op(linker):
    db = FakeDB(responses={"artifact": FakeResp(data=[{"content_embedding": None}])})
    await linker(db).find_links(artifact_id=1, user_id="uid", artifact_space_id=1)
    assert _upserts(db) == []


async def test_missing_artifact_row_is_a_no_op(linker):
    db = FakeDB(responses={"artifact": FakeResp(data=None)})
    await linker(db).find_links(artifact_id=1, user_id="uid", artifact_space_id=1)
    assert _upserts(db) == []


async def test_no_open_gaps_is_a_no_op(linker):
    db = _db_for([1.0, 0.0], [], user_space_ids=[2])
    await linker(db).find_links(artifact_id=1, user_id="uid", artifact_space_id=1)
    assert _upserts(db) == []


async def test_only_gaps_outside_the_artifacts_own_space_are_queried(linker):
    """Same-space exclusion is pushed into the query, so assert the filter is
    actually built — an accidental drop would silently self-link a space."""
    db = _db_for([1.0, 0.0], [], user_space_ids=[2])
    await linker(db).find_links(artifact_id=1, user_id="uid", artifact_space_id=1)

    gap_filters = [(m, args) for (t, m, args, kw) in db.calls if t == "gap" and m == "neq"]
    assert ("neq", ("space_id", 1)) in gap_filters
    assert ("neq", ("status", "resolved")) in gap_filters


async def test_all_qualifying_gaps_are_linked_in_one_upsert(linker):
    db = _db_for(
        [1.0, 0.0],
        [
            {"id": 7, "space_id": 2, "gap_text_embedding": [1.0, 0.0]},   # 1.0  → link
            {"id": 8, "space_id": 2, "gap_text_embedding": [0.0, 1.0]},   # 0.0  → skip
            {"id": 9, "space_id": 3, "gap_text_embedding": [0.8, 0.6]},   # 0.8  → link
        ],
        user_space_ids=[2, 3],
    )
    await linker(db).find_links(artifact_id=1, user_id="uid", artifact_space_id=1)

    payloads = _upserts(db)
    assert len(payloads) == 1                                   # batched, not one call per gap
    assert {link["target_gap_id"] for link in payloads[0]} == {7, 9}
