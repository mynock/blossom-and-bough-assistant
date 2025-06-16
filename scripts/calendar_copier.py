#!/usr/bin/env python3
"""
Google Calendar Event Copier

Copies calendar events from a source calendar to a destination calendar.
Useful for resetting development state by copying from a "clean" template calendar.
"""

import sys
import os
from datetime import datetime, timedelta
from pathlib import Path

# Import our shared library
try:
    from calendar_lib import (
        setup_google_calendar_api, get_service_account_file, get_calendar_id,
        get_calendar_events, create_event, delete_all_events, list_calendars,
        parse_event_date, show_help, get_source_calendar_id
    )
except ImportError:
    print("Error: calendar_lib.py not found in the same directory!")
    print("Make sure both calendar_copier.py and calendar_lib.py are in the scripts/ directory.")
    sys.exit(1)

def copy_calendar_events(service, source_calendar_id, dest_calendar_id, start_date=None, end_date=None, dry_run=False, clear_destination=False, reset_mode=False):
    """Copy events from source calendar to destination calendar."""
    
    if reset_mode:
        print(f"🔄 Calendar Reset Mode")
        print(f"This will clear the destination calendar and copy fresh events from source")
    else:
        print(f"📅 Calendar Event Copier")
    
    print(f"Source Calendar: {source_calendar_id}")
    print(f"Destination Calendar: {dest_calendar_id}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE COPY'}")
    
    if start_date and end_date:
        print(f"Date Range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    else:
        print(f"Date Range: Default (May 2025 - August 2025)")
    
    print("-" * 60)
    
    # Clear destination calendar first if requested
    if clear_destination:
        if reset_mode:
            print(f"\n🗑️  Step 1: Clearing destination calendar for reset...")
        else:
            print(f"\n🗑️  Clearing destination calendar first...")
        if not dry_run:
            success = delete_all_events(service, dest_calendar_id, dry_run=False)
            if not success:
                print("❌ Failed to clear destination calendar. Aborting copy operation.")
                return False
        else:
            print("[DRY RUN] Would clear destination calendar first")
    
    # Get events from source calendar
    if reset_mode:
        print(f"\n📖 Step 2: Fetching events from source calendar for reset...")
    else:
        print(f"\n📖 Fetching events from source calendar...")
    source_events = get_calendar_events(service, source_calendar_id, start_date, end_date)
    
    if not source_events:
        print("ℹ️  No events found in source calendar.")
        return True
    
    print(f"Found {len(source_events)} events to copy")
    
    # Copy events to destination calendar
    copied_count = 0
    failed_count = 0
    skipped_count = 0
    
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Copying events...")
    
    for i, event in enumerate(source_events):
        summary = event.get('summary', 'No title')
        start = event.get('start', {})
        
        # Create a copy of the event data
        event_copy = prepare_event_for_copy(event)
        
        if not event_copy:
            print(f"⏭️  Skipping event (invalid data): {summary}")
            skipped_count += 1
            continue
        
        print(f"{'[DRY RUN] ' if dry_run else ''}📋 Copying: {summary}")
        
        if start.get('dateTime'):
            event_date = start['dateTime'][:10]
        elif start.get('date'):
            event_date = start['date']
        else:
            event_date = 'Unknown date'
        
        print(f"  📅 Date: {event_date}")
        
        if event.get('location'):
            print(f"  📍 Location: {event['location']}")
        
        if not dry_run:
            # Create the event in destination calendar
            created_event = create_event(service, dest_calendar_id, event_copy)
            
            if created_event:
                copied_count += 1
                print(f"  ✅ Successfully copied")
            else:
                failed_count += 1
                print(f"  ❌ Failed to copy")
        else:
            copied_count += 1
            print(f"  ✅ Would copy successfully")
        
        # Progress update for large numbers of events
        if (i + 1) % 20 == 0:
            print(f"Progress: {i + 1}/{len(source_events)} events processed...")
    
    # Summary
    print("\n" + "="*60)
    print("📊 COPY SUMMARY:")
    print(f"  Total events in source: {len(source_events)}")
    if dry_run:
        print(f"  Events that would be copied: {copied_count}")
        if skipped_count > 0:
            print(f"  Events that would be skipped: {skipped_count}")
    else:
        print(f"  Events successfully copied: {copied_count}")
        if failed_count > 0:
            print(f"  Events failed to copy: {failed_count}")
        if skipped_count > 0:
            print(f"  Events skipped: {skipped_count}")
    
    success = failed_count == 0
    if success:
        if dry_run:
            print("\n✅ Dry run completed successfully!")
            if reset_mode:
                print("Use without --dry-run to actually reset the calendar.")
            else:
                print("Use without --dry-run to actually copy the events.")
        else:
            if reset_mode:
                print("\n🔄 Calendar reset completed successfully!")
                print("Your destination calendar has been cleared and repopulated with fresh events from the source.")
            else:
                print("\n🎉 Calendar copy completed successfully!")
    else:
        if reset_mode:
            print(f"\n⚠️  Calendar reset completed with {failed_count} errors.")
        else:
            print(f"\n⚠️  Copy completed with {failed_count} errors.")
    
    return success

def prepare_event_for_copy(source_event):
    """Prepare an event for copying by removing/modifying certain fields."""
    
    # Skip if missing essential data
    if not source_event.get('summary') or not source_event.get('start'):
        return None
    
    # Create a clean copy of the event
    event_copy = {
        'summary': source_event['summary'],
        'start': source_event['start'],
        'end': source_event['end'],
    }
    
    # Copy optional fields if they exist
    if source_event.get('description'):
        event_copy['description'] = source_event['description']
    
    if source_event.get('location'):
        event_copy['location'] = source_event['location']
    
    if source_event.get('colorId'):
        event_copy['colorId'] = source_event['colorId']
    
    # Copy recurrence rules if present
    if source_event.get('recurrence'):
        event_copy['recurrence'] = source_event['recurrence']
    
    # Copy attendees if present (but they won't get invitations)
    if source_event.get('attendees'):
        # Note: Copied attendees won't receive invitations
        event_copy['attendees'] = source_event['attendees']
    
    # Copy reminders if present
    if source_event.get('reminders'):
        event_copy['reminders'] = source_event['reminders']
    
    # Note: We don't copy:
    # - id (will be auto-generated)
    # - created, updated (will be auto-set)
    # - creator, organizer (will be set to the service account)
    # - htmlLink (will be auto-generated)
    # - iCalUID (will be auto-generated)
    
    return event_copy

def main():
    """Main function with command line interface."""
    
    # Default parameters
    service_account_file = get_service_account_file()
    dest_calendar_id = get_calendar_id()
    source_calendar_id = get_source_calendar_id()  # Now defaults from env var
    dry_run = False
    clear_destination = False
    reset_mode = False  # New reset option
    start_date = None
    end_date = None
    list_calendars_only = False
    
    # Parse command line arguments
    args = sys.argv[1:]
    
    # Show usage if help requested or no args
    if '-h' in args or '--help' in args or len(args) == 0:
        print("Usage: python calendar_copier.py [options] [--source SOURCE_CALENDAR_ID]")
        print("")
        print("Copies calendar events from a source calendar to a destination calendar.")
        print("Useful for resetting development state.")
        print("")
        print("Options:")
        print("  --source CALENDAR_ID       Source calendar ID (default: from GOOGLE_SOURCE_CALENDAR_ID env var)")
        print("  --dest CALENDAR_ID         Destination calendar ID (default: from GOOGLE_CALENDAR_ID env var)")
        print("  --dry-run                  Show what would be copied without making changes")
        print("  --reset                    Clear destination and copy source events (combines --clear-destination)")
        print("  --clear-destination        Delete all events from destination first")
        print("  --start-date YYYY-MM-DD    Start date for copying (default: 2025-05-01)")
        print("  --end-date YYYY-MM-DD      End date for copying (default: 2025-08-31)")
        print("  --list-calendars           List all accessible calendars and exit")
        print("  --service-account FILE     Override service account file from env var")
        print("  -h, --help                 Show this help message")
        print("")
        print("Environment Variables:")
        print("  GOOGLE_SERVICE_ACCOUNT_KEY_FILE  Path to service account JSON file")
        print("  GOOGLE_CALENDAR_ID              Default destination calendar ID")
        print("  GOOGLE_SOURCE_CALENDAR_ID       Default source calendar ID")
        print("")
        print("Examples:")
        print("  # List available calendars")
        print("  python calendar_copier.py --list-calendars")
        print("")
        print("  # Quick reset using env vars (clears destination + copies source)")
        print("  python calendar_copier.py --reset")
        print("")
        print("  # Reset with dry run to see what would happen")
        print("  python calendar_copier.py --reset --dry-run")
        print("")
        print("  # Copy using env vars (no --source needed if GOOGLE_SOURCE_CALENDAR_ID is set)")
        print("  python calendar_copier.py --dry-run")
        print("")
        print("  # Override source calendar")
        print("  python calendar_copier.py --source template-calendar@gmail.com --dry-run")
        print("")
        print("  # Copy events and clear destination first")
        print("  python calendar_copier.py --clear-destination")
        print("")
        print("  # Copy specific date range")
        print("  python calendar_copier.py --start-date 2025-06-01 --end-date 2025-06-30")
        print("")
        return
    
    # Process arguments
    i = 0
    while i < len(args):
        arg = args[i]
        
        if arg == '--dry-run':
            dry_run = True
        elif arg == '--clear-destination':
            clear_destination = True
        elif arg == '--reset':
            reset_mode = True
            clear_destination = True  # Reset implies clearing destination
        elif arg == '--list-calendars':
            list_calendars_only = True
        elif arg == '--source' and i + 1 < len(args):
            source_calendar_id = args[i + 1]
            i += 1
        elif arg == '--dest' and i + 1 < len(args):
            dest_calendar_id = args[i + 1]
            i += 1
        elif arg == '--start-date' and i + 1 < len(args):
            try:
                start_date = datetime.strptime(args[i + 1], '%Y-%m-%d')
                i += 1
            except ValueError:
                print(f"Error: Invalid start date format '{args[i + 1]}'. Use YYYY-MM-DD")
                return
        elif arg == '--end-date' and i + 1 < len(args):
            try:
                end_date = datetime.strptime(args[i + 1], '%Y-%m-%d')
                i += 1
            except ValueError:
                print(f"Error: Invalid end date format '{args[i + 1]}'. Use YYYY-MM-DD")
                return
        elif arg == '--service-account' and i + 1 < len(args):
            service_account_file = args[i + 1]
            i += 1
        else:
            print(f"Unknown argument: {arg}")
            print("Use --help for usage information")
            return
        
        i += 1
    
    # Validate service account file
    if not Path(service_account_file).exists():
        print(f"Error: Service account file '{service_account_file}' does not exist.")
        print(f"Current value from environment: {os.getenv('GOOGLE_SERVICE_ACCOUNT_KEY_FILE', 'Not set')}")
        return
    
    # Set up API
    service = setup_google_calendar_api(service_account_file)
    if not service:
        return
    
    # Handle list calendars mode
    if list_calendars_only:
        print("📋 Listing all accessible calendars:")
        print("-" * 60)
        calendars = list_calendars(service)
        print("")
        print("💡 Use the calendar ID (the long string) as the --source or --dest parameter")
        return
    
    # Validate required parameters
    if not source_calendar_id:
        print("Error: Source calendar ID is required!")
        print("Either:")
        print("  1. Set GOOGLE_SOURCE_CALENDAR_ID in your .env file, or")
        print("  2. Use --source CALENDAR_ID parameter")
        print("")
        print("Use --list-calendars to see available calendars")
        print("Use --help for usage information")
        return
    
    # Validate date range
    if start_date and end_date and start_date > end_date:
        print("Error: Start date must be before or equal to end date")
        return
    
    # Run the copy operation
    success = copy_calendar_events(
        service=service,
        source_calendar_id=source_calendar_id,
        dest_calendar_id=dest_calendar_id,
        start_date=start_date,
        end_date=end_date,
        dry_run=dry_run,
        clear_destination=clear_destination,
        reset_mode=reset_mode
    )
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main() 