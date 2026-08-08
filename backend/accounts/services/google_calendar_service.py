import logging
import requests
from datetime import datetime, time
from django.conf import settings
from django.utils import timezone
from accounts.models import AcademyClass, Session, ClassOccurrence

logger = logging.getLogger(__name__)

class GoogleCalendarService:
    @staticmethod
    def get_user_credentials(user):
        """
        Retrieves stored Google Calendar OAuth credentials for the organization or user.
        For simplicity during demo/dev, we simulate having valid credentials.
        """
        # In a real implementation, this queries UserOAuthToken / OrgOAuthToken
        return {
            'access_token': 'simulated_access_token_12345',
            'refresh_token': 'simulated_refresh_token_abcde',
            'expires_at': timezone.now() + timezone.timedelta(hours=1)
        }

    @staticmethod
    def sync_class_schedule(academy_class: AcademyClass):
        """
        Creates or updates a recurring event on Google Calendar for an automatic class.
        """
        if academy_class.scheduling_mode != AcademyClass.SchedulingMode.AUTOMATIC:
            return

        creds = GoogleCalendarService.get_user_credentials(academy_class.created_by)
        if not creds:
            logger.warning("No Google Calendar credentials found for class creator.")
            return

        # Build RFC 5545 Recurrence Rule (RRULE)
        # Weekday abbreviation mapping
        day_map = {
            'monday': 'MO', 'tuesday': 'TU', 'wednesday': 'WE', 
            'thursday': 'TH', 'friday': 'FR', 'saturday': 'SA', 'sunday': 'SU'
        }
        weekdays_rrule = ",".join([day_map[d] for d in academy_class.recurrence_weekdays if d in day_map])
        
        rrule_str = f"FREQ=WEEKLY;BYDAY={weekdays_rrule}"
        if academy_class.recurrence_end_mode == AcademyClass.EndMode.DATE and academy_class.end_date:
            # UNTIL format: YYYYMMDDTHHMMSSZ (must be UTC)
            until_dt = datetime.combine(academy_class.end_date, time(23, 59, 59))
            rrule_str += f";UNTIL={until_dt.strftime('%Y%m%dT%H%M%SZ')}"
        elif academy_class.recurrence_end_mode == AcademyClass.EndMode.OCCURRENCES and academy_class.recurrence_max_occurrences:
            rrule_str += f";COUNT={academy_class.recurrence_max_occurrences}"

        # Setup event payload
        start_date = academy_class.start_date or timezone.localdate()
        start_time_iso = f"{start_date.isoformat()}T{academy_class.recurrence_start_time.isoformat()}"
        duration = academy_class.recurrence_duration_minutes or 90
        # Simulated end time calculation
        end_time_dt = timezone.make_aware(datetime.combine(start_date, academy_class.recurrence_start_time)) + timezone.timedelta(minutes=duration)
        end_time_iso = end_time_dt.isoformat()

        event_payload = {
            'summary': academy_class.name,
            'description': f"EduSpace Class: {academy_class.course.title}",
            'start': {
                'dateTime': start_time_iso,
                'timeZone': academy_class.recurrence_timezone
            },
            'end': {
                'dateTime': end_time_iso,
                'timeZone': academy_class.recurrence_timezone
            },
            'recurrence': [
                f"RRULE:{rrule_str}"
            ]
        }

        # Mock Sync API request logic
        if academy_class.google_calendar_id:
            logger.info("Simulated Updating Google Calendar Recurring Event: %s (Payload: %s)", academy_class.google_calendar_id, event_payload)
        else:
            simulated_event_id = f"google_recurring_{academy_class.id}"
            # Save the parent calendar event ID
            academy_class.google_calendar_id = simulated_event_id
            # Prevent triggering save hooks recursively
            AcademyClass.objects.filter(pk=academy_class.pk).update(google_calendar_id=simulated_event_id)
            logger.info("Simulated Creating Google Calendar Recurring Event. Generated ID: %s", simulated_event_id)

    @staticmethod
    def sync_manual_session(session: Session):
        """
        Creates or updates a single event on Google Calendar for manual sessions.
        """
        if not session.scheduled_start or not session.scheduled_end:
            return

        creds = GoogleCalendarService.get_user_credentials(session.created_by)
        if not creds:
            return

        event_payload = {
            'summary': session.title,
            'description': f"EduSpace Manual Session",
            'start': {
                'dateTime': session.scheduled_start.isoformat(),
                'timeZone': 'UTC'
            },
            'end': {
                'dateTime': session.scheduled_end.isoformat(),
                'timeZone': 'UTC'
            }
        }

        # Simulating API request logic
        logger.info("Simulated Syncing Google Calendar Single Event for session %s (Payload: %s)", session.id, event_payload)

    @staticmethod
    def cancel_occurrence_event(occurrence: ClassOccurrence):
        """
        Cancels a single occurrence in Google Calendar by creating an exception instance or deleting it.
        """
        if occurrence.google_event_id:
            logger.info("Simulated Cancelling Google Calendar Occurrence Event: %s", occurrence.google_event_id)
        else:
            # If no override exists yet, simulate setting status cancelled on instance
            simulated_instance_id = f"google_occ_override_{occurrence.occurrence_id}"
            occurrence.google_event_id = simulated_instance_id
            occurrence.save(update_fields=['google_event_id'])
            logger.info("Simulated Cancelling Google Calendar Occurrence Instance. Generated ID: %s", simulated_instance_id)

    @staticmethod
    def delete_calendar_event(event_id: str):
        """
        Completely removes an event from Google Calendar.
        """
        if event_id:
            logger.info("Simulated Deleting Google Calendar Event: %s", event_id)
