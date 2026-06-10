# ADR-012: Assessment Query Optimization Strategy

## Status

Accepted

## Context

During the architectural review of Task C.3 (Assessment Serializers & Permissions), it was highlighted that the nested serializer structures used in listing and retrieving assessments and student submissions are vulnerable to **N+1 query explosions**.

Specifically:
- Listing `Assessment` objects with nested `AssessmentQuestion` and `Question` records.
- Listing `Submission` objects with nested `StudentAnswer` and `Question` records.

Without explicit queryset optimization, serializing $N$ resources would execute $2N$ or more database queries, causing severe performance degradation for large-scale deployments.

## Decision

We will enforce eager loading and query prefetching constraints inside the viewsets developed in Task C.4:

1. **Assessment ViewSets**:
   - MUST use `prefetch_related` for M2M through-model relations (`assessmentquestion_set` and `assessmentquestion_set__question`).
   - MUST use `select_related` for related models (such as `session` or `organization`).
2. **Submission ViewSets**:
   - MUST use `select_related` for foreign key relationships (`student`, `graded_by`, `assessment`).
   - MUST use `prefetch_related` for student answers and nested question metadata (`answers`, `answers__question`).
3. **Prevent N+1 Regressions**:
   - Integration tests in C.4 must assert query counts using `assertNumQueries` or assert query boundaries to prevent regressions as nested models grow.

## Consequences

### Positive
- Minimizes query count to a constant boundary ($O(1)$ queries) for listing/retrieving operations.
- Safe scaling for multi-tenant organizations serving thousands of concurrent exam submissions.
- Catches potential database bottlenecks automatically during the automated test suite execution.

### Negative
- Query structures are slightly more verbose to write and maintain in DRF viewsets.

## Target Sprint

Sprint C.4

## Priority

High

## Category

Performance Optimization / Database Query Hardening
