import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounts.models import User, OrgMember, Organization

def run():
    print("=== Existing Organizations ===")
    orgs = Organization.objects.all()
    for o in orgs:
        print(f"ID: {o.id} | Slug: {o.slug} | Name: {o.name}")
    print()

    print("=== Existing Users & Memberships ===")
    users = User.objects.all()
    for u in users:
        print(f"User ID: {u.id} | Username: {u.username} | Email: {u.email} | Superuser: {u.is_superuser}")
        memberships = OrgMember.objects.filter(user=u)
        for m in memberships:
            print(f"  -> Org: {m.organization.name} ({m.organization.slug}) | Role: {m.role.name if m.role else 'None'} | Active: {m.is_active}")
        print("-" * 50)

if __name__ == '__main__':
    run()
