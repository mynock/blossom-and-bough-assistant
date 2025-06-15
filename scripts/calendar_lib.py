#!/usr/bin/env python3
"""
Shared library for Google Calendar scripts

Common functionality for calendar enhancer and calendar copier scripts.
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
import json

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Please install python-dotenv: pip install python-dotenv")

# Google Calendar API imports
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("Please install required packages:")
    print("pip install google-api-python-client google-auth python-dotenv")
    sys.exit(1)

# Google Calendar API scopes
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
]

# Color mapping for different work types
WORK_TYPE_COLORS = {
    'Maintenance': '10',      # Green/Basil - for recurring maintenance visits
    'Ad-hoc': '4',           # Flamingo/Pale Red - for one-off client visits  
    'Design': '3',           # Grape/Mauve - for consultation/planning work
    'Office Work': '8',      # Graphite/Gray - for internal business tasks
    'Errands': '6',          # Tangerine/Orange - for supply runs, equipment service, truck service, tool maintenance
}

def setup_google_calendar_api(service_account_file):
    """Set up Google Calendar API authentication using service account."""
    try:
        if not Path(service_account_file).exists():
            print(f"Error: Service account file '{service_account_file}' not found!")
            print("\nTo set up Google Calendar API access with service account:")
            print("1. Go to https://console.cloud.google.com/")
            print("2. Create a new project or select existing project")
            print("3. Enable the Google Calendar API")
            print("4. Create a Service Account")
            print("5. Download the service account key JSON file")
            print("6. Share your calendar with the service account email address")
            return None
        
        credentials = service_account.Credentials.from_service_account_file(
            service_account_file, scopes=SCOPES)
        
        service = build('calendar', 'v3', credentials=credentials)
        
        # Test the connection
        calendar_list = service.calendarList().list().execute()
        print(f"Successfully connected! Found {len(calendar_list.get('items', []))} accessible calendars")
        
        return service
        
    except Exception as e:
        print(f"Error setting up Calendar service: {e}")
        print("Make sure:")
        print("1. The service account key file is valid")
        print("2. Google Calendar API is enabled in your project")
        print("3. You've shared the calendar with the service account email")
        return None

def get_service_account_file():
    """Get the service account file path, handling relative paths from server directory."""
    service_account_from_env = os.getenv('GOOGLE_SERVICE_ACCOUNT_KEY_FILE', 'google-account-key.json')
    if service_account_from_env.startswith('../'):
        # Remove ../ prefix if running from root directory
        return service_account_from_env[3:]
    else:
        return service_account_from_env

def get_calendar_id():
    """Get the calendar ID from environment variables."""
    return os.getenv('GOOGLE_CALENDAR_ID', 'primary')

def parse_event_date(event):
    """Parse event start date from Google Calendar event object."""
    try:
        start = event.get('start', {})
        
        if 'dateTime' in start:
            # Parse datetime with timezone
            date_str = start['dateTime']
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            # Convert to naive datetime for comparison
            return dt.replace(tzinfo=None)
        elif 'date' in start:
            # Parse date-only events
            date_str = start['date']
            return datetime.strptime(date_str, '%Y-%m-%d')
    except Exception:
        pass
    
    return datetime.now()

def get_calendar_events(service, calendar_id='primary', start_date=None, end_date=None):
    """Retrieve events from Google Calendar within date range."""
    try:
        if start_date is None:
            start_date = datetime(2025, 5, 1)  # May 2025
        if end_date is None:
            end_date = datetime(2025, 8, 31)  # August 2025
        
        # Convert to RFC3339 format
        time_min = start_date.isoformat() + 'Z'
        time_max = end_date.isoformat() + 'Z'
        
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            maxResults=2500,  # Adjust as needed
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        print(f"Found {len(events)} events in calendar {calendar_id}")
        return events
        
    except HttpError as error:
        print(f"An error occurred: {error}")
        return []

def update_event(service, calendar_id, event_id, updates):
    """Update a specific event in Google Calendar."""
    try:
        # Get the current event
        event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
        
        # Apply updates
        for key, value in updates.items():
            event[key] = value
        
        # Update the event
        updated_event = service.events().update(
            calendarId=calendar_id,
            eventId=event_id,
            body=event
        ).execute()
        
        return True
        
    except HttpError as error:
        print(f"Error updating event {event_id}: {error}")
        return False

def create_event(service, calendar_id, event_data):
    """Create a new event in Google Calendar."""
    try:
        created_event = service.events().insert(
            calendarId=calendar_id,
            body=event_data
        ).execute()
        
        return created_event
        
    except HttpError as error:
        print(f"Error creating event: {error}")
        return None

def delete_event(service, calendar_id, event_id):
    """Delete an event from Google Calendar."""
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
        return True
        
    except HttpError as error:
        print(f"Error deleting event {event_id}: {error}")
        return False

def delete_all_events(service, calendar_id='primary', dry_run=False):
    """Delete all events from the calendar with confirmation."""
    
    print("🚨 WARNING: This will delete ALL events from the calendar!")
    print(f"Calendar ID: {calendar_id}")
    print("")
    
    # Get all events first to show count
    print("Fetching all events to count them...")
    
    # Get events from a wide date range to catch everything
    start_date = datetime(2020, 1, 1)  # Far back
    end_date = datetime(2030, 12, 31)  # Far forward
    
    time_min = start_date.isoformat() + 'Z'
    time_max = end_date.isoformat() + 'Z'
    
    try:
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            maxResults=2500,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        if not events:
            print("✅ No events found in the calendar.")
            return True
        
        print(f"Found {len(events)} events in the calendar.")
        print("")
        
        # Show some sample events
        print("Sample events that will be deleted:")
        for i, event in enumerate(events[:5]):  # Show first 5
            summary = event.get('summary', 'No title')
            start = event.get('start', {})
            if 'dateTime' in start:
                event_date = start['dateTime'][:10]  # Just the date part
            elif 'date' in start:
                event_date = start['date']
            else:
                event_date = 'Unknown date'
            print(f"  {i+1}. {event_date}: {summary}")
        
        if len(events) > 5:
            print(f"  ... and {len(events) - 5} more events")
        print("")
        
        # First confirmation
        response = input("Are you sure you want to delete ALL these events? Type 'yes' to continue: ")
        if response.lower() != 'yes':
            print("❌ Operation cancelled.")
            return False
        
        # Second confirmation with calendar ID
        print("")
        print(f"⚠️  FINAL CONFIRMATION: You are about to delete {len(events)} events from calendar:")
        print(f"   {calendar_id}")
        response = input("Type 'DELETE ALL EVENTS' to confirm: ")
        if response != 'DELETE ALL EVENTS':
            print("❌ Operation cancelled.")
            return False
        
        print("")
        print(f"{'[DRY RUN] ' if dry_run else ''}Deleting {len(events)} events...")
        
        deleted_count = 0
        failed_count = 0
        
        for i, event in enumerate(events):
            event_id = event['id']
            summary = event.get('summary', 'No title')
            
            if dry_run:
                print(f"[DRY RUN] Would delete: {summary}")
                deleted_count += 1
            else:
                try:
                    service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
                    deleted_count += 1
                    if i % 50 == 0:  # Progress update every 50 deletions
                        print(f"Deleted {deleted_count}/{len(events)} events...")
                except HttpError as error:
                    print(f"❌ Failed to delete event '{summary}': {error}")
                    failed_count += 1
        
        print("")
        if dry_run:
            print(f"✅ DRY RUN completed! Would have deleted {deleted_count} events.")
        else:
            print(f"✅ Deletion completed!")
            print(f"   Successfully deleted: {deleted_count} events")
            if failed_count > 0:
                print(f"   Failed to delete: {failed_count} events")
        
        return True
        
    except HttpError as error:
        print(f"❌ Error fetching events: {error}")
        return False

def list_calendars(service):
    """List all accessible calendars."""
    try:
        calendar_list = service.calendarList().list().execute()
        calendars = calendar_list.get('items', [])
        
        print("Accessible calendars:")
        for calendar in calendars:
            cal_id = calendar['id']
            summary = calendar.get('summary', 'No name')
            access_role = calendar.get('accessRole', 'unknown')
            print(f"  {summary} ({cal_id}) - {access_role}")
        
        return calendars
        
    except HttpError as error:
        print(f"Error listing calendars: {error}")
        return []

def show_help():
    """Show general help for calendar scripts."""
    print("Google Calendar Scripts - Common Help")
    print("")
    print("Environment Variables:")
    print("  GOOGLE_SERVICE_ACCOUNT_KEY_FILE  Path to service account JSON file")
    print("  GOOGLE_CALENDAR_ID              Target calendar ID")
    print("  GOOGLE_SHEETS_ID                Spreadsheet ID for client data")
    print("")
    print("Setup:")
    print("1. Create a service account in Google Cloud Console")
    print("2. Enable Google Calendar API and Google Sheets API")
    print("3. Download the service account key JSON file")
    print("4. Share your calendar and spreadsheet with the service account email address")
    print("5. Set environment variables in .env file")
    print("6. Install required packages:")
    print("   pip install google-api-python-client google-auth python-dotenv")
    print("") 