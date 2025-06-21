#!/bin/bash

# Test script for historical data import
# Run from the server directory

echo "🧪 Testing Historical Data Import Script"
echo "======================================="
echo ""

# Function to run command and check result
run_command() {
    echo "📌 Running: $1"
    echo "Command: $2"
    echo ""
    eval $2
    echo ""
    echo "----------------------------------------"
    echo ""
}

# Test 1: List available clients
run_command "List all client sheets" "npm run import:historical list"

# Test 2: Preview a client (replace with actual client name)
# Uncomment and modify the client name as needed
# run_command "Preview client data" "npm run import:historical preview \"Nadler\" --rows 5"

# Test 3: Dry run import for a client
# Uncomment and modify the client name as needed
# run_command "Dry run import" "npm run import:historical import \"Nadler\" --dry-run"

# Test 4: Import with date range
# Uncomment and modify as needed
# run_command "Import recent data" "npm run import:historical import \"Nadler\" --start-date 2024-01-01 --dry-run"

echo "✅ Test script completed!"
echo ""
echo "Next steps:"
echo "1. Uncomment the test commands above and replace client names"
echo "2. Run actual imports without --dry-run flag"
echo "3. Use 'import all' to import all clients at once" 