---
phase: 01-critical-bugs
plan: 02
subsystem: database
tags: [sqlalchemy, cascade, fastapi, postgresql]

# Dependency graph
requires:
  - phase: none
    provides: existing Destination and TravelSegment models
provides:
  - Working destination deletion with cascade to travel segments
  - Raw SQL DELETE approach bypassing ORM cascade issues
affects: [any future travel segment relationships, destination management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw SQL for deletes with bidirectional FKs to same table"
    - "Database CASCADE over ORM cascade for complex relationships"

key-files:
  created: []
  modified:
    - app/models/destination.py
    - app/models/travel_segment.py
    - app/api/destinations.py
    - Dockerfile

key-decisions:
  - "Use raw SQL DELETE instead of ORM session.delete() for destinations"
  - "Remove SQLAlchemy relationships for TravelSegment<->Destination to avoid cascade conflicts"
  - "Rely on database-level CASCADE (ondelete=CASCADE on FKs) instead of ORM cascade"

patterns-established:
  - "Raw SQL DELETE for tables with bidirectional FK relationships"
  - "Database CASCADE preferred over ORM cascade for self-referential-like patterns"

# Metrics
duration: 21min
completed: 2026-02-02
---

# Phase 01 Plan 02: Destination Deletion Cascade Fix Summary

**Raw SQL DELETE for destination deletion, bypassing SQLAlchemy ORM cascade issues with TravelSegment bidirectional foreign keys**

## Performance

- **Duration:** 21 min
- **Started:** 2026-02-02T16:47:11Z
- **Completed:** 2026-02-02T17:08:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed BUG-01: Users can now delete destinations without errors
- Travel segments cascade properly when destination is deleted
- No orphaned records after deletion
- 404 correctly returned for non-existent destinations

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix cascade relationships and delete endpoint** - `745bddd` (fix)
2. **Dockerfile fix** - `6365126` (chore)

Initial attempt `8b2585c` added ORM relationships but was superseded by `745bddd` which uses raw SQL.

## Files Created/Modified
- `app/models/destination.py` - Removed travel segment relationships, added documentation explaining why
- `app/models/travel_segment.py` - Removed relationships to Destination, added documentation
- `app/api/destinations.py` - Use engine.connect() with raw SQL DELETE
- `Dockerfile` - Fixed package names for Debian trixie compatibility

## Decisions Made
- **Raw SQL over ORM delete:** SQLAlchemy's session.delete() causes issues with bidirectional FKs because it tries to set one FK to NULL instead of cascading. Using raw SQL (`DELETE FROM destinations WHERE id = :id`) with direct engine connection completely bypasses ORM cascade handling.
- **Database CASCADE:** The database-level CASCADE (ondelete="CASCADE" on TravelSegment foreign keys) handles deletion correctly. PostgreSQL automatically deletes travel_segments when referenced destination is deleted.
- **Remove relationships:** Removed the `from_destination` and `to_destination` relationships from TravelSegment model to prevent any ORM cascade interference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Initial ORM relationship approach failed**
- **Found during:** Task 1 (testing after adding cascade relationships)
- **Issue:** Adding `cascade="all, delete-orphan"` to relationships caused SQLAlchemy to issue UPDATE setting FK to NULL before DELETE, violating NOT NULL constraint
- **Fix:** Removed ORM relationships entirely, switched to raw SQL DELETE with direct engine connection
- **Files modified:** app/models/destination.py, app/models/travel_segment.py, app/api/destinations.py
- **Verification:** Direct Python test confirmed cascade works, then API test confirmed endpoint works
- **Committed in:** 745bddd

**2. [Rule 3 - Blocking] Dockerfile package names outdated**
- **Found during:** Task 2 (rebuilding Docker image to test fix)
- **Issue:** Package names like `libgdal32` and `libspatialindex6` not found in Debian trixie
- **Fix:** Changed to `-dev` packages which are available across Debian versions
- **Files modified:** Dockerfile
- **Verification:** Docker build succeeds
- **Committed in:** 6365126

---

**Total deviations:** 2 auto-fixed (both blocking)
**Impact on plan:** The plan's approach (add cascade relationships) didn't work due to SQLAlchemy's cascade behavior with bidirectional FKs. The alternative approach (raw SQL) achieves the same goal more reliably.

## Issues Encountered
- SQLAlchemy ORM cascade handling with bidirectional foreign keys (both from_destination_id and to_destination_id referencing same table) causes UPDATE before DELETE, attempting to set FK to NULL
- Even with `passive_deletes=True` and `viewonly=True`, ORM still intercepted deletions
- Solution was to completely bypass ORM by using raw SQL with direct engine connection

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Destination deletion now works correctly
- All related travel segments are cascaded
- Ready for other critical bug fixes in Phase 01
- Pattern established for handling similar bidirectional FK deletion scenarios

---
*Phase: 01-critical-bugs*
*Completed: 2026-02-02*
