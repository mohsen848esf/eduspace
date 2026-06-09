# ADR-011: Question Versioning Strategy

## Status

Proposed (For Future Implementation)

## Context

In Sprint C, we successfully introduced soft-deleting (`is_active` flag) and model-level delete safeguards (`ProtectedError`) to prevent physical data loss of historical grading data when questions are removed.

However, a subtle data consistency vulnerability exists when questions are **edited** after students have completed submissions. Since `StudentAnswer` and `AssessmentQuestion` tables reference the same `Question` ID:
1. If a teacher edits a question's text, options, or correct answer key after an exam, the student's submission logs will reference the new modified question state.
2. An auditor reviewing a past student submission would see the student's answers evaluated against a question text or answer key different from what the student actually saw during the exam, causing historical inaccuracy and audit failures.

To preserve the absolute historical integrity of submissions, we need a question versioning strategy.

---

## Proposed Options

### Option A — JSON Snapshotting inside StudentAnswer / AssessmentQuestion

Upon starting an assessment attempt, serialize a static JSON snapshot of the question (text, type, options, correct answer, maximum points) and store it directly in the relationship through-model.

* **Pros**:
  * Lightweight implementation.
  * Relational models and query pipelines remain simple.
  * Zero impact on standard CRUD operations for `Question` authoring.
* **Cons**:
  * Duplicate JSON payloads stored per student attempt, leading to table bloat for large-scale deployments.
  * Harder to run aggregate analytics (e.g. question difficulty trends) across edits.

---

### Option B — Immutable Append-Only Question Versioning (Recommended)

Make the `Question` model append-only. Any update to a question does not modify the existing row. Instead, it inserts a new question row with an incremented version number, pointing to the original question ID as the parent root.

```python
class Question(models.Model):
    # Unique ID for this specific version row
    id = models.BigAutoField(primary_key=True)
    
    # Root identifier grouping all versions of the same logical question
    parent_question = models.ForeignKey(
        'self', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='versions'
    )
    
    version = models.IntegerField(default=1)
    
    # Question attributes...
    text = models.TextField()
    options = models.JSONField(default=list)
```

* **Workflow**:
  * Editing a question creates a new row with `parent_question_id = root_question_id` and `version = current_version + 1`.
  * The `AssessmentQuestion` through-model binds the assessment to the specific, immutable version ID of the question at the time the assessment is published.
  * Submissions and `StudentAnswer` records link to that same immutable version ID.
* **Pros**:
  * Absolute historical integrity: Every version is a distinct, immutable row.
  * Allows robust audit logging and question evolution analytics.
  * Clear data structure.
* **Cons**:
  * Increases query complexity when listing the "latest" version of all questions for question bank UI views.
  * Requires updates to serialization and listing endpoints to default to the latest version of questions.

---

## Proposed Decision

We accept **Option B (Immutable Append-Only Question Versioning)** as our future production direction. 

When implemented:
1. Every edit mutation will result in an insert of a new version row.
2. Published assessments will lock the version ID of all assigned questions.
3. Historical analytics will run against the root `parent_question` ID.

## Target Sprint

Sprint D / Future Release

## Priority

Medium

## Category

Architectural Safeguard / Historical Accuracy Auditing
