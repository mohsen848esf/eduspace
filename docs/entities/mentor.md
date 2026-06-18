# Persona Entity: Mentor

The `Mentor` entity represents a supporting tutor or class assistant who monitors sessions and supports students.

---

## 1. Purpose

It enables teaching assistance and passive class monitoring, allowing tutors to help students without having permission to edit financial data or alter official class settings.

---

## 2. Relationships

A `Mentor` connects to:
* **User**: Associated via `OrgMember` role mapping (`role.name = 'Mentor'`).
* **AcademyClass**: Assigned as `mentor` (ForeignKey) on zero or more classes.

---

## 3. Lifecycle

1. **Assignment**: Invited to the organization with the `Mentor` role and assigned to support specific classes.
2. **Support**: Joins live rooms, answers student chat questions, views attendance logs, and tracks student grade summaries.
3. **Revocation**: Reassigned to other classes or deactivated by an administrator.
