from django.db import models
from django.conf import settings
from accounts.models import Organization, Session

class QuestionBank(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="question_banks"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_question_banks"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.organization.name})"


class QuestionQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)


class QuestionManager(models.Manager):
    def get_queryset(self):
        return QuestionQuerySet(self.model, using=self._db)

    def active(self):
        return self.get_queryset().active()

    def with_archived(self):
        return self.get_queryset()


class Question(models.Model):
    class QuestionType(models.TextChoices):
        SINGLE_CHOICE = 'single_choice', 'Single Choice'
        MULTIPLE_CHOICE = 'multiple_choice', 'Multiple Choice'
        TEXT = 'text', 'Text'
        CODE = 'code', 'Code'

    question_bank = models.ForeignKey(
        QuestionBank,
        on_delete=models.CASCADE,
        related_name="questions"
    )
    text = models.TextField()
    question_type = models.CharField(
        max_length=20,
        choices=QuestionType.choices,
        default=QuestionType.SINGLE_CHOICE
    )
    options = models.JSONField(default=list, blank=True)
    correct_answer = models.JSONField()
    points = models.DecimalField(max_digits=5, decimal_places=2, default=1.00)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = QuestionManager()

    def archive(self):
        self.is_active = False
        self.save(update_fields=['is_active', 'updated_at'])

    def restore(self):
        self.is_active = True
        self.save(update_fields=['is_active', 'updated_at'])

    def __str__(self):
        return f"{self.text[:50]}... ({self.question_type})"


class Assessment(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="assessments"
    )
    session = models.ForeignKey(
        Session,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessments"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    questions = models.ManyToManyField(
        Question,
        through='AssessmentQuestion',
        related_name="assessments"
    )
    duration_minutes = models.IntegerField(default=60)
    passing_score = models.DecimalField(max_digits=5, decimal_places=2, default=50.00)
    is_published = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_assessments"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.organization.name})"


class AssessmentQuestion(models.Model):
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    order = models.IntegerField(default=0)
    points = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        ordering = ['order']
        unique_together = ('assessment', 'question')

    def __str__(self):
        return f"{self.assessment.title} - {self.question.text[:30]}"


class Submission(models.Model):
    class Status(models.TextChoices):
        STARTED = 'started', 'Started'
        SUBMITTED = 'submitted', 'Submitted'
        GRADED = 'graded', 'Graded'

    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name="submissions"
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submissions"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.STARTED
    )
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    score = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="graded_submissions"
    )
    graded_at = models.DateTimeField(null=True, blank=True)

    # Anti-cheat telemetry
    tab_focus_losses = models.IntegerField(default=0)
    browser_info = models.TextField(blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    def __str__(self):
        return f"{self.student.username} - {self.assessment.title} ({self.status})"


class StudentAnswer(models.Model):
    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="answers"
    )
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_options = models.JSONField(null=True, blank=True)
    text_answer = models.TextField(null=True, blank=True)
    score = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    is_correct = models.BooleanField(default=False)
    teacher_notes = models.TextField(blank=True, default="")

    class Meta:
        unique_together = ('submission', 'question')

    def __str__(self):
        return f"Answer to {self.question.id} for Submission {self.submission.id}"
