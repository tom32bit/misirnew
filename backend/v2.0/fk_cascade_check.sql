-- ============================================================================
-- FK delete-rule audit + repair for the misir schema.
--
-- WHY: the API's delete paths (DELETE /spaces/{id}, DELETE /artifacts/{id},
-- DELETE /me) rely on the ON DELETE rules defined in schema.sql instead of
-- manually deleting every child table. If the live database was created from
-- an older schema (or a constraint was ever recreated by hand without its
-- ON DELETE clause), those deletes fail with an FK violation (error 23503).
--
-- HOW TO RUN (Supabase Dashboard → SQL Editor):
--   Both parts are fully self-contained single statements (the expected-rule
--   list is inlined in each) — no session state, safe under pgbouncer.
--   1. Run PART 1. Every row should say "ok". Done? Stop here.
--   2. If any row says "WRONG RULE", run PART 2 — it recreates ONLY the
--      mismatched constraints with the expected rule (idempotent; a clean DB
--      is a no-op). Re-run PART 1 to confirm.
--   3. A "FK MISSING" row means the column has NO foreign key at all — that
--      is not auto-repaired (orphan rows may exist and would block ADD
--      CONSTRAINT). Investigate manually against schema.sql.
--
-- The expected lists below mirror backend/v2.0/schema.sql exactly.
-- ============================================================================


-- ============================================================================
-- PART 1 — AUDIT (read-only). Expect "ok" on every row.
-- ============================================================================
WITH expected (child_table, child_column, parent_table, delete_rule) AS (
    VALUES
        ('profile',             'id',                 'auth_user',         'CASCADE'),
        ('space',               'user_id',            'auth_user',         'CASCADE'),
        ('subspace',            'space_id',           'space',             'CASCADE'),
        ('marker',              'space_id',           'space',             'CASCADE'),
        ('subspace_marker',     'subspace_id',        'subspace',          'CASCADE'),
        ('subspace_marker',     'marker_id',          'marker',            'CASCADE'),
        ('artifact',            'user_id',            'auth_user',         'CASCADE'),
        ('artifact',            'space_id',           'space',             'SET NULL'),
        ('artifact',            'subspace_id',        'subspace',          'SET NULL'),
        ('artifact_open_event', 'artifact_id',        'artifact',          'CASCADE'),
        ('artifact_open_event', 'user_id',            'auth_user',         'CASCADE'),
        ('artifact_tag',        'artifact_id',        'artifact',          'CASCADE'),
        ('deadline',            'user_id',            'auth_user',         'CASCADE'),
        ('deadline',            'space_id',           'space',             'CASCADE'),
        ('gap',                 'space_id',           'space',             'CASCADE'),
        ('gap',                 'subspace_id',        'subspace',          'SET NULL'),
        ('nudge',               'user_id',            'auth_user',         'CASCADE'),
        ('nudge',               'space_id',           'space',             'CASCADE'),
        ('cross_space_link',    'user_id',            'auth_user',         'CASCADE'),
        ('cross_space_link',    'source_artifact_id', 'artifact',          'CASCADE'),
        ('cross_space_link',    'target_gap_id',      'gap',               'CASCADE'),
        ('source_synthesis',    'artifact_id',        'artifact',          'CASCADE'),
        ('space_summary',       'space_id',           'space',             'CASCADE'),
        ('report',              'user_id',            'auth_user',         'CASCADE'),
        ('report',              'space_id',           'space',             'CASCADE'),
        ('chat_conversation',   'user_id',            'auth_user',         'CASCADE'),
        ('chat_conversation',   'space_id',           'space',             'SET NULL'),
        ('chat_message',        'conversation_id',    'chat_conversation', 'CASCADE'),
        ('session',             'user_id',            'auth_user',         'CASCADE'),
        ('consent',             'user_id',            'auth_user',         'CASCADE'),
        ('audit_log',           'user_id',            'auth_user',         'SET NULL')
),
actual AS (
    SELECT
        c.conname,
        rel.relname                        AS child_table,
        att.attname                        AS child_column,
        frel.relname                       AS parent_table,
        CASE c.confdeltype
            WHEN 'a' THEN 'NO ACTION'
            WHEN 'r' THEN 'RESTRICT'
            WHEN 'c' THEN 'CASCADE'
            WHEN 'n' THEN 'SET NULL'
            WHEN 'd' THEN 'SET DEFAULT'
        END                                AS delete_rule
    FROM pg_constraint c
    JOIN pg_class     rel  ON rel.oid  = c.conrelid
    JOIN pg_class     frel ON frel.oid = c.confrelid
    JOIN pg_namespace n    ON n.oid    = rel.relnamespace
    CROSS JOIN LATERAL unnest(c.conkey) AS k(attnum)
    JOIN pg_attribute att  ON att.attrelid = c.conrelid AND att.attnum = k.attnum
    WHERE c.contype = 'f' AND n.nspname = 'misir'
)
SELECT
    e.child_table,
    e.child_column,
    e.parent_table,
    e.delete_rule                 AS expected_rule,
    a.delete_rule                 AS actual_rule,
    a.conname                     AS constraint_name,
    CASE
        WHEN a.conname IS NULL                THEN 'FK MISSING — fix manually (see header)'
        WHEN a.delete_rule = e.delete_rule    THEN 'ok'
        ELSE 'WRONG RULE — run PART 2'
    END                           AS status
FROM expected e
LEFT JOIN actual a
       ON a.child_table  = e.child_table
      AND a.child_column = e.child_column
      AND a.parent_table = e.parent_table
ORDER BY (a.conname IS NULL OR a.delete_rule IS DISTINCT FROM e.delete_rule) DESC,
         e.child_table, e.child_column;


-- ============================================================================
-- PART 2 — REPAIR. Recreates ONLY constraints whose delete rule differs from
-- the expected list. Idempotent: on a healthy database it alters nothing.
-- Runs in one transaction (DO block) — an error rolls everything back.
-- ============================================================================
DO $$
DECLARE
    r      RECORD;
    newdef TEXT;
BEGIN
    FOR r IN
        SELECT
            c.conname,
            n.nspname,
            rel.relname                  AS child_table,
            e.delete_rule                AS expected_rule,
            pg_get_constraintdef(c.oid)  AS def
        FROM pg_constraint c
        JOIN pg_class     rel  ON rel.oid  = c.conrelid
        JOIN pg_class     frel ON frel.oid = c.confrelid
        JOIN pg_namespace n    ON n.oid    = rel.relnamespace
        CROSS JOIN LATERAL unnest(c.conkey) AS k(attnum)
        JOIN pg_attribute att  ON att.attrelid = c.conrelid AND att.attnum = k.attnum
        JOIN (
            VALUES
                ('profile',             'id',                 'auth_user',         'CASCADE'),
                ('space',               'user_id',            'auth_user',         'CASCADE'),
                ('subspace',            'space_id',           'space',             'CASCADE'),
                ('marker',              'space_id',           'space',             'CASCADE'),
                ('subspace_marker',     'subspace_id',        'subspace',          'CASCADE'),
                ('subspace_marker',     'marker_id',          'marker',            'CASCADE'),
                ('artifact',            'user_id',            'auth_user',         'CASCADE'),
                ('artifact',            'space_id',           'space',             'SET NULL'),
                ('artifact',            'subspace_id',        'subspace',          'SET NULL'),
                ('artifact_open_event', 'artifact_id',        'artifact',          'CASCADE'),
                ('artifact_open_event', 'user_id',            'auth_user',         'CASCADE'),
                ('artifact_tag',        'artifact_id',        'artifact',          'CASCADE'),
                ('deadline',            'user_id',            'auth_user',         'CASCADE'),
                ('deadline',            'space_id',           'space',             'CASCADE'),
                ('gap',                 'space_id',           'space',             'CASCADE'),
                ('gap',                 'subspace_id',        'subspace',          'SET NULL'),
                ('nudge',               'user_id',            'auth_user',         'CASCADE'),
                ('nudge',               'space_id',           'space',             'CASCADE'),
                ('cross_space_link',    'user_id',            'auth_user',         'CASCADE'),
                ('cross_space_link',    'source_artifact_id', 'artifact',          'CASCADE'),
                ('cross_space_link',    'target_gap_id',      'gap',               'CASCADE'),
                ('source_synthesis',    'artifact_id',        'artifact',          'CASCADE'),
                ('space_summary',       'space_id',           'space',             'CASCADE'),
                ('report',              'user_id',            'auth_user',         'CASCADE'),
                ('report',              'space_id',           'space',             'CASCADE'),
                ('chat_conversation',   'user_id',            'auth_user',         'CASCADE'),
                ('chat_conversation',   'space_id',           'space',             'SET NULL'),
                ('chat_message',        'conversation_id',    'chat_conversation', 'CASCADE'),
                ('session',             'user_id',            'auth_user',         'CASCADE'),
                ('consent',             'user_id',            'auth_user',         'CASCADE'),
                ('audit_log',           'user_id',            'auth_user',         'SET NULL')
        ) AS e(child_table, child_column, parent_table, delete_rule)
              ON e.child_table  = rel.relname
             AND e.child_column = att.attname
             AND e.parent_table = frel.relname
        WHERE c.contype = 'f'
          AND n.nspname = 'misir'
          AND CASE c.confdeltype
                  WHEN 'a' THEN 'NO ACTION'
                  WHEN 'r' THEN 'RESTRICT'
                  WHEN 'c' THEN 'CASCADE'
                  WHEN 'n' THEN 'SET NULL'
                  WHEN 'd' THEN 'SET DEFAULT'
              END IS DISTINCT FROM e.delete_rule
    LOOP
        -- Take the live definition, strip any existing ON DELETE clause, and
        -- append the expected one. ADD CONSTRAINT revalidates existing rows,
        -- which is safe here: changing only the delete rule never invalidates
        -- data that already satisfied the FK.
        -- (Assumes plain clauses as in schema.sql — no DEFERRABLE and no
        -- PG15+ "SET NULL (col-list)" forms, neither of which misir uses.)
        newdef := regexp_replace(
            r.def,
            '\s+ON DELETE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)',
            '', 'i'
        );
        newdef := newdef || ' ON DELETE ' || r.expected_rule;

        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                       r.nspname, r.child_table, r.conname);
        EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
                       r.nspname, r.child_table, r.conname, newdef);

        RAISE NOTICE 'Fixed %.%.% -> ON DELETE %',
            r.nspname, r.child_table, r.conname, r.expected_rule;
    END LOOP;

    RAISE NOTICE 'FK delete-rule repair pass complete.';
END $$;
