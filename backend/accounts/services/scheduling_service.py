import zoneinfo
from datetime import datetime, time, timedelta, timezone as datetime_timezone
from django.utils import timezone
from dateutil.rrule import rrule, WEEKLY, MO, TU, WE, TH, FR, SA, SU
from accounts.models import ClassOccurrence, AcademyClass

class SchedulingService:
    @staticmethod
    def generate_occurrences(academy_class: AcademyClass):
        """
        Generates and saves future ClassOccurrence objects based on weekly recurrence configurations.
        """
        if academy_class.scheduling_mode != AcademyClass.SchedulingMode.AUTOMATIC:
            return

        if not academy_class.recurrence_weekdays or not academy_class.recurrence_start_time:
            return

        # Weekday map
        day_map = {
            'monday': MO, 'tuesday': TU, 'wednesday': WE, 
            'thursday': TH, 'friday': FR, 'saturday': SA, 'sunday': SU
        }
        
        byweekdays = [day_map[d] for d in academy_class.recurrence_weekdays if d in day_map]
        if not byweekdays:
            return

        tz = zoneinfo.ZoneInfo(academy_class.recurrence_timezone)
        start_date = academy_class.start_date or timezone.localdate()
        start_time = academy_class.recurrence_start_time
        
        # Calculate local start datetime
        local_start_dt = datetime.combine(start_date, start_time).replace(tzinfo=tz)
        
        rule_args = {
            'freq': WEEKLY,
            'dtstart': local_start_dt,
            'byweekday': byweekdays
        }
        
        if academy_class.recurrence_end_mode == AcademyClass.EndMode.DATE and academy_class.end_date:
            local_end_dt = datetime.combine(academy_class.end_date, time.max).replace(tzinfo=tz)
            rule_args['until'] = local_end_dt
        elif academy_class.recurrence_end_mode == AcademyClass.EndMode.OCCURRENCES and academy_class.recurrence_max_occurrences:
            rule_args['count'] = academy_class.recurrence_max_occurrences
        else:
            # Default fallback: generate occurrences for 1 year if end condition is missing
            local_end_dt = local_start_dt + timedelta(days=365)
            rule_args['until'] = local_end_dt

        # Calculate local datetimes using rrule
        occurrences_dts = list(rrule(**rule_args))
        
        created_occurrences = []
        for dt in occurrences_dts:
            # Convert local time to UTC safely (handling DST offsets)
            utc_start = dt.astimezone(datetime_timezone.utc)
            duration = academy_class.recurrence_duration_minutes or 90
            utc_end = utc_start + timedelta(minutes=duration)
            
            # Format ID: class_id_YYYYMMDD
            occurrence_id = f"{academy_class.id}_{dt.strftime('%Y%m%d')}"
            
            occurrence, created = ClassOccurrence.objects.get_or_create(
                occurrence_id=occurrence_id,
                defaults={
                    'academy_class': academy_class,
                    'scheduled_start': utc_start,
                    'scheduled_end': utc_end,
                    'status': ClassOccurrence.Status.SCHEDULED
                }
            )
            created_occurrences.append(occurrence)
            
        # Trigger Google Calendar sync
        from accounts.services.google_calendar_service import GoogleCalendarService
        GoogleCalendarService.sync_class_schedule(academy_class)

        return created_occurrences

    @staticmethod
    def update_class_occurrences(academy_class: AcademyClass):
        """
        Synchronizes class occurrences when the recurrence schedule changes.
        Keeps completed/live/cancelled occurrences, overrides future scheduled ones.
        """
        if academy_class.scheduling_mode != AcademyClass.SchedulingMode.AUTOMATIC:
            # If changed from automatic to manual, delete all future scheduled occurrences
            ClassOccurrence.objects.filter(
                academy_class=academy_class, 
                status=ClassOccurrence.Status.SCHEDULED
            ).delete()
            
            # Sync calendar deletion/cancellation
            from accounts.services.google_calendar_service import GoogleCalendarService
            if academy_class.google_calendar_id:
                GoogleCalendarService.delete_calendar_event(academy_class.google_calendar_id)
                academy_class.google_calendar_id = None
                AcademyClass.objects.filter(pk=academy_class.pk).update(google_calendar_id=None)
            return

        # Weekday map
        day_map = {
            'monday': MO, 'tuesday': TU, 'wednesday': WE, 
            'thursday': TH, 'friday': FR, 'saturday': SA, 'sunday': SU
        }
        byweekdays = [day_map[d] for d in academy_class.recurrence_weekdays if d in day_map]
        
        if not byweekdays or not academy_class.recurrence_start_time:
            # If no schedule rule, clear future scheduled occurrences
            ClassOccurrence.objects.filter(
                academy_class=academy_class, 
                status=ClassOccurrence.Status.SCHEDULED
            ).delete()
            return

        tz = zoneinfo.ZoneInfo(academy_class.recurrence_timezone)
        start_date = academy_class.start_date or timezone.localdate()
        start_time = academy_class.recurrence_start_time
        
        local_start_dt = datetime.combine(start_date, start_time).replace(tzinfo=tz)
        
        rule_args = {
            'freq': WEEKLY,
            'dtstart': local_start_dt,
            'byweekday': byweekdays
        }
        
        if academy_class.recurrence_end_mode == AcademyClass.EndMode.DATE and academy_class.end_date:
            local_end_dt = datetime.combine(academy_class.end_date, time.max).replace(tzinfo=tz)
            rule_args['until'] = local_end_dt
        elif academy_class.recurrence_end_mode == AcademyClass.EndMode.OCCURRENCES and academy_class.recurrence_max_occurrences:
            rule_args['count'] = academy_class.recurrence_max_occurrences
        else:
            local_end_dt = local_start_dt + timedelta(days=365)
            rule_args['until'] = local_end_dt

        # Recalculate new local datetimes
        new_dts = list(rrule(**rule_args))
        new_ids = {f"{academy_class.id}_{dt.strftime('%Y%m%d')}" for dt in new_dts}
        
        # 1. Remove future scheduled occurrences that are no longer part of the new rule
        now = timezone.now()
        ClassOccurrence.objects.filter(
            academy_class=academy_class,
            status=ClassOccurrence.Status.SCHEDULED,
            scheduled_start__gt=now
        ).exclude(occurrence_id__in=new_ids).delete()
        
        # 2. Add or update occurrences
        for dt in new_dts:
            utc_start = dt.astimezone(datetime_timezone.utc)
            duration = academy_class.recurrence_duration_minutes or 90
            utc_end = utc_start + timedelta(minutes=duration)
            occurrence_id = f"{academy_class.id}_{dt.strftime('%Y%m%d')}"
            
            occurrence = ClassOccurrence.objects.filter(occurrence_id=occurrence_id).first()
            if occurrence:
                # Update details if it's still scheduled (not live/completed)
                if occurrence.status == ClassOccurrence.Status.SCHEDULED and occurrence.scheduled_start > now:
                    occurrence.scheduled_start = utc_start
                    occurrence.scheduled_end = utc_end
                    occurrence.save()
            else:
                # Create if it doesn't exist
                ClassOccurrence.objects.create(
                    occurrence_id=occurrence_id,
                    academy_class=academy_class,
                    scheduled_start=utc_start,
                    scheduled_end=utc_end,
                    status=ClassOccurrence.Status.SCHEDULED
                )
        
        # Sync to Google Calendar
        from accounts.services.google_calendar_service import GoogleCalendarService
        GoogleCalendarService.sync_class_schedule(academy_class)
