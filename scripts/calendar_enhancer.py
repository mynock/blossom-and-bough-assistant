#!/usr/bin/env python3
"""
Google Calendar Event Enhancer

Updates calendar events directly in Google Calendar with client metadata and status logic.
Requires Google Calendar API setup and authentication using service account.
"""

import re
import csv
import sys
from datetime import datetime, timedelta

# Import our shared library
try:
    from calendar_lib import (
        setup_google_calendar_api, get_service_account_file, get_calendar_id,
        get_calendar_events, update_event, delete_all_events, WORK_TYPE_COLORS,
        parse_event_date, show_help
    )
except ImportError:
    print("Error: calendar_lib.py not found in the same directory!")
    print("Make sure both calendar_enhancer.py and calendar_lib.py are in the scripts/ directory.")
    sys.exit(1)

# Google Sheets API imports (for client data)
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    import os
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv()
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

# Helper name mapping - convert informal names to formal names
HELPER_NAME_MAPPING = {
    'Rorick': 'Rebecca',
    'rorick': 'Rebecca',
    'RORICK': 'Rebecca',
    # Add more mappings as needed
    # 'Anne': 'Anne',  # Example - already correct
    # 'Megan': 'Megan',  # Example - already correct
    # 'Virginia': 'Virginia',  # Example - already correct
}

def map_helper_name(helper_name):
    """Map informal helper names to formal names."""
    if not helper_name:
        return helper_name
    
    # Handle complex helper strings like "Rorick SOLO" or "**Anne?"
    # Extract the base name and preserve any modifiers
    original = helper_name
    modifiers = ""
    
    # Extract modifiers (SOLO, ?, **, etc.)
    import re
    
    # Pattern to match modifiers at the end
    modifier_pattern = r'(\s+(?:SOLO|solo)|\?|\*+)$'
    modifier_match = re.search(modifier_pattern, helper_name)
    if modifier_match:
        modifiers = modifier_match.group(1)
        helper_name = helper_name[:modifier_match.start()]
    
    # Pattern to match modifiers at the beginning
    prefix_pattern = r'^(\*+\s*)'
    prefix_match = re.match(prefix_pattern, helper_name)
    prefix = ""
    if prefix_match:
        prefix = prefix_match.group(1)
        helper_name = helper_name[prefix_match.end():]
    
    # Clean up the core name
    core_name = helper_name.strip()
    
    # Apply mapping
    mapped_name = HELPER_NAME_MAPPING.get(core_name, core_name)
    
    # Reconstruct with modifiers
    result = prefix + mapped_name + modifiers
    
    return result

def parse_sheets_clients(service_account_file):
    """Parse client data from Google Sheets and return a dictionary keyed by client name."""
    clients = {}
    
    try:
        # Set up Google Sheets API
        if not Path(service_account_file).exists():
            print(f"Error: Service account file '{service_account_file}' not found!")
            return {}
        
        credentials = service_account.Credentials.from_service_account_file(
            service_account_file, scopes=SCOPES)
        
        sheets_service = build('sheets', 'v4', credentials=credentials)
        
        # Get spreadsheet ID from environment variable
        spreadsheet_id = os.getenv('GOOGLE_SHEETS_ID')
        if not spreadsheet_id:
            print("Error: GOOGLE_SHEETS_ID environment variable not set!")
            return {}
        
        # Read client data from Clients sheet
        range_name = 'Clients!A2:S100'  # Matches the TypeScript service range
        
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=range_name
        ).execute()
        
        rows = result.get('values', [])
        print(f"Found {len(rows)} client records in Google Sheets")
        
        for row in rows:
            if not row or not row[0]:  # Skip empty rows
                continue
            
            # Parse row data based on your sheet structure:
            # Client_ID | Name | Address | Geo Zone | Is_Recurring_Maintenance | Maintenance_Interval_Weeks | 
            # Maintenance_Hours_Per_Visit | Maintenance_Rate | Last_Maintenance | Next_Maintenance | 
            # Priority_Level | Schedule_Flexibility | Preferred_Days | Preferred_Time | Special_Notes | Active_Status
            
            name = row[1] if len(row) > 1 else ''
            if not name:
                continue
                
            # Extract just the client name from entries like "Silver (C013)"
            base_name = re.sub(r'\s*\([^)]*\)', '', name).strip()
            
            clients[base_name] = {
                'full_name': name,
                'address': row[2] if len(row) > 2 else '',
                'geo_zone': row[3] if len(row) > 3 else '',
                'is_recurring': (row[4] if len(row) > 4 else '').upper() == 'TRUE',
                'maintenance_interval': row[5] if len(row) > 5 else '',
                'maintenance_hours': row[6] if len(row) > 6 else '',
                'maintenance_rate': row[7] if len(row) > 7 else '',
                'last_maintenance': row[8] if len(row) > 8 else '',
                'next_target': row[9] if len(row) > 9 else '',
                'priority_level': row[10] if len(row) > 10 else '',
                'schedule_flexibility': row[11] if len(row) > 11 else '',
                'preferred_days': row[12] if len(row) > 12 else '',
                'preferred_time': row[13] if len(row) > 13 else '',
                'special_notes': row[14] if len(row) > 14 else '',
                'active_status': row[15] if len(row) > 15 else ''
            }
            
    except Exception as e:
        print(f"Error reading from Google Sheets: {e}")
        print("Make sure:")
        print("1. GOOGLE_SHEETS_ID environment variable is set")
        print("2. Service account has access to the spreadsheet")
        print("3. Spreadsheet has a 'Clients' sheet with the expected structure")
        return {}
    
    return clients

def parse_csv_clients(csv_file):
    """Parse the client CSV and return a dictionary keyed by client name."""
    # Deprecated: Use parse_sheets_clients instead
    print("⚠️  Warning: CSV parsing is deprecated. Use Google Sheets integration instead.")
    clients = {}
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Extract just the client name from entries like "Silver (C013)"
                name = row['Name']
                base_name = re.sub(r'\s*\([^)]*\)', '', name).strip()
                
                clients[base_name] = {
                    'full_name': name,
                    'address': row['Address'],
                    'geo_zone': row['Geo Zone'],
                    'is_recurring': row['Is_Recurring_Maintenance'].lower() == 'true',
                    'maintenance_interval': row['Maintenance_Interval_Weeks'],
                    'maintenance_hours': row['Maintenance_Hours_Per_Visit'],
                    'maintenance_rate': row['Maintenance_Rate'],
                    'last_maintenance': row['Last_Maintenance_Date'],
                    'next_target': row['Next_Maintenance_Target'],
                    'priority_level': row['Priority_Level'],
                    'schedule_flexibility': row['Schedule_Flexibility'],
                    'preferred_days': row['Preferred_Days'],
                    'preferred_time': row['Preferred_Time'],
                    'special_notes': row['Special_Notes'],
                    'active_status': row['Active_Status']
                }
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        return {}
    
    return clients

def count_stars_in_summary(summary):
    """Count the number of asterisks at the beginning of the summary."""
    if not summary:
        return 0
    match = re.match(r'^(\*+)', summary)
    return len(match.group(1)) if match else 0

def should_skip_event(summary):
    """Check if event should be skipped based on title content."""
    if not summary:
        return True
    
    # Don't skip Design or Office events - we now process them with their own work types
    return False

def determine_work_type(summary, client_data=None):
    """Determine the work type from the event summary."""
    if not summary:
        return "Maintenance"
    
    # Clean up summary for analysis
    clean_summary = re.sub(r'^\*+\s*', '', summary).lower()
    
    # Check for specific work type keywords with more precise matching
    # Design work - use word boundaries to avoid false matches like "planting" containing "plan"
    design_keywords = ['design', 'consultation', r'\bplanning\b', r'\bplan\b', 'estimate']
    if any(re.search(keyword if keyword.startswith(r'\b') else re.escape(keyword), clean_summary) for keyword in design_keywords):
        return "Design"
    elif any(keyword in clean_summary for keyword in ['office', 'invoice', 'quote', 'admin', 'paperwork', 'follow-up']):
        return "Office Work"
    elif any(keyword in clean_summary for keyword in ['errands', 'supply', 'pickup', 'equipment service', 'shop', 'truck service', 'tool', 'equipment maintenance', 'repair']):
        return "Errands"
    elif any(keyword in clean_summary for keyword in ['storm', 'emergency', 'urgent', 'fix']):
        return "Ad-hoc"
    else:
        # Default to Maintenance for client work
        return "Maintenance"

def extract_client_name(summary):
    """Extract client name from summary by removing stars and extra text."""
    if not summary:
        return ""
    
    # Handle already-processed events with [Status] format
    # E.g., "[Confirmed] Thomas - Maintenance (Anne) | Pruning" -> "Thomas"
    status_pattern = r'^\[.*?\]\s*([^-]+)\s*-\s*.*'
    status_match = re.match(status_pattern, summary)
    if status_match:
        client_name = status_match.group(1).strip()
        return client_name, client_name
    
    # Remove leading asterisks
    clean_summary = re.sub(r'^\*+\s*', '', summary)
    
    # Check if this looks like a non-client event (Office Work, Errands, etc.)
    non_client_keywords = ['office', 'errands', 'equipment maintenance', 'truck service', 'tool']
    if any(keyword in clean_summary.lower() for keyword in non_client_keywords):
        return None, None  # No client name for these types
    
    # Split on common separators and take first part
    separators = ['+', '(', ',', ':', ';', '-']
    for sep in separators:
        if sep in clean_summary:
            clean_summary = clean_summary.split(sep)[0].strip()
            break
    
    # For cases like "Thomas BOXWOODS" or "Butzbaugh LADDER"
    # Split on whitespace and take first 1-2 words to handle cases like "Thomas 2"
    words = clean_summary.split()
    if len(words) >= 1:
        # Try first word only
        first_word = words[0]
        # Also try first two words in case of names like "Thomas 2"
        if len(words) >= 2:
            first_two_words = f"{words[0]} {words[1]}"
            return first_two_words, first_word  # Return both options for checking
        return first_word, first_word
    
    return clean_summary.strip(), clean_summary.strip()

def find_matching_client(event_summary, clients):
    """Find matching client from the clients dictionary, trying multiple name variations."""
    if not event_summary:
        return None
    
    # Get potential client names
    name_options = extract_client_name(event_summary)
    if isinstance(name_options, tuple) and name_options[0] is None:
        return None  # This is a non-client event
    
    if isinstance(name_options, tuple):
        primary_name, fallback_name = name_options
    else:
        primary_name = fallback_name = name_options
    
    # Try exact matches first
    for name_option in [primary_name, fallback_name]:
        if name_option and name_option in clients:
            return clients[name_option]
    
    # Try case-insensitive matches
    for name_option in [primary_name, fallback_name]:
        if name_option:
            for client_key in clients.keys():
                if name_option.lower() == client_key.lower():
                    return clients[client_key]
    
    return None

def determine_status(summary, event_date, reference_date):
    """Determine event status based on star count and timing."""
    star_count = count_stars_in_summary(summary)
    
    if star_count == 0:
        # No stars = confirmed with client
        return "confirmed", "C"
    elif star_count == 1:
        # 1 star - depends on timing
        days_diff = (event_date - reference_date).days
        if abs(days_diff) <= 14:
            # Within 2 weeks: confident, need to confirm with client
            return "confirmed", "C"
        else:
            # Outside 2 weeks: tentative, need to confirm with myself and client
            return "tentative", "T"
    elif star_count >= 2:
        # 2+ stars = things that must happen but haven't determined hours/when
        return "planning", "P"
    
    return "tentative", "T"  # default

def extract_notes_from_summary(summary, client_name=None):
    """Extract notes/details from the event summary."""
    if not summary:
        return ""
    
    # Remove leading asterisks
    clean_summary = re.sub(r'^\*+\s*', '', summary)
    
    # For non-client events (Office Work, Errands, etc.)
    non_client_keywords = ['office work', 'errands']
    for keyword in non_client_keywords:
        if keyword in clean_summary.lower():
            # Extract everything after the keyword
            parts = clean_summary.lower().split(keyword, 1)
            if len(parts) > 1:
                notes = parts[1].strip()
                # Remove common separators at the beginning
                notes = re.sub(r'^[|\-:\s]+', '', notes)
                return notes.strip()
            return ""
    
    if client_name:
        # Remove client name from beginning
        words = clean_summary.split()
        client_words = client_name.split()
        
        # Skip past the client name words
        start_index = 0
        if len(client_words) == 1:
            if len(words) > 0 and words[0].lower() == client_words[0].lower():
                start_index = 1
        elif len(client_words) == 2:
            if len(words) >= 2 and words[0].lower() == client_words[0].lower() and words[1].lower() == client_words[1].lower():
                start_index = 2
            elif len(words) > 0 and words[0].lower() == client_words[0].lower():
                start_index = 1
        
        # Get remaining words as notes
        if start_index < len(words):
            remaining_text = ' '.join(words[start_index:])
            # Clean up common separators and extra words
            remaining_text = re.sub(r'^(maintenance|maint)\s*', '', remaining_text, flags=re.IGNORECASE)
            remaining_text = re.sub(r'^[\-\(\)\s]+', '', remaining_text)
            remaining_text = re.sub(r'\s+$', '', remaining_text)  # Only remove trailing spaces, not parentheses
            return remaining_text.strip()
    
    return ""

def create_standardized_title(status_label, client_name, work_type, helper_info=None, notes=""):
    """Create standardized event title in format [Status] Client - WorkType (Helper) | Notes."""
    
    # Handle non-client events (Office Work, Errands, etc.)
    if not client_name:
        title_parts = [f"[{status_label}]", work_type]
        
        if helper_info:
            title_parts.append(f"({helper_info})")
        
        if notes:
            title_parts.append(f"| {notes}")
        
        return " ".join(title_parts)
    
    # Client events: [Status] Client - WorkType (Helper) | Notes
    title_parts = [f"[{status_label}]", client_name, "-", work_type]
    
    if helper_info:
        title_parts.append(f"({helper_info})")
    
    if notes:
        title_parts.append(f"| {notes}")
    
    return " ".join(title_parts)

def get_color_for_work_type(work_type):
    """Get the Google Calendar color ID for a given work type."""
    return WORK_TYPE_COLORS.get(work_type, '10')  # Default to green/basil for Maintenance

def extract_helper_info_from_events(events):
    """Extract helper information from all-day events."""
    helper_schedule = {}
    
    for event in events:
        # Check if this is an all-day event
        start = event.get('start', {})
        if 'date' in start and 'dateTime' not in start:
            # This is an all-day event
            summary = event.get('summary', '').strip()
            event_date_str = start['date']
            
            # Skip if no summary or if it looks like a client event
            if not summary:
                continue
                
            # Skip obvious non-helper events (client names, office work, etc.)
            skip_keywords = ['office', 'design', 'invoices', 'sched', 'comms', 'pdxn', 'shop']
            if any(keyword in summary.lower() for keyword in skip_keywords):
                continue
                
            # Assume single names are helpers (Anne, Virginia, Megan, etc.)
            # Also handle patterns like "Anne + Megan"
            if len(summary.split()) <= 3:  # Helper names are usually short
                helper_schedule[event_date_str] = summary
                
    return helper_schedule

def get_helper_for_date(event_date, helper_schedule, fallback_helpers=None):
    """Get helper information for a specific date."""
    # Convert event_date to date string format (YYYY-MM-DD)
    if hasattr(event_date, 'date'):
        date_str = event_date.date().strftime('%Y-%m-%d')
    else:
        date_str = event_date.strftime('%Y-%m-%d')
    
    # Check all-day events first (priority)
    if date_str in helper_schedule:
        return helper_schedule[date_str]
    
    # TODO: Add fallback logic from spreadsheet if needed
    # For now, return None if no helper found
    return None

def create_enhanced_description(client_data, service_type="Maintenance", additional_details=None, helper_info=None):
    """Create enhanced description based on client data (replaces existing)."""
    desc_parts = []
    
    # Basic client info
    desc_parts.append(f"CLIENT: {client_data['full_name']}")
    desc_parts.append(f"SERVICE: {service_type}")
    desc_parts.append("")
    
    # Helper information (if available)
    if helper_info:
        desc_parts.append(f"HELPER: {helper_info}")
        desc_parts.append("")
    
    # Additional details from original title
    if additional_details:
        details_text = ' '.join(additional_details).upper()
        desc_parts.append(f"DETAILS: {details_text}")
        desc_parts.append("")
    
    # Service details
    if client_data.get('maintenance_hours'):  # Added .get() for safety
        desc_parts.append(f"ESTIMATED HOURS: {client_data['maintenance_hours']}")
    
    if client_data.get('priority_level'):  # Added .get() for safety
        desc_parts.append(f"PRIORITY: {client_data['priority_level']}")
    
    if client_data.get('schedule_flexibility'):  # Added .get() for safety
        desc_parts.append(f"FLEXIBILITY: {client_data['schedule_flexibility']}")
    desc_parts.append("")
    
    # Location info
    if client_data.get('geo_zone'):  # Added .get() for safety
        desc_parts.append(f"ZONE: {client_data['geo_zone']}")
        desc_parts.append("")
    
    # Additional notes
    if client_data.get('special_notes') and client_data['special_notes'].strip():
        desc_parts.append(f"NOTES: {client_data['special_notes']}")
        desc_parts.append("")
    
    # Preferences
    if client_data.get('preferred_days'):  # Added .get() for safety
        desc_parts.append(f"PREFERRED DAYS: {client_data['preferred_days']}")
    
    if client_data.get('preferred_time'):  # Added .get() for safety
        desc_parts.append(f"PREFERRED TIME: {client_data['preferred_time']}")
    
    return "\n".join(desc_parts)

def create_non_client_description(work_type, notes="", helper_info=None):
    """Create description for non-client events (Office Work, Errands, etc.)."""
    desc_parts = []
    
    desc_parts.append(f"WORK TYPE: {work_type}")
    
    if helper_info:
        desc_parts.append(f"HELPER: {helper_info}")
    
    if notes:
        desc_parts.append(f"DETAILS: {notes}")
    
    return "\n".join(desc_parts)

def enhance_calendar_events(csv_file, service_account_file, calendar_id='primary', dry_run=False, force_reprocess=False, use_sheets=True):
    """Main function to enhance calendar events with client data."""
    
    # Set up API
    service = setup_google_calendar_api(service_account_file)
    if not service:
        return False
    
    # Load client data
    if use_sheets:
        clients = parse_sheets_clients(service_account_file)
    else:
        clients = parse_csv_clients(csv_file)
    print(f"Loaded {len(clients)} clients from {'Google Sheets' if use_sheets else f'CSV file: {csv_file}'}")
    
    # Get calendar events
    events = get_calendar_events(service, calendar_id)
    if not events:
        print("No events found in the specified date range")
        return False
    
    # Extract helper information from all-day events
    helper_schedule = extract_helper_info_from_events(events)
    print(f"Found helper information for {len(helper_schedule)} days")
    
    # Reference date for status calculation
    reference_date = datetime.now()
    
    events_to_update = 0
    events_updated = 0
    events_skipped_no_match = 0
    events_skipped_filtered = 0
    events_already_processed = 0
    
    print(f"\n{'DRY RUN - ' if dry_run else ''}Processing events...")
    
    for event in events:
        event_id = event['id']
        summary = event.get('summary', '')
        
        # Skip all-day events (these are just for helper information)
        start = event.get('start', {})
        if 'date' in start and 'dateTime' not in start:
            continue  # Skip all-day events
        
        # Skip events without summaries
        if not summary:
            continue
        
        # Check if event has already been processed
        if is_already_processed(summary):
            events_already_processed += 1
            if not force_reprocess:
                print(f"🔄 Already processed: {summary}")
                continue
            else:
                print(f"🔄 Re-processing: {summary}")
        
        # Skip events based on filtering (now very minimal since we process most event types)
        if should_skip_event(summary):
            events_skipped_filtered += 1
            print(f"⏭️  Skipping (filtered): {summary}")
            continue
        
        # Determine work type first
        work_type = determine_work_type(summary)
        
        # Extract client name and check if we have data for them
        client_data = find_matching_client(summary, clients)
        
        # For client events, we need client data. For non-client events, we don't.
        is_client_event = work_type in ['Maintenance', 'Ad-hoc', 'Design']
        
        if is_client_event and not client_data:
            events_skipped_no_match += 1
            # Show the attempted name extraction for debugging
            name_options = extract_client_name(summary)
            if isinstance(name_options, tuple):
                extracted_names = f"'{name_options[0]}' or '{name_options[1]}'" if name_options[0] else "None"
            else:
                extracted_names = f"'{name_options}'" if name_options else "None"
            print(f"❓ Skipping (no client match): {summary} → extracted: {extracted_names}")
            continue
        
        # Parse event date
        event_date = parse_event_date(event)
        
        # Get helper information for this date
        helper_info = get_helper_for_date(event_date, helper_schedule)
        
        # Apply helper name mapping (e.g., Rorick -> Rebecca Smith)
        if helper_info:
            helper_info = map_helper_name(helper_info)
        
        # Extract notes from summary
        client_name = client_data['full_name'] if client_data else None
        notes = extract_notes_from_summary(summary, client_name)
        
        # Determine what needs updating
        updates = {}
        
        # Update status based on star logic (status is encoded in title, not stored separately)
        new_status, status_label = determine_status(summary, event_date, reference_date)
        
        # Create new title with the updated format
        new_title = create_standardized_title(status_label, client_name, work_type, helper_info, notes)
        updates['summary'] = new_title
        
        # Set color based on work type
        color_id = get_color_for_work_type(work_type)
        updates['colorId'] = color_id
        
        # Create appropriate description
        if client_data:
            new_description = create_enhanced_description(client_data, work_type, notes, helper_info)
            # Replace location with client address
            updates['location'] = client_data['address']
        else:
            new_description = create_non_client_description(work_type, notes, helper_info)
        
        updates['description'] = new_description
        
        # Apply updates
        events_to_update += 1
        
        print(f"{'[DRY RUN] ' if dry_run else ''}✅ Updating: {summary}")
        if client_data:
            print(f"  Client: {client_data['full_name']}")
        print(f"  Work Type: {work_type}")
        print(f"  New Title: {new_title}")
        print(f"  Status: → {new_status} ({status_label})")
        
        # Enhanced color information with descriptive names
        color_name_map = {
            '10': 'Green/Basil',
            '4': 'Flamingo/Pale Red', 
            '3': 'Grape/Mauve',
            '8': 'Graphite/Gray',
            '6': 'Tangerine/Orange'
        }
        color_name = color_name_map.get(color_id, f'Color {color_id}')
        print(f"  Color: → {color_id} ({color_name}) - {work_type}")
        
        if helper_info:
            print(f"  Helper: → {helper_info}")
        if client_data and client_data['address']:
            print(f"  Location: → {client_data['address']}")
        print(f"  Description: → Enhanced with {'client' if client_data else 'work type'} metadata")
        if notes:
            print(f"  Notes: → {notes}")
        print()
        
        if not dry_run:
            if update_event(service, calendar_id, event_id, updates):
                events_updated += 1
            else:
                print(f"  ❌ Failed to update event: {summary}")
    
    print(f"Summary:")
    print(f"  Total events found: {len(events)}")
    print(f"  Events skipped (filtered): {events_skipped_filtered}")
    print(f"  Events skipped (no client match): {events_skipped_no_match}")
    print(f"  Events already processed: {events_already_processed}")
    print(f"  Client events to update: {events_to_update}")
    if not dry_run:
        print(f"  Events successfully updated: {events_updated}")
        if events_to_update > events_updated:
            print(f"  Events failed: {events_to_update - events_updated}")
    
    return True

def main():
    """Main function with command line interface."""
    
    # Default parameters - use environment variables from shared library
    csv_file = "Clients.csv"  # Kept for backward compatibility, but deprecated
    service_account_file = get_service_account_file()
    calendar_id = get_calendar_id()
    dry_run = False
    force_reprocess = False
    delete_all = False
    use_sheets = True  # Default to Google Sheets
    
    # Parse command line arguments
    args = sys.argv[1:]
    
    # Show usage if help requested
    if '-h' in args or '--help' in args:
        print("Usage: python calendar_enhancer.py [options]")
        print("")
        print("Enhances Google Calendar events with client metadata and status logic.")
        print("")
        print("Options:")
        print("  --dry-run              Show what would be updated without making changes")
        print("  --force-reprocess      Re-process events that have already been processed")
        print("  --delete-all-events    Delete ALL events from the calendar (with confirmation)")
        print("  --use-csv              Use CSV file instead of Google Sheets (deprecated)")
        print("  --calendar-id ID       Override calendar ID from environment variable")
        print("  --service-account FILE Override service account file from environment variable")
        print("  -h, --help             Show this help message")
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
        print("Star Logic:")
        print("  No stars     - STATUS: [C] (confirmed with client)")
        print("  1 star ≤2wk  - STATUS: [C] (confident - need to confirm with client)")
        print("  1 star >2wk  - STATUS: [T] (tentative - need to confirm with self and client)")
        print("  2+ stars     - STATUS: [P] (planning - must happen, but hours/timing TBD)")
        print("")
        print("Format: [Status] Client - WorkType (Helper) | Notes")
        print("")
        print("Work Types & Colors:")
        print("  Maintenance         - Green/Basil (ID: 10)     (recurring scheduled work)")
        print("  Ad-hoc             - Flamingo/Pale Red (ID: 4) (one-off client visits)")
        print("  Design             - Grape/Mauve (ID: 3)       (consultation/planning work)")
        print("  Office Work        - Graphite/Gray (ID: 8)     (internal business tasks)")
        print("  Errands            - Tangerine/Orange (ID: 6)  (supply runs, equipment service, truck/tool maintenance)")
        print("")
        print("Note: This will REPLACE existing descriptions and locations for events")
        print("      Helper information will be extracted from all-day events and added to titles")
        print("")
        print("⚠️  DANGER ZONE:")
        print("  --delete-all-events will permanently delete ALL events in the calendar!")
        print("  Use --dry-run with this option to see what would be deleted first.")
        return
    
    # Process arguments - same logic as before
    if '--dry-run' in args:
        dry_run = True
        args.remove('--dry-run')
    
    if '--force-reprocess' in args:
        force_reprocess = True
        args.remove('--force-reprocess')
    
    if '--delete-all-events' in args:
        delete_all = True
        args.remove('--delete-all-events')
    
    if '--use-csv' in args:
        use_sheets = False
        args.remove('--use-csv')
    
    if '--calendar-id' in args:
        idx = args.index('--calendar-id')
        if idx + 1 < len(args):
            calendar_id = args[idx + 1]
            args.remove('--calendar-id')
            args.remove(calendar_id)
    
    if '--service-account' in args:
        idx = args.index('--service-account')
        if idx + 1 < len(args):
            service_account_file = args[idx + 1]
            args.remove('--service-account')
            args.remove(service_account_file)
    
    # Remaining args are csv_file (for backward compatibility)
    if len(args) >= 1:
        csv_file = args[0]
    
    # Validate service account file
    if not Path(service_account_file).exists():
        print(f"Error: Service account file '{service_account_file}' does not exist.")
        print(f"Current value from environment: {os.getenv('GOOGLE_SERVICE_ACCOUNT_KEY_FILE', 'Not set')}")
        return
    
    # Handle delete all events mode
    if delete_all:
        print(f"🗑️  DELETE ALL EVENTS MODE")
        print(f"Service Account: {service_account_file}")
        print(f"Calendar: {calendar_id}")
        print(f"Mode: {'DRY RUN' if dry_run else 'LIVE DELETION'}")
        print("-" * 60)
        
        # Set up API
        service = setup_google_calendar_api(service_account_file)
        if not service:
            return
        
        success = delete_all_events(service, calendar_id, dry_run)
        
        if success:
            if dry_run:
                print("\n✅ Dry run completed! Use without --dry-run to actually delete events.")
            else:
                print("\n🗑️ Event deletion completed!")
        else:
            print("❌ Failed to delete events.")
        
        return
    
    # Regular enhancement mode - validate data source
    if not use_sheets and not Path(csv_file).exists():
        print(f"Error: CSV file '{csv_file}' does not exist.")
        return
    
    if use_sheets:
        sheets_id = os.getenv('GOOGLE_SHEETS_ID')
        if not sheets_id:
            print("Error: GOOGLE_SHEETS_ID environment variable not set!")
            print("Please add GOOGLE_SHEETS_ID to your .env file")
            return
    
    # Run the enhancement
    print(f"Google Calendar Event Enhancer (Service Account)")
    print(f"Data Source: {'Google Sheets' if use_sheets else f'CSV file: {csv_file}'}")
    if use_sheets:
        print(f"Sheets ID: {os.getenv('GOOGLE_SHEETS_ID')}")
    print(f"Service Account: {service_account_file}")
    print(f"Calendar: {calendar_id}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE UPDATE'}")
    print("-" * 60)
    
    success = enhance_calendar_events(csv_file, service_account_file, calendar_id, dry_run, force_reprocess, use_sheets)
    
    if success:
        if dry_run:
            print("\n✅ Dry run completed! Use without --dry-run to apply changes.")
        else:
            print("\n🎉 Calendar enhancement completed!")
            print("Events now have:")
            print("- New format: [Status] Client - WorkType (Helper) | Notes")
            print("- Color coding by work type")
            print("- Structured information in descriptions")
            print("- Updated status based on star logic")
    else:
        print("❌ Failed to enhance calendar events.")

def is_already_processed(summary):
    """Check if an event has already been processed (has [Status] format)."""
    if not summary:
        return False
    return re.match(r'^\[.*?\]', summary) is not None

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

if __name__ == "__main__":
    main()