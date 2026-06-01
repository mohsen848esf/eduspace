from django.db import models
from accounts.models import User


class Game(models.Model):
    class GameType(models.TextChoices):
        WORD_GUESS = 'word_guess', 'Word Guess'
        WORD_GUESS_CLASSROOM = 'word_guess_classroom', 'Word Guess (Classroom)'
        GRAMMAR = 'grammar', 'Grammar'
        VOCAB = 'vocab', 'Vocabulary'

    class Status(models.TextChoices):
        WAITING = 'waiting', 'Waiting'
        PLAYING = 'playing', 'Playing'
        FINISHED = 'finished', 'Finished'

    title = models.CharField(max_length=255)
    game_type = models.CharField(max_length=50, choices=GameType.choices)
    description = models.TextField(blank=True)
    thumbnail = models.ImageField(upload_to='games/', null=True, blank=True)
    is_free = models.BooleanField(default=True)
    # When true, the gallery and the in-call selector hide this entry
    # outside of an active call. Used for classroom-style variants
    # whose host-vs-player flow only makes sense when there's a real
    # group of participants on the line.
    is_in_call_only = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Question(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='questions')
    word = models.CharField(max_length=100)
    description = models.TextField()
    hint = models.CharField(max_length=255, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.game.title} - {self.word}"


class GameSession(models.Model):
    class Status(models.TextChoices):
        WAITING = 'waiting', 'Waiting'
        PLAYING = 'playing', 'Playing'
        FINISHED = 'finished', 'Finished'

    game = models.ForeignKey(Game, on_delete=models.CASCADE)
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hosted_sessions')
    room_code = models.CharField(max_length=10, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.WAITING)
    current_question = models.PositiveIntegerField(default=0)
    time_per_question = models.PositiveIntegerField(default=30)
    max_hints = models.PositiveIntegerField(default=2)
    is_teacher_mode = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.game.title} - {self.room_code}"


class GameParticipant(models.Model):
    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name='participants')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    score = models.PositiveIntegerField(default=0)
    current_question = models.PositiveIntegerField(default=0)
    hints_used = models.PositiveIntegerField(default=0)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('session', 'user')

    def __str__(self):
        return f"{self.user.username} - {self.session.room_code}"


class Answer(models.Model):
    participant = models.ForeignKey(GameParticipant, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    is_correct = models.BooleanField(default=False)
    time_taken = models.FloatField(default=0)
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('participant', 'question')

    def __str__(self):
        return f"{self.participant.user.username} - {self.question.word} - {'✓' if self.is_correct else '✗'}"