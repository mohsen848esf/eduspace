from django.contrib import admin
from .models import Game, Question, GameSession, GameParticipant, Answer


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 3


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ('title', 'game_type', 'is_free', 'created_at')
    inlines = [QuestionInline]


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ('room_code', 'game', 'host', 'status', 'created_at')


@admin.register(GameParticipant)
class GameParticipantAdmin(admin.ModelAdmin):
    list_display = ('user', 'session', 'score', 'hints_used')


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ('participant', 'question', 'is_correct', 'answered_at')