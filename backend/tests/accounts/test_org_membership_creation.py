from unittest import mock

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import OrgMember, Organization, Permission, Role
from accounts.serializers import OrgMemberSerializer


User = get_user_model()


class OrganizationMemberCreationTest(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="org_admin", password="password123")
        self.organization = Organization.objects.create(
            name="Tenant One",
            slug="tenant-one",
            owner=self.admin,
        )
        manage_members, _ = Permission.objects.get_or_create(
            codename="can_manage_members",
            defaults={"name": "Manage Members"},
        )
        self.admin_role = Role.objects.create(name="Tenant Admin", organization=self.organization)
        self.admin_role.permissions.add(manage_members)
        OrgMember.objects.create(
            organization=self.organization,
            user=self.admin,
            role=self.admin_role,
        )
        self.url = reverse("org-member-list")
        self.client.force_authenticate(user=self.admin)

    def test_creates_new_user_and_active_membership_in_requested_organization(self):
        member_role = Role.objects.create(name="Teacher", organization=self.organization)

        response = self.client.post(
            self.url,
            {
                "username": "new_teacher",
                "email": "teacher@example.com",
                "password": "password123",
                "full_name": "New Teacher",
                "role": member_role.id,
                "contract_type": "full_time",
            },
            format="json",
            HTTP_X_ORGANIZATION_SLUG=self.organization.slug,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(username="new_teacher")
        membership = OrgMember.objects.get(user=created_user, organization=self.organization)
        self.assertTrue(membership.is_active)
        self.assertEqual(membership.role, member_role)

        login_response = self.client.post(
            reverse("login"),
            {"username": "new_teacher", "password": "password123"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            login_response.data["user"]["organizations"],
            [{"id": self.organization.id, "name": self.organization.name, "slug": self.organization.slug, "role": "Teacher"}],
        )

    def test_role_from_another_organization_does_not_create_user(self):
        other_owner = User.objects.create_user(username="other_owner", password="password123")
        other_organization = Organization.objects.create(
            name="Tenant Two",
            slug="tenant-two",
            owner=other_owner,
        )
        other_role = Role.objects.create(name="Teacher", organization=other_organization)

        response = self.client.post(
            self.url,
            {
                "username": "should_not_exist",
                "password": "password123",
                "role": other_role.id,
            },
            format="json",
            HTTP_X_ORGANIZATION_SLUG=self.organization.slug,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="should_not_exist").exists())

    def test_membership_insert_failure_rolls_back_new_user(self):
        role = Role.objects.create(name="Teacher", organization=self.organization)
        request = mock.Mock()
        request.organization = self.organization
        request.user = self.admin
        serializer = OrgMemberSerializer(
            data={
                "username": "rolled_back_user",
                "password": "password123",
                "role": role.id,
            },
            context={"request": request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        with mock.patch.object(OrgMember.objects, "create", side_effect=IntegrityError("membership insert failed")):
            with self.assertRaises(IntegrityError):
                serializer.save()

        self.assertFalse(User.objects.filter(username="rolled_back_user").exists())
