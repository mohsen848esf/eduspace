from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import User
from rooms.models import Room, RoomParticipant


class GuestJoinAPITests(APITestCase):
    def setUp(self):
        self.host_user = User.objects.create_user(
            username="hostteacher",
            email="teacher@example.com",
            password="password123",
            full_name="Teacher Host",
        )
        self.active_room = Room.objects.create(
            name="Linear Algebra 101",
            room_code="ALG101",
            host=self.host_user,
            status=Room.Status.ACTIVE,
            max_participants=5,
        )
        RoomParticipant.objects.create(
            room=self.active_room,
            user=self.host_user,
            role=RoomParticipant.Role.HOST,
            is_active=True,
        )

    def test_unauthenticated_user_can_fetch_public_room_info(self):
        url = reverse("get_room", kwargs={"room_code": self.active_room.room_code})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["room_code"], "ALG101")
        self.assertEqual(data["name"], "Linear Algebra 101")
        self.assertEqual(data["status"], "active")
        self.assertEqual(len(data["participants"]), 1)
        self.assertEqual(data["participants"][0]["user__username"], "hostteacher")

    def test_guest_join_success(self):
        url = reverse("guest_join_room", kwargs={"room_code": self.active_room.room_code})
        response = self.client.post(url, {"display_name": "Guest Student"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["room_code"], "ALG101")
        self.assertTrue(data["is_guest"])
        self.assertFalse(data["is_host"])
        self.assertIn("token", data)
        self.assertIsNotNone(data["token"])
        self.assertIn("guest_identity", data)
        self.assertIn("guest_access_token", data)

        # Check database participant created
        participant = RoomParticipant.objects.get(guest_identity=data["guest_identity"])
        self.assertTrue(participant.is_guest)
        self.assertEqual(participant.guest_name, "Guest Student")
        self.assertIsNone(participant.user)
        self.assertTrue(participant.is_active)

    def test_guest_lobby_polling_requires_matching_signed_token(self):
        self.active_room.require_approval = True
        self.active_room.save(update_fields=["require_approval"])
        join_response = self.client.post(
            reverse("guest_join_room", kwargs={"room_code": self.active_room.room_code}),
            {"display_name": "Waiting Guest"},
            format="json",
        )
        self.assertEqual(join_response.status_code, status.HTTP_202_ACCEPTED)
        guest_token = join_response.data["guest_access_token"]
        request_id = join_response.data["request_id"]
        status_url = reverse("lobby_status", kwargs={
            "room_code": self.active_room.room_code,
            "request_id": request_id,
        })

        unsigned_response = self.client.get(status_url)
        self.assertEqual(unsigned_response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.force_authenticate(user=self.host_user)
        admit_response = self.client.post(reverse("lobby_admit", kwargs={
            "room_code": self.active_room.room_code,
            "request_id": request_id,
        }))
        self.assertEqual(admit_response.status_code, status.HTTP_200_OK)
        self.client.force_authenticate(user=None)

        admitted_response = self.client.get(
            status_url,
            HTTP_X_GUEST_ACCESS_TOKEN=guest_token,
        )
        self.assertEqual(admitted_response.status_code, status.HTTP_200_OK)
        self.assertEqual(admitted_response.data["status"], "admitted")
        self.assertEqual(admitted_response.data["guest_access_token"], guest_token)
        self.assertIn("token", admitted_response.data)

    def test_guest_join_rejects_empty_name(self):
        url = reverse("guest_join_room", kwargs={"room_code": self.active_room.room_code})
        response = self.client.post(url, {"display_name": "  "}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_guest_join_rejects_ended_room(self):
        self.active_room.status = Room.Status.ENDED
        self.active_room.save()

        url = reverse("guest_join_room", kwargs={"room_code": self.active_room.room_code})
        response = self.client.post(url, {"display_name": "Late Guest"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertIn("ended", response.json()["error"])

    def test_guest_join_rejects_full_room(self):
        self.active_room.max_participants = 1  # only host is allowed
        self.active_room.save()

        url = reverse("guest_join_room", kwargs={"room_code": self.active_room.room_code})
        response = self.client.post(url, {"display_name": "Overflow Guest"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("ظرفیت", response.json()["error"])

    def test_guest_leave_room(self):
        join_url = reverse("guest_join_room", kwargs={"room_code": self.active_room.room_code})
        join_res = self.client.post(join_url, {"display_name": "Departing Guest"}, format="json")
        guest_identity = join_res.json()["guest_identity"]

        leave_url = reverse("leave_room", kwargs={"room_code": self.active_room.room_code})
        leave_res = self.client.post(leave_url, {"guest_identity": guest_identity}, format="json")
        self.assertEqual(leave_res.status_code, status.HTTP_200_OK)

        participant = RoomParticipant.objects.get(guest_identity=guest_identity)
        self.assertFalse(participant.is_active)
        self.assertIsNotNone(participant.left_at)
