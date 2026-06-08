from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = 'student', 'Student'
        TEACHER = 'teacher', 'Teacher'
        ADMIN = 'admin', 'Admin'

    full_name = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    is_online = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.username} ({self.role})"



class Notification(models.Model):
    """
    Persistent record of a notification delivered to a user.

    Every WebSocket push (room invites, recording publishes, recording
    permission changes, etc.) also creates one of these so the user can
    catch up on anything they missed while offline.

    ``payload`` is the same JSON blob sent over the WS, minus runtime
    bookkeeping fields. It includes ``type`` so the frontend renders
    the correct row.

    ``read_at`` is the timestamp when the user marked the entry as
    read; null until then. ``delivered_at`` is when the push was
    attempted in real time — useful as a tie-breaker if a user has
    multiple sessions and we ever want per-session read state, but
    today it's mostly informational.
    """

    class Kind(models.TextChoices):
        ROOM_INVITE = 'ROOM_INVITE', 'Room invite'
        RECORDING_PUBLISHED = 'RECORDING_PUBLISHED', 'Recording published'
        RECORDING_PERMISSION_GRANTED = (
            'RECORDING_PERMISSION_GRANTED', 'Recording permission granted'
        )
        RECORDING_PERMISSION_REVOKED = (
            'RECORDING_PERMISSION_REVOKED', 'Recording permission revoked'
        )

    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    kind = models.CharField(max_length=64, choices=Kind.choices)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # Inbox is rendered most-recent-first, and we filter by user
        # heavily — this index is the only one the inbox endpoint
        # touches.
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification({self.kind} -> {self.user.username})"

    def mark_read(self):
        if self.read_at is None:
            from django.utils import timezone
            self.read_at = timezone.now()
            self.save(update_fields=['read_at'])


# ---------------------------------------------------------------------------
# Core Multi-Tenant RBAC Models
# ---------------------------------------------------------------------------

class Organization(models.Model):
    class OrgType(models.TextChoices):
        PERSONAL = 'personal', 'Personal'
        ORGANIZATION = 'organization', 'Organization'

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    type = models.CharField(max_length=20, choices=OrgType.choices, default=OrgType.ORGANIZATION)
    owner = models.ForeignKey('User', on_delete=models.PROTECT, related_name='owned_organizations')
    is_active = models.BooleanField(default=True)
    logo = models.ImageField(upload_to='org_logos/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Permission(models.Model):
    codename = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')

    def __str__(self):
        return self.name


class Role(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    organization = models.ForeignKey(Organization, null=True, blank=True, on_delete=models.CASCADE, related_name='custom_roles')
    permissions = models.ManyToManyField(Permission, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'organization'],
                condition=models.Q(organization__isnull=False),
                name='unique_role_name_per_org'
            )
        ]

    def __str__(self):
        return self.name


class OrgMember(models.Model):
    class ContractType(models.TextChoices):
        FULL_TIME = 'full_time', 'Full Time'
        PART_TIME = 'part_time', 'Part Time'
        CONTRACTOR = 'contractor', 'Contractor'
        GUEST = 'guest', 'Guest'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='org_memberships')
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    contract_type = models.CharField(max_length=20, choices=ContractType.choices, default=ContractType.FULL_TIME)
    invited_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='invited_members')
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('organization', 'user')
        # Note: setting is_active=False is preferred over deleting OrgMember records for terminated members.

    def __str__(self):
        return f"{self.user.username} in {self.organization.name} ({self.role.name if self.role else 'No Role'})"


# ---------------------------------------------------------------------------
# Audit Logging
# ---------------------------------------------------------------------------

class AuditLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=100)
    entity_id = models.PositiveIntegerField()
    before_state = models.JSONField(null=True, blank=True)
    after_state = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['organization', 'entity_type', 'entity_id', 'created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        actor_name = self.actor.username if self.actor else "System"
        return f"{self.action} on {self.entity_type} {self.entity_id} by {actor_name}"


# ---------------------------------------------------------------------------
# Academy CRM Models
# ---------------------------------------------------------------------------

class Course(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='courses')
    title = models.CharField(max_length=255)
    code = models.CharField(max_length=50)  # e.g. CS101
    description = models.TextField(blank=True, default='')
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    is_active = models.BooleanField(default=True)
    thumbnail = models.ImageField(upload_to='course_thumbnails/', null=True, blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_courses')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('organization', 'code')

    def __str__(self):
        return f"{self.title} ({self.code})"


class AcademyClass(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='classes')
    teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='teaching_classes')
    name = models.CharField(max_length=255)  # e.g. "Summer 2026 Section A"
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    room = models.ForeignKey('rooms.Room', on_delete=models.SET_NULL, null=True, blank=True, related_name='academy_classes')
    is_active = models.BooleanField(default=True)
    max_students = models.PositiveIntegerField(null=True, blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_classes')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.course.code} - {self.name}"


class Enrollment(models.Model):
    class CompletionStatus(models.TextChoices):
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        DROPPED = 'dropped', 'Dropped'

    academy_class = models.ForeignKey(AcademyClass, on_delete=models.CASCADE, related_name='enrollments')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    enrolled_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='enrolled_students')
    completion_status = models.CharField(max_length=20, choices=CompletionStatus.choices, default=CompletionStatus.IN_PROGRESS)
    completion_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('academy_class', 'student')

    def __str__(self):
        return f"{self.student.username} enrolled in {self.academy_class.name}"


# ---------------------------------------------------------------------------
# Financial Expense Ledger Models
# ---------------------------------------------------------------------------

class TuitionInvoice(models.Model):
    class Status(models.TextChoices):
        UNPAID = 'unpaid', 'Unpaid'
        PAID = 'paid', 'Paid'
        CANCELLED = 'cancelled', 'Cancelled'

    class PaymentMethod(models.TextChoices):
        CASH = 'cash', 'Cash'
        BANK_TRANSFER = 'bank_transfer', 'Bank Transfer'
        ONLINE = 'online', 'Online'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='invoices')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invoices')
    academy_class = models.ForeignKey(AcademyClass, on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNPAID)
    due_date = models.DateField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    invoice_number = models.CharField(max_length=50, blank=True)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, blank=True)
    issued_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='issued_invoices')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invoice {self.id} for {self.student.username} - {self.amount} ({self.status})"


class ExpenseItem(models.Model):
    class Category(models.TextChoices):
        TEACHER_PAYOUT = 'teacher_payout', 'Teacher Payout'
        INFRASTRUCTURE = 'infrastructure', 'Infrastructure/Server'
        MARKETING = 'marketing', 'Marketing'
        RENT = 'rent', 'Rent/Utilities'
        OTHER = 'other', 'Other'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='expenses')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.OTHER)
    description = models.TextField(blank=True, default='')
    recipient = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_payments')
    approved_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='approved_expenses')
    attachment = models.FileField(upload_to='expense_attachments/', null=True, blank=True)
    incurred_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Expense {self.id} - {self.category} - {self.amount}"

