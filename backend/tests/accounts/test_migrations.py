from django.test import TransactionTestCase
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


class TestClassToSessionMigration(TransactionTestCase):
    migrate_from = [
        ('accounts', '0014_session_unique_live_session_per_class'),
        ('rooms', '0006_recording_session_room_meeting_type_and_more')
    ]
    migrate_to = [
        ('accounts', '0015_data_migrate_class_to_session')
    ]

    def setUp(self):
        # Reset database state to migrate_from
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        self.apps = executor.loader.project_state(self.migrate_from).apps

    def test_migration(self):
        # 1. Create initial state using historical models
        User = self.apps.get_model('accounts', 'User')
        Organization = self.apps.get_model('accounts', 'Organization')
        Course = self.apps.get_model('accounts', 'Course')
        AcademyClass = self.apps.get_model('accounts', 'AcademyClass')
        Room = self.apps.get_model('rooms', 'Room')
        Recording = self.apps.get_model('rooms', 'Recording')
        
        owner = User.objects.create_user(username='owner', password='pass')
        org = Organization.objects.create(name='Org', slug='org', owner=owner)
        course = Course.objects.create(organization=org, title='Course', code='C')
        
        # Create Room
        room = Room.objects.create(
            name='Room A',
            room_code='RMA',
            host=owner,
            status='active'
        )
        
        # Create Class referencing the Room
        ac = AcademyClass.objects.create(
            course=course,
            name='Class 1',
            room=room
        )
        
        # Create Recording for the Room
        recording = Recording.objects.create(
            room=room,
            owner=owner
        )
        
        # 2. Run the migration forward
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()  # rebuild graph
        executor.migrate(self.migrate_to)
        
        # Get the new apps state
        new_apps = executor.loader.project_state(self.migrate_to).apps
        
        # Check that the Session has been created
        Session = new_apps.get_model('accounts', 'Session')
        sessions = Session.objects.filter(academy_class_id=ac.id)
        self.assertEqual(sessions.count(), 1)
        session = sessions.first()
        
        self.assertEqual(session.organization_id, org.id)
        self.assertEqual(session.host_id, owner.id)
        self.assertEqual(session.title, "Class 1 (Migrated)")
        self.assertEqual(session.status, "completed")
        self.assertEqual(session.active_room_id, room.id)
        
        # Check that Room is updated
        Room = new_apps.get_model('rooms', 'Room')
        updated_room = Room.objects.get(id=room.id)
        self.assertEqual(updated_room.session_id, session.id)
        self.assertEqual(updated_room.organization_id, org.id)
        self.assertEqual(updated_room.meeting_type, 'class_session')
        
        # Check that Recording is updated
        Recording = new_apps.get_model('rooms', 'Recording')
        updated_recording = Recording.objects.get(id=recording.id)
        self.assertEqual(updated_recording.session_id, session.id)
        
        # 3. Test rollback
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        rollback_apps = executor.loader.project_state(self.migrate_from).apps
        
        # Verify sessions are deleted
        SessionRollback = rollback_apps.get_model('accounts', 'Session')
        self.assertEqual(SessionRollback.objects.filter(academy_class_id=ac.id).count(), 0)
        
        # Verify Room links are nullified / reset
        RoomRollback = rollback_apps.get_model('rooms', 'Room')
        rolled_room = RoomRollback.objects.get(id=room.id)
        self.assertIsNone(rolled_room.session_id)
        self.assertIsNone(rolled_room.organization_id)
        self.assertEqual(rolled_room.meeting_type, 'ad_hoc')
        
        # Verify Recording session link is nullified
        RecordingRollback = rollback_apps.get_model('rooms', 'Recording')
        rolled_recording = RecordingRollback.objects.get(id=recording.id)
        self.assertIsNone(rolled_recording.session_id)

    def tearDown(self):
        # Ensure the database is fully migrated back to the latest state so subsequent tests don't break
        executor = MigrationExecutor(connection)
        executor.migrate([('accounts', '0015_data_migrate_class_to_session')])
