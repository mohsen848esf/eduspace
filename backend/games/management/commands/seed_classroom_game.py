"""
Seed the Word Quest Classroom catalogue entry.

Run once after pulling the branch that ships the new game folder:

    python manage.py seed_classroom_game

Idempotent — re-running just refreshes the catalogue row.
"""

from django.core.management.base import BaseCommand

from games.models import Game


CLASSROOM_TITLE = 'Word Quest Classroom'
CLASSROOM_DESCRIPTION = (
    'Host-driven word guessing for live classrooms. The host picks the '
    'mode and difficulty, students join from inside the call, and '
    'everyone races on the same questions in sync.'
)


class Command(BaseCommand):
    help = 'Register the Word Quest Classroom game in the catalogue.'

    def handle(self, *args, **opts):
        game, created = Game.objects.update_or_create(
            game_type=Game.GameType.WORD_GUESS_CLASSROOM,
            defaults={
                'title': CLASSROOM_TITLE,
                'description': CLASSROOM_DESCRIPTION,
                'is_free': True,
                'is_in_call_only': True,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(
                f'Created catalogue entry for {game.title} (id={game.pk})'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Refreshed catalogue entry for {game.title} (id={game.pk})'
            ))
