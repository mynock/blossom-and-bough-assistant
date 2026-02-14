# Billable Hours Automatic Recalculation Implementation

## Overview
This implementation ensures that billable hours for work activities are automatically updated whenever any input to the billable hours calculation equation changes, regardless of the source of the change.

## Billable Hours Calculation Formula
```
billableHours = totalHours - (breakTimeMinutes/60) - (nonBillableTimeMinutes/60) + (adjustedTravelTimeMinutes/60)
```

## Input Fields That Trigger Recalculation
The following fields, when updated, will automatically trigger billable hours recalculation:

1. **totalHours** - Base work hours
2. **breakTimeMinutes** - Break/lunch time (subtracted from billable hours)
3. **nonBillableTimeMinutes** - Non-billable time (subtracted from billable hours)
4. **adjustedTravelTimeMinutes** - Adjusted travel time (added to billable hours)

## Implementation Details

### WorkActivityService.ts Changes

#### 1. New Helper Method
Added `calculateBillableHours()` private method that implements the standard formula:
```typescript
private calculateBillableHours(
  totalHours: number,
  breakTimeMinutes: number = 0,
  nonBillableTimeMinutes: number = 0,
  adjustedTravelTimeMinutes: number = 0
): number
```

#### 2. Enhanced updateWorkActivity Method
The `updateWorkActivity` method now:
- Detects when any billable hours input field changes
- Automatically recalculates billable hours using the current and updated values
- Applies rounding settings to the recalculated value
- Preserves existing behavior for direct billable hours updates

#### 3. Enhanced createWorkActivity Method
The `createWorkActivity` method now:
- Automatically calculates billable hours if not provided directly
- Uses the same standardized calculation formula
- Applies rounding to calculated values

### Consistent Implementation Across Services

#### NotionSyncService.ts
- Updated `calculateBillableHours()` method to use the same formula
- Now supports all four input parameters for consistency

#### WorkNotesParserService.ts
- Updated `calculateBillableHours()` method to use the same formula
- Now supports all four input parameters for consistency

## Automatic Update Scenarios

### Scenario 1: Total Hours Change
```typescript
// Original: totalHours=8, breakTime=30min, billableHours=7.5
await workActivityService.updateWorkActivity(id, { totalHours: 6 });
// Result: billableHours automatically updated to 5.5 (6 - 0.5)
```

### Scenario 2: Break Time Change
```typescript
// Original: totalHours=8, breakTime=30min, billableHours=7.5
await workActivityService.updateWorkActivity(id, { breakTimeMinutes: 60 });
// Result: billableHours automatically updated to 7.0 (8 - 1.0)
```

### Scenario 3: Non-Billable Time Change
```typescript
// Original: totalHours=8, nonBillableTime=0, billableHours=8.0
await workActivityService.updateWorkActivity(id, { nonBillableTimeMinutes: 30 });
// Result: billableHours automatically updated to 7.5 (8 - 0.5)
```

### Scenario 4: Adjusted Travel Time Change
```typescript
// Original: totalHours=8, adjustedTravel=0, billableHours=8.0
await workActivityService.updateWorkActivity(id, { adjustedTravelTimeMinutes: 30 });
// Result: billableHours automatically updated to 8.5 (8 + 0.5)
```

### Scenario 5: Multiple Fields Change
```typescript
await workActivityService.updateWorkActivity(id, {
  totalHours: 10,
  breakTimeMinutes: 60,
  adjustedTravelTimeMinutes: 30
});
// Result: billableHours = 10 - 1.0 + 0.5 = 9.5
```

## Data Sources That Trigger Updates

### 1. Web Application
- Direct user edits through the UI
- Form submissions
- Bulk updates

### 2. Notion Sync
- Automatic sync from Notion pages
- AI-parsed work activity data
- Manual sync operations

### 3. Work Notes Import
- CSV/text file imports
- Historical data imports
- Batch processing

### 4. Travel Time Allocation
- Proportional travel time distribution
- Travel time adjustments
- Reallocation operations

### 5. API Updates
- Direct API calls
- External system integrations
- Automation scripts

## Rounding Integration
- All recalculated billable hours automatically apply the configured rounding settings
- Rounding is applied through the `SettingsService.roundHours()` method
- If rounding fails, the unrounded value is used with a warning log

## Logging and Debugging
Enhanced logging provides detailed information about recalculations:
```
🧮 Recalculated billable hours for work activity 123: 
totalHours=8, breakTime=30min, nonBillableTime=0min, adjustedTravel=30min 
-> 8.5 billable hours -> 8.5 rounded billable hours
```

## Backward Compatibility
- Existing direct billable hours updates continue to work unchanged
- Manual billable hours edits are preserved when no input fields change
- All existing API endpoints maintain their current behavior

## Testing
Comprehensive test suite covers:
- Individual field changes (totalHours, breakTimeMinutes, nonBillableTimeMinutes)
- Multiple field changes simultaneously
- Null value handling for adjustedTravelTimeMinutes
- Scenarios where recalculation should NOT occur
- Rounding integration

## Benefits
1. **Consistency**: Billable hours always reflect current input values
2. **Automation**: No manual recalculation needed when inputs change
3. **Accuracy**: Eliminates discrepancies between inputs and calculated values
4. **Reliability**: Works across all data sources and update mechanisms
5. **Transparency**: Clear logging shows when and why recalculation occurs

## Edge Cases Handled
- Null values for adjustedTravelTimeMinutes
- Zero values for any input field
- Negative results (clamped to 0)
- Rounding failures (graceful degradation)
- Missing current values (defaults to 0)

This implementation ensures that billable hours always stay in sync with their input components, providing accurate and reliable billing calculations regardless of how or where the data is updated.