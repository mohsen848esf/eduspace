# Generated manually

from django.db import migrations

def seed_permissions(apps, schema_editor):
    Permission = apps.get_model('accounts', 'Permission')
    Role = apps.get_model('accounts', 'Role')

    permissions_data = [
        ('can_view_sessions', 'Can view sessions', 'Access session details'),
        ('can_manage_sessions', 'Can manage sessions', 'Create, edit, and delete sessions'),
        ('can_view_attendance', 'Can view attendance', 'View attendance records'),
        ('can_manage_attendance', 'Can manage attendance', 'Record or modify attendance'),
    ]

    new_perms = []
    for codename, name, desc in permissions_data:
        perm, _ = Permission.objects.get_or_create(
            codename=codename,
            defaults={'name': name, 'description': desc}
        )
        new_perms.append(perm)

    # Assign to Admin and Teacher roles
    roles_to_update = Role.objects.filter(name__in=['Admin', 'Teacher'])
    for role in roles_to_update:
        role.permissions.add(*new_perms)

def rollback_permissions(apps, schema_editor):
    Permission = apps.get_model('accounts', 'Permission')
    Permission.objects.filter(
        codename__in=['can_view_sessions', 'can_manage_sessions', 'can_view_attendance', 'can_manage_attendance']
    ).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0015_data_migrate_class_to_session'),
    ]

    operations = [
        migrations.RunPython(seed_permissions, rollback_permissions),
    ]
