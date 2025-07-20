# Billable Hours Calculation System

This document describes how billable hours are calculated and modified throughout the Blossom & Bough scheduling assistant system.

**Last Updated:** 2025-01-19  
**Version:** 1.3

## Core Formula

The billable hours calculation formula used throughout the system:

```
# Step 1: Apply hours adjustments to total hours
adjustedTotalHours = totalHours + hoursAdjustments

# Step 2: Calculate billable hours from adjusted total hours
billableHours = adjustedTotalHours 
                - (breakTimeMinutes / 60)
                + (adjustedBreakTimeMinutes / 60)
                - (nonBillableTimeMinutes / 60) 
                + (adjustedTravelTimeMinutes / 60)
```

### Key Components

| Component | Description | Impact |
|-----------|-------------|---------|
| `totalHours` | Base work time (duration × employee count) | ➕ Starting point for calculation |
| `hoursAdjustments` | Person-specific adjustments from Notion | ➕/➖ Applied to total hours first |
| `adjustedTotalHours` | Total hours + hours adjustments | ➕ Base for billable calculation |
| `breakTimeMinutes` | Original break time | ➖ Subtracted (implicit in total, removed then adjusted added back) |
| `adjustedBreakTimeMinutes` | Allocated break time | ➕ **Billable time** (added to replace original break time) |
| `nonBillableTimeMinutes` | Non-billable activities | ➖ Subtracted from adjusted total |
| `adjustedTravelTimeMinutes` | Allocated travel time | ➕ Added to billable hours |

**Important Notes:**
- Raw `travelTimeMinutes` is stored for reference but **NOT** used in billable hours calculation
- **Break time logic**: Total hours includes break time implicitly, so original break time is subtracted and allocated break time is added back
- **Net effect**: Break time allocation redistributes break time across activities while maintaining total billable break time

## When Billable Hours Are Calculated

### 1. New Work Activity Creation

**Service:** `WorkActivityService.createWorkActivity()`  
**File:** `/server/src/services/WorkActivityService.ts` (lines 276-375)

**Logic:**
- If `billableHours` provided directly: uses that value + applies rounding
- If missing but `totalHours` exists: calculates using the formula
- Always applies rounding settings if enabled

### 2. Work Activity Updates

**Service:** `WorkActivityService.updateWorkActivity()`  
**File:** `/server/src/services/WorkActivityService.ts` (lines 400-484)

**Triggers:** Billable hours are automatically recalculated when any of these fields change:
- `totalHours`
- `breakTimeMinutes`
- `adjustedBreakTimeMinutes`
- `nonBillableTimeMinutes`
- `adjustedTravelTimeMinutes`

### 3. Notion Sync Operations

**Services:** `NotionSyncService`, `WorkNotesParserService`  
**Files:** 
- `/server/src/services/NotionSyncService.ts`
- `/server/src/services/WorkNotesParserService.ts`

**Process:**
1. Calculate total hours from start/end times if missing
2. Apply billable hours formula including hours adjustments
3. Used for both new imports and updates from Notion

### 4. Time Allocation Services

**Services:** `TravelTimeAllocationService`, `BreakTimeAllocationService`  
**Files:** 
- `/server/src/services/TravelTimeAllocationService.ts`
- `/server/src/services/BreakTimeAllocationService.ts`

**Process:**
1. **Travel Time:** Calculates proportional travel time allocation across work activities
2. **Break Time:** Redistributes break time proportionally based on billable hours
3. Updates `adjustedTravelTimeMinutes` or `adjustedBreakTimeMinutes` respectively
4. Triggers automatic billable hours recalculation when adjusted fields change

## Factors That Influence Billable Hours

### Direct Factors (used in calculation)
- ✅ `totalHours` - base work time (includes break time implicitly)
- ✅ `breakTimeMinutes` - original break time (subtracted to remove implicit break time)
- ✅ `adjustedBreakTimeMinutes` - allocated break time (added back as billable time)
- ✅ `nonBillableTimeMinutes` - non-billable activities (subtracted)
- ✅ `adjustedTravelTimeMinutes` - allocated travel time (added)
- ✅ `hoursAdjustments` - person-specific adjustments from Notion (applied to total hours)

### Indirect Factors
- ✅ **Rounding settings** - can round to nearest half-hour increments
- ✅ **Travel time allocation** - modifies `adjustedTravelTimeMinutes`
- ✅ **Break time allocation** - modifies `adjustedBreakTimeMinutes`
- ✅ **Employee count** - affects total hours calculation from start/end times

### Factors That DON'T Affect Billable Hours
- ❌ Raw `travelTimeMinutes` (stored but not used in calculation)
- ❌ Employee hourly rates
- ❌ Client information
- ❌ Work activity status

## Rounding System

**Service:** `SettingsService`  
**File:** `/server/src/services/SettingsService.ts`

### Configuration Settings
- `billable_hours_rounding`: enable/disable (default: false)
- `billable_hours_rounding_method`: "up", "down", or "nearest" (default: "up")

### When Applied
- Every time billable hours are calculated or updated
- Can be applied retroactively to existing work activities
- Rounds to nearest half-hour increments (0.5)

### Methods
- `roundHours()`: Apply rounding to a single value
- `applyRoundingToExistingWorkActivities()`: Bulk update existing records
- `previewRoundingForExistingWorkActivities()`: Preview changes without applying

## Hours Adjustments (Notion Integration)

**Added:** 2025-01-19 (Hours Adjustments feature)

### Format
Hours adjustments are parsed from Notion "Hours Adjustments" tables with columns:
- **Person**: Employee name (e.g., "Andrea", "Virginia")
- **Adjustment**: Time in H:MM format (e.g., "2:25", "-0:30")
- **Notes**: Reason for adjustment (e.g., "stayed late after team left")

### Parsing
- Positive adjustments: "2:25" = +2.42 hours
- Negative adjustments: "-0:30" = -0.5 hours
- Integrated into AI parsing prompts and natural text conversion

## Database Schema

**File:** `/server/src/db/schema.ts` (lines 56-79)

### Key Fields in `work_activities` table
```sql
billableHours REAL,              -- Calculated value
totalHours REAL,                 -- Input value (duration × employees)
travelTimeMinutes INTEGER,       -- Stored but NOT subtracted
adjustedTravelTimeMinutes INTEGER, -- Affects billable hours
breakTimeMinutes INTEGER,        -- Original break time (subtracted to remove implicit break time)
adjustedBreakTimeMinutes INTEGER, -- Allocated break time (added back as billable time)
nonBillableTimeMinutes INTEGER,  -- Subtracted from billable hours
lastUpdatedBy TEXT              -- Tracks update source ('web_app' | 'notion_sync')
```

## Services That Modify Billable Hours

| Service | Purpose | File Location |
|---------|---------|---------------|
| `WorkActivityService` | Core CRUD operations with automatic recalculation | `/server/src/services/WorkActivityService.ts` |
| `NotionSyncService` | Imports and syncs from Notion | `/server/src/services/NotionSyncService.ts` |
| `WorkNotesParserService` | Parses and imports work notes | `/server/src/services/WorkNotesParserService.ts` |
| `TravelTimeAllocationService` | Allocates travel time across activities | `/server/src/services/TravelTimeAllocationService.ts` |
| `BreakTimeAllocationService` | Redistributes break time across activities | `/server/src/services/BreakTimeAllocationService.ts` |
| `SettingsService` | Applies rounding rules | `/server/src/services/SettingsService.ts` |

## Data Flow Summary

```mermaid
graph TD
    A[Input: Start/End Times, Employee Count] --> B[Calculate Total Hours]
    B --> C[Apply Hours Adjustments to Total Hours]
    C --> D[Calculate Billable Hours from Adjusted Total]
    D --> E[Apply Rounding Settings]
    E --> F[Store Final Billable Hours]
    F --> G[Auto-Update on Component Changes]
    
    H[Travel Time Allocation] --> I[Update Adjusted Travel Time]
    I --> D
    
    K[Break Time Allocation] --> L[Update Adjusted Break Time]
    L --> D
    
    J[Notion Hours Adjustments] --> C
```

1. **Input:** Start/end times, employee count, break time, non-billable time, hours adjustments
2. **Calculate:** Total hours = (duration × employee count) - includes break time implicitly
3. **Apply:** Hours adjustments to total hours (adjustedTotalHours = totalHours + hoursAdjustments)
4. **Calculate:** Billable hours = adjustedTotalHours - breakTime + adjustedBreakTime - nonBillableTime + adjustedTravelTime
5. **Apply:** Rounding settings if enabled
6. **Store:** Final billable hours value
7. **Auto-update:** Recalculation triggered when component values change

## API Endpoints That Affect Billable Hours

### Direct Modifications
- `POST /api/work-activities` - Creates new work activity (automatic calculation)
- `PUT /api/work-activities/:id` - Updates work activity (automatic recalculation)

### Indirect Modifications
- Travel time allocation endpoints - Trigger travel time reallocation
- Notion sync endpoints - Import/update from Notion with hours adjustments
- Settings endpoints - Apply/modify rounding rules

## Troubleshooting

### Common Issues

**Q: Billable hours don't match expected calculation**
- ✅ Check if rounding is enabled in settings
- ✅ Verify `adjustedTravelTimeMinutes` vs raw `travelTimeMinutes`
- ✅ Look for hours adjustments from Notion sync

**Q: Travel time not affecting billable hours**
- ✅ Ensure travel time allocation has been run for that day
- ✅ Check `adjustedTravelTimeMinutes` field (not `travelTimeMinutes`)

**Q: Hours adjustments not applying**
- ✅ Verify Notion "Hours Adjustments" table format
- ✅ Check time format (H:MM or -H:MM)
- ✅ Ensure Notion sync has been run after adding adjustments

## Change Log

### Version 1.4 (2025-07-20)
- **CRITICAL FIX:** Corrected break time billable hours calculation logic
- Updated core formula to properly handle implicit break time in total hours:
  `billableHours = adjustedTotalHours - breakTime + adjustedBreakTime - nonBillableTime + adjustedTravelTime`
- Fixed allocation service to calculate billable hour changes as `minuteChange / 60` for both add/subtract directions
- Added support for 'neutral' billable direction in base allocation service
- Updated break time allocation service to use 'add' direction (break time is billable)
- Enhanced documentation to clarify break time handling throughout

### Version 1.3 (2025-01-19)
- **INTEGRATION:** Merged break time allocation feature from main branch
- Added `adjustedBreakTimeMinutes` field support 
- Maintained billable break time logic during conflict resolution
- Updated documentation to include new break time allocation system

### Version 1.2 (2025-01-19)
- **IMPORTANT FIX:** Break time is now correctly treated as billable time
- Removed break time subtraction from billable hours calculation
- Updated formula to only subtract non-billable time
- Updated all three services: WorkActivityService, NotionSyncService, WorkNotesParserService

### Version 1.1 (2025-01-19)
- **IMPORTANT FIX:** Corrected hours adjustments to modify total hours instead of billable hours directly
- Updated formula to show two-step process: totalHours → adjustedTotalHours → billableHours
- Updated data flow diagram and process steps
- Corrected documentation to reflect proper calculation logic

### Version 1.0 (2025-01-19)
- Initial documentation
- Added hours adjustments support
- Documented complete billable hours lifecycle
- Added troubleshooting section

---

**Note:** This document should be updated whenever the billable hours calculation logic changes. Key areas to watch for changes:
- Formula modifications in `calculateBillableHours()` methods
- New factors that influence billable hours
- Changes to rounding logic
- New integration points (similar to Notion hours adjustments)