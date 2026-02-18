# Andrea's Scheduling System - Data Model

## Helpers
- **Helper ID** (unique identifier)
- **Name**
- **Regular workdays** (array: ["Monday", "Wednesday"])
- **Home address** (for travel optimization)
- **Min hours per day** (default: 7)
- **Max hours per day** (default: 8)
- **Capability tier** (1-5 scale or Beginner/Intermediate/Advanced)
- **Skills/specializations** (array: ["pruning", "installs", "irrigation"])
- **Communication preferences**
  - Notice required (hours/days)
  - Preferred contact method
- **Vacation/time-off** (calendar integration or separate tracking)
- **Hourly rate** (for cost calculations)
- **Active status** (active/inactive)

## Clients
- **Client ID** (unique identifier)
- **Name**
- **Address** (full address for mapping)
- **Service zone** (geographic grouping)
- **Email**
- **Phone**
- **Maintenance schedule**
  - Is maintenance client (yes/no)
  - Maintenance interval (weeks/months)
  - Hours per maintenance visit
  - Current maintenance rate ($/hour)
  - Most recent maintenance date
  - Next maintenance target date
- **Preferences/constraints**
  - Preferred days of week
  - Preferred time of day
  - Seasonal variations (pause in winter, etc.)
  - Special access requirements (gate codes, etc.)
- **Business details**
  - Priority tier (1-5 or High/Medium/Low)
  - Payment terms
  - Payment status (current/behind)
  - Schedule flexibility (Fixed/Preferred/Flexible)
- **Notes** (special requirements, quirks, etc.)
- **Active status** (active/inactive/seasonal)

## Projects
- **Project ID** (unique identifier)
- **Client ID** (foreign key)
- **Project name/description**
- **Project type** (Design, Install, Pruning, Maintenance, Repair, etc.)
- **Status** (Quoted, Approved, In Progress, Completed, On Hold)
- **Scheduling details**
  - Estimated on-site hours
  - Estimated office hours (design, planning, etc.)
  - Preferred/required completion date
  - Urgency level (Low/Medium/High/Critical)
  - Weather sensitivity (Indoor/Outdoor/Weather-dependent)
- **Requirements**
  - Required helper capability level
  - Required skills/specializations
  - Materials needed (affects scheduling)
  - Equipment requirements
- **Dependencies**
  - Prerequisite projects
  - Follow-up projects
- **Financial**
  - Quoted amount
  - Approved budget
  - Actual hours (tracking)
- **Notes**
- **Active status**

## Office Work Categories
- **Category ID** (unique identifier)
- **Category name** (Invoicing, Design, Planning, Bookkeeping, etc.)
- **Type** (Client-tied, Project-tied, General recurring)
- **Time requirements**
  - Hours per occurrence
  - Frequency (weekly, monthly, per-project, etc.)
  - Flexibility (time-sensitive vs. anytime)
- **Seasonal variations**
- **Dependencies** (must be done after certain field work)

## Calendar Events (Google Calendar Integration)
- **Event ID** (Google Calendar ID)
- **Title**
- **Start/end time**
- **Event type** (Client visit, Office work, Personal, etc.)
- **Linked records**
  - Client ID
  - Project ID
  - Helper ID
  - Office work category ID
- **Status metadata**
  - Confirmation level (Tentative/Confirmed/Client-notified)
  - Flexibility level (Fixed/Preferred/Flexible)
  - Communication status (Not sent/Sent/Confirmed)
- **Logistics**
  - Travel time buffer (built-in)
  - Materials needed
  - Special notes
- **Tracking**
  - Actual hours worked
  - Completion status

## Service Zones/Geographic Areas
- **Zone ID** (unique identifier)
- **Zone name** (Downtown, North Hills, etc.)
- **Boundaries** (coordinates or description)
- **Typical travel times** (to other zones)
- **Notes** (traffic patterns, access issues)

## System Configuration (Hard Constraints)
- **Travel thresholds**
  - Maximum travel time between jobs (minutes)
  - Maximum total travel time per day (minutes)
- **Business hours**
  - Earliest start time
  - Latest end time
- **Buffer time defaults** (between jobs, start of day, end of day)
- **Helper hour requirements**
  - Default minimum hours per day
  - Default maximum hours per day

## System Settings
- **Default travel speeds** (for different times of day)
- **Notification preferences** (when to alert about conflicts)
- **Integration settings** (Google Calendar sync frequency, etc.)

## LLM Context/Business Rules (Prompt-Based)
These rules are provided to the LLM as contextual instructions rather than rigid database constraints:

- **Seasonal prioritization** (maintenance priority in spring/fall, install focus in summer)
- **Weather decision-making** (reschedule policies, forecast thresholds)
- **Helper capability matching** (skill requirements for different project types)
- **Work sequencing preferences** (design before install, maintenance timing)
- **Optimization priorities** (geographic efficiency vs. helper preferences vs. client priorities)
- **Communication protocols** (when to notify clients, helper change management)
- **Scheduling flexibility guidelines** (which work can be moved, emergency priorities)

## Historical Data (for learning/optimization)
- **Actual vs. estimated hours** (by project type, helper, etc.)
- **Travel time accuracy** (actual vs. estimated)
- **Schedule change patterns** (what gets moved most often)
- **Seasonal demand patterns**
- **Helper performance metrics**