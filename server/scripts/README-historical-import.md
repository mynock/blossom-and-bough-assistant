# Historical Data Import Script

This script imports historical work data from Google Sheets into the database.

## Prerequisites

1. Set up Google Sheets API credentials (same as main app)
2. Ensure the historical data sheet ID is configured in `.env`:
   ```
   GOOGLE_SHEETS_HISTORICAL_ID=your-historical-sheet-id
   ```
   (Falls back to `GOOGLE_SHEETS_ID` if not specified)

3. Ensure Anthropic API key is configured:
   ```
   ANTHROPIC_API_KEY=your-api-key
   ```

## Usage

From the server directory:

```bash
npm run import:historical [command] [options]
```

Or directly:

```bash
npx tsx scripts/import-historical-data.ts [command] [options]
```

## Commands

### List Available Clients

```bash
npm run import:historical list
```

Lists all client sheets available in the historical data spreadsheet.

### Preview Client Data

```bash
npm run import:historical preview "Client Name"
npm run import:historical preview "Client Name" --rows 20
```

Shows a preview of data from a specific client sheet.

Options:
- `-r, --rows <number>`: Number of rows to preview (default: 10)

### Import Client Data

```bash
# Dry run (preview only)
npm run import:historical import "Client Name" --dry-run

# Import specific client
npm run import:historical import "Client Name"

# Import all clients
npm run import:historical import all

# Import with date range
npm run import:historical import "Client Name" --start-date 2024-01-01 --end-date 2024-12-31

# Force import even with duplicates
npm run import:historical import "Client Name" --force
```

Options:
- `-d, --dry-run`: Preview what would be imported without actually importing
- `-s, --start-date <date>`: Only import activities after this date (YYYY-MM-DD)
- `-e, --end-date <date>`: Only import activities before this date (YYYY-MM-DD)
- `-f, --force`: Import even if duplicates are detected
- `--format-hints <hints>`: Additional format hints for AI parsing

## Examples

1. **Test import for one client:**
   ```bash
   npm run import:historical import "Nadler" --dry-run
   ```

2. **Import recent data only:**
   ```bash
   npm run import:historical import "Kurzweil 50" --start-date 2024-01-01
   ```

3. **Import all clients with force:**
   ```bash
   npm run import:historical import all --force
   ```

## Data Format Notes

The script handles various formats:
- Employee abbreviations: "w R" (with Rebecca), "w M" (with Megan), etc.
- Multi-row entries (tasks continuing from previous row)
- Checkbox tasks with [x] markers
- Embedded charges and plant lists
- Various date formats

## Troubleshooting

1. **Authentication errors**: Check Google Sheets credentials and sheet ID
2. **Parsing errors**: Use `--format-hints` to provide additional context
3. **Duplicate warnings**: Use `--dry-run` first to preview, then `--force` if needed
4. **Client not found**: Use the `list` command to see exact client names

## Output

The script provides:
- Progress updates for each client
- Validation summaries
- Sample activities being imported
- Final summary with import statistics
- Error reporting for failed imports 