# Other Charges Implementation

## Overview

This document describes the implementation of "Other Charges" support for both the UI and Notion import functionality. The system now supports charges in both table format and list format from Notion pages, with a comprehensive UI for managing charges in work activities.

## What Was Implemented

### 1. Enhanced Notion Import (NotionSyncService)

**Enhanced `getPageContent()` method** to support charges in multiple formats:

- **Table Format** (existing): Extracts charges from tables under "Materials/Charges" headings
- **List Format** (new): Extracts charges from bulleted or numbered lists under "Charges:" sections
- **Smart Parsing**: Automatically detects and parses different charge formats:
  - Simple list items: "1 bag debris", "2 native mock orange"
  - Items with costs: "mulch ($27)", "debris (35)"
  - Automatically assigns default costs for common items like debris ($25)

**Plant List Filtering**: As requested, the system now ignores plant list items (identified by keywords like 'native', 'achillea', 'agastache', 'guara', etc.) and focuses on other charges.

**Improved Section Detection**: Enhanced to recognize charges sections from:
- Headings (H1, H2, H3): "Materials", "Charges", "Materials/Fees"
- Paragraph text: "Charges:"
- Mixed content within the same page

### 2. Enhanced UI (WorkActivityManagement Component)

**New Charges Management Section** in the work activity dialog:

- **Add Charge Form**: 
  - Charge Type dropdown (Material, Service, Debris, Delivery, Equipment, Other)
  - Description field with helpful placeholder text
  - Quantity and Unit Rate fields with auto-calculation
  - Total Cost field (can be manually overridden)

- **Charges List Display**:
  - Visual list of all added charges with type badges
  - Shows quantity, unit rate, and total cost for each item
  - Running total of all charges
  - Remove individual charges functionality

- **Enhanced Table View**:
  - New "Charges" column showing total charge amount and item count
  - Formatted currency display

**State Management**: Added comprehensive state management for:
- `selectedCharges`: Array of charges for the current work activity
- `chargeFormData`: Form state for adding new charges
- Proper initialization and reset logic for both create and edit scenarios

### 3. Type Safety Improvements

**Enhanced TypeScript interfaces**:
- `OtherCharge` interface with proper typing
- Updated `WorkActivity` interface to use typed `chargesList`
- Form data typing for charge management

## Supported Charge Formats

### From Notion (List Format)
```
Charges:
- 1 bag debris
- 2 native mock orange
- 3 achillea terracotta
- mulch ($27)
- delivery fee (15)
```

### From Notion (Table Format)
```
| Item | Cost |
|------|------|
| 1 bag debris | 25 |
| Mulch delivery | 27 |
```

### UI Input
- Type: Material, Service, Debris, Delivery, Equipment, Other
- Description: Free text description
- Quantity: Numeric (optional)
- Unit Rate: Dollar amount (optional)
- Total Cost: Calculated or manual override

## Key Features

### Smart Parsing
- Automatically extracts costs from parentheses: "mulch ($27)" → Description: "mulch", Cost: $27
- Recognizes common charge patterns and applies default costs
- Filters out plant list items as requested

### Auto-Calculation
- Total Cost = Quantity × Unit Rate (when both provided)
- Manual override capability for custom pricing
- Running total display for all charges

### Data Flow
1. **Notion Import**: Page content → Enhanced parsing → Charge extraction → Database storage
2. **UI Management**: User input → Form validation → State management → API submission
3. **Display**: Database → API → UI rendering with formatted display

## Database Schema

The existing `otherCharges` table supports all required fields:
- `chargeType`: Type of charge (material, service, etc.)
- `description`: Human-readable description
- `quantity`: Optional quantity
- `unitRate`: Optional unit rate
- `totalCost`: Final cost amount
- `billable`: Whether the charge is billable (defaults to true)

## Benefits

1. **Comprehensive Import**: Handles both existing table format and new list format from Notion
2. **Flexible UI**: Easy-to-use interface for managing charges with auto-calculation
3. **Smart Filtering**: Automatically separates charges from plant lists
4. **Type Safety**: Full TypeScript support for better development experience
5. **Visual Feedback**: Clear display of charges in both list and table views

## Future Enhancements

Potential improvements could include:
- Bulk import of charges from CSV
- Charge templates for common items
- Integration with inventory management
- Tax calculation support
- Advanced filtering and reporting on charges