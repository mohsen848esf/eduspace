# Generated manually

from django.db import migrations

def create_mentor_role(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    Permission = apps.get_model('accounts', 'Permission')

    # Get or create default Mentor role (global role: organization is null)
    mentor_role, _ = Role.objects.get_or_create(
        name='Mentor',
        organization__isnull=True,
        defaults={'description': 'Mentor who supports students and classes'}
    )

    # Assign default permissions
    permissions_codenames = [
        'can_view_dashboard',
        'can_view_sessions',
        'can_view_attendance',
        'can_attend_class'
    ]
    perms = Permission.objects.filter(codename__in=permissions_codenames)
    mentor_role.permissions.set(perms)

def rollback_mentor_role(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    Role.objects.filter(name='Mentor', organization__isnull=True).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0023_organization_is_suspended_organization_suspended_at_and_more'),
    ]

    operations = [
        migrations.RunPython(create_mentor_role, rollback_mentor_role),
    ]
