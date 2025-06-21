#!/usr/bin/env tsx

import { Command } from 'commander';
import { GoogleSheetsHistoricalDataService } from '../src/services/GoogleSheetsHistoricalDataService.js';
import { AnthropicService } from '../src/services/AnthropicService.js';
import { WorkActivityService } from '../src/services/WorkActivityService.js';
import { ParsedWorkActivity } from '../src/services/AnthropicService.js';
import { clients, employees } from '../src/db/index.js';
import { eq, like } from 'drizzle-orm';
import * as readline from 'readline';

// Initialize readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function askYesNo(question: string): Promise<boolean> {
  const answer = await askQuestion(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

const program = new Command();

program
  .name('import-historical-data')
  .description('Import historical work data from Google Sheets')
  .version('1.0.0');

program
  .command('list')
  .description('List available client sheets')
  .action(async () => {
    try {
      const sheetsService = new GoogleSheetsHistoricalDataService();
      const clients = await sheetsService.getClientSheets();
      
      console.log('\n📋 Available client sheets:');
      clients.forEach((client, index) => {
        console.log(`${index + 1}. ${client}`);
      });
      console.log(`\nTotal: ${clients.length} clients\n`);
    } catch (error) {
      console.error('❌ Error listing clients:', error);
      process.exit(1);
    }
  });

program
  .command('preview')
  .description('Preview raw data for a client')
  .argument('<client>', 'Client name to preview')
  .action(async (clientName: string) => {
    try {
      const sheetsService = new GoogleSheetsHistoricalDataService();
      const preview = await sheetsService.previewClientData(clientName);
      
      console.log(`\n📊 Preview for ${clientName}:`);
      console.log(`Total rows: ${preview.totalRows}`);
      console.log(`\nHeaders: ${preview.headers.join(' | ')}`);
      console.log('\nSample data:');
      
      preview.sampleRows.forEach((row, index) => {
        const rowData = preview.headers.map((header, colIndex) => {
          const value = row[colIndex] || '';
          return value ? `${value}` : '';
        }).filter(Boolean).join(' | ');
        
        if (rowData) {
          console.log(`Row ${index + 1}: ${rowData}`);
        }
      });
      
    } catch (error) {
      console.error('❌ Error previewing data:', error);
      process.exit(1);
    }
  });

program
  .command('batch-test')
  .description('Test batch parsing on a small sample')
  .argument('<client>', 'Client name to test')
  .option('--batch-size <size>', 'Number of entries per batch', '3')
  .action(async (clientName: string, options: { batchSize?: string }) => {
    try {
      console.log('🧪 Testing batch parsing...\n');
      
      const anthropicService = new AnthropicService();
      const sheetsService = new GoogleSheetsHistoricalDataService();
      
      console.log(`📋 Testing with client: ${clientName}`);
      console.log(`⚙️  Batch size: ${options.batchSize || 3}`);
      
      // Get limited data for testing
      const sheetData = await sheetsService.extractClientData(clientName);
      const limitedRows = sheetData.dataRows.slice(0, 15); // Test with first 15 rows
      
      console.log(`📖 Using first ${limitedRows.filter(r => !r.isEmpty).length} rows for test`);
      
      const batchSize = parseInt(options.batchSize || '3');
      
      const activities = await anthropicService.parseHistoricalSheetData(
        clientName,
        sheetData.headers, 
        limitedRows,
        undefined,
        {
          batchSize,
          onProgress: (message: string) => {
            console.log(message);
          },
          onBatchComplete: async (batchIndex: number, batchActivities: ParsedWorkActivity[], totalBatches: number) => {
            console.log(`\n📊 Batch ${batchIndex + 1} complete:`);
            if (batchActivities.length > 0) {
              batchActivities.forEach((activity, index) => {
                console.log(`   ${index + 1}. ${activity.date} - ${activity.totalHours}h - ${activity.tasks[0]?.substring(0, 50)}...`);
              });
            } else {
              console.log('   No activities found in this batch');
            }
            
            if (batchIndex + 1 < totalBatches) {
              return await askYesNo(`\nContinue with next batch?`);
            }
            return true;
          }
        }
      );
      
      console.log(`\n✅ Test complete! Parsed ${activities.length} activities`);
      
      // Show sample of full activities
      if (activities.length > 0) {
        console.log('\n📋 Sample parsed activities:');
        activities.slice(0, 2).forEach((activity, index) => {
          console.log(`\n${index + 1}. ${activity.date} (${activity.totalHours}h)`);
          console.log(`   Employees: ${activity.employees.join(', ')}`);
          console.log(`   Tasks: ${activity.tasks.slice(0, 2).join(', ')}${activity.tasks.length > 2 ? '...' : ''}`);
          if (activity.charges && activity.charges.length > 0) {
            console.log(`   Charges: ${activity.charges.length} items`);
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      process.exit(1);
    } finally {
      rl.close();
    }
  });

program
  .command('import')
  .description('Import all data for a client')
  .argument('<client>', 'Client name to import')
  .option('--dry-run', 'Parse data but don\'t save to database')
  .option('--interactive', 'Ask for confirmation after each batch')
  .option('--batch-size <size>', 'Number of entries per batch', '8')
  .option('--max-batches <count>', 'Maximum number of batches to process')
  .option('--start-batch <number>', 'Start from specific batch number (1-based)')
  .option('--start-date <date>', 'Only import activities after this date (YYYY-MM-DD)')
  .option('--end-date <date>', 'Only import activities before this date (YYYY-MM-DD)')
  .option('--force', 'Overwrite existing activities for this client')
  .option('--skip-duplicates', 'Skip activities that already exist (default behavior)')
  .action(async (clientName: string, options: {
    dryRun?: boolean;
    interactive?: boolean;
    batchSize?: string;
    maxBatches?: string;
    startBatch?: string;
    startDate?: string;
    endDate?: string;
    force?: boolean;
    skipDuplicates?: boolean;
  }) => {
    let allActivities: ParsedWorkActivity[] = [];
    
    try {
      console.log('🚀 Starting full historical data import...\n');
      
      const anthropicService = new AnthropicService();
      const sheetsService = new GoogleSheetsHistoricalDataService();
      
      console.log('🤖 AnthropicService initialized with API key');
      console.log(`📋 Processing client: ${clientName}`);
      console.log(`⚙️  Batch size: ${options.batchSize || 8}`);
      console.log(`🤝 Interactive mode: ${options.interactive ? 'ON' : 'OFF'}`);
      console.log(`🧪 Dry run: ${options.dryRun ? 'ON' : 'OFF'}`);
      
      // Parse batch limiting options
      const maxBatches = options.maxBatches ? parseInt(options.maxBatches) : undefined;
      const startBatch = options.startBatch ? parseInt(options.startBatch) : 1;
      
      if (maxBatches) {
        console.log(`📊 Max batches: ${maxBatches}`);
      }
      if (startBatch > 1) {
        console.log(`🚀 Starting from batch: ${startBatch}`);
      }
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📁 Processing: ${clientName}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Get ALL sheet data (not limited like batch-test)
      console.log('📖 Reading sheet data...');
      const sheetData = await sheetsService.extractClientData(clientName);
      console.log(`  ✓ Found ${sheetData.dataRows.filter(r => !r.isEmpty).length} rows`);
      
      // Parse with batch processing and optional interaction
      console.log(`🤖 Parsing with ${options.interactive ? 'interactive' : 'automatic'} batching...`);
      
      const batchSize = parseInt(options.batchSize || '8');
      
      allActivities = await anthropicService.parseHistoricalSheetData(
        clientName,
        sheetData.headers, 
        sheetData.dataRows, // Use ALL data, not limited
        undefined, // formatHints
        {
          batchSize,
          maxBatches,
          startBatch,
          onProgress: (message: string) => {
            console.log(message);
          },
          onBatchComplete: options.interactive ? async (batchIndex: number, batchActivities: ParsedWorkActivity[], totalBatches: number) => {
            console.log(`\n📊 Batch ${batchIndex + 1}/${totalBatches} Results:`);
            console.log(`   Found ${batchActivities.length} activities`);
            
            if (batchActivities.length > 0) {
              console.log('\n📋 Activities in this batch:');
              batchActivities.slice(0, 3).forEach((activity, index) => {
                console.log(`   ${index + 1}. ${activity.date} - ${activity.totalHours}h - ${activity.tasks.slice(0, 2).join(', ')}${activity.tasks.length > 2 ? '...' : ''}`);
              });
              if (batchActivities.length > 3) {
                console.log(`   ... and ${batchActivities.length - 3} more activities`);
              }
            }
            
            // Check if we've reached max batches or should continue
            const shouldStop = maxBatches && (batchIndex + 1) >= (startBatch - 1 + maxBatches);
            if (shouldStop) {
              console.log(`\n⏹️  Reached maximum batches limit (${maxBatches})`);
              return false;
            }
            
            if (batchIndex + 1 < totalBatches) {
              const shouldContinue = await askYesNo(`\nContinue with batch ${batchIndex + 2}/${totalBatches}?`);
              if (!shouldContinue) {
                console.log('⏹️  Stopping at user request');
                return false;
              }
            }
            
            return true;
          } : undefined
        }
      );
      
      console.log(`\n🎉 Parsing completed! Found ${allActivities.length} activities total`);
      
      // Filter by date range if specified
      if (options.startDate || options.endDate) {
        const originalCount = allActivities.length;
        allActivities = allActivities.filter(activity => {
          const activityDate = new Date(activity.date);
          
          if (options.startDate && activityDate < new Date(options.startDate)) {
            return false;
          }
          
          if (options.endDate && activityDate > new Date(options.endDate)) {
            return false;
          }
          
          return true;
        });
        
        console.log(`📅 Date filtering: ${originalCount} → ${allActivities.length} activities`);
      }
      
      if (allActivities.length === 0) {
        console.log('⚠️  No activities to import after filtering');
        return;
      }
      
      // Show summary
      console.log('\n📊 Import Summary:');
      console.log(`   Activities: ${allActivities.length}`);
      console.log(`   Date range: ${allActivities[0]?.date} to ${allActivities[allActivities.length - 1]?.date}`);
      console.log(`   Total hours: ${allActivities.reduce((sum, a) => sum + a.totalHours, 0).toFixed(1)}`);
      
      if (options.dryRun) {
        console.log('\n🧪 DRY RUN - No data will be saved');
        console.log('\nSample activities:');
        allActivities.slice(0, 5).forEach((activity, index) => {
          console.log(`\n${index + 1}. ${activity.date} (${activity.totalHours}h)`);
          console.log(`   Employees: ${activity.employees.join(', ')}`);
          console.log(`   Tasks: ${activity.tasks.slice(0, 3).join(', ')}${activity.tasks.length > 3 ? `... (${activity.tasks.length - 3} more)` : ''}`);
          if (activity.charges && activity.charges.length > 0) {
            console.log(`   Charges: ${activity.charges.length} items`);
          }
        });
        
        console.log('\n✅ Dry run complete - use without --dry-run flag to save data');
        return;
      }
      
      console.log('\n💾 Saving to database...');
      
      // Initialize WorkActivityService
      const workActivityService = new WorkActivityService();
      
      // Look up client ID
      const clientResults = await workActivityService.db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(like(clients.name, `%${clientName}%`));
      
      if (clientResults.length === 0) {
        throw new Error(`Client "${clientName}" not found in database. Available clients can be seen with: npm run import status`);
      }
      
      const clientId = clientResults[0].id;
      console.log(`   ✓ Found client: ${clientResults[0].name} (ID: ${clientId})`);
      
      // Get all employees for lookup
      const allEmployees = await workActivityService.db.select().from(employees);
      
      // Create multiple mapping strategies for employee lookup
      const employeeMap = new Map<string, number>();
      
      allEmployees.forEach(emp => {
        const fullName = emp.name.toLowerCase();
        const firstName = emp.name.split(' ')[0].toLowerCase();
        
        // Map both full name and first name
        employeeMap.set(fullName, emp.id);
        employeeMap.set(firstName, emp.id);
        
        // Also map common abbreviations
        const abbreviations: Record<string, string> = {
          'rebecca': 'r',
          'megan': 'm', 
          'virginia': 'v',
          'anne': 'a',
          'andrea': 'andrea' // Andrea maps to herself
        };
        
        if (abbreviations[firstName]) {
          employeeMap.set(abbreviations[firstName], emp.id);
        }
      });
      
      console.log(`   ✓ Loaded ${allEmployees.length} employees for lookup`);
      console.log(`   🔍 Employee mappings: ${Array.from(employeeMap.entries()).map(([name, id]) => `"${name}"`).join(', ')}`);
      
      // Check for duplicates if not forcing overwrite
      let duplicateCount = 0;
      if (!options.force) {
        console.log('   🔍 Checking for existing activities...');
        const existingActivities = await workActivityService.getWorkActivitiesByClientId(clientId);
        const existingDates = new Set(existingActivities.map(a => a.date));
        
        const originalCount = allActivities.length;
        allActivities = allActivities.filter(activity => {
          if (existingDates.has(activity.date)) {
            duplicateCount++;
            return false;
          }
          return true;
        });
        
        console.log(`   📊 Duplicate check: ${originalCount} → ${allActivities.length} activities (${duplicateCount} duplicates skipped)`);
      }
      
      if (allActivities.length === 0) {
        console.log('   ⚠️  No new activities to import after duplicate filtering');
        console.log(`   💡 Use --force flag to overwrite existing activities`);
        return;
      }
      
      // Save activities with relaxed validation
      let saved = 0;
      let failed = 0;
      const errors: string[] = [];
      
      for (const [index, activity] of allActivities.entries()) {
        try {
          console.log(`   Processing ${index + 1}/${allActivities.length}: ${activity.date}...`);
          
          // Map employee names to IDs (relaxed - skip unknown employees)
          const employeeIds: number[] = [];
          for (const empName of activity.employees) {
            const empId = employeeMap.get(empName.toLowerCase());
            if (empId) {
              employeeIds.push(empId);
            } else {
              console.log(`     ⚠️  Unknown employee "${empName}" - skipping`);
            }
          }
          
          // Default to first employee if none found
          if (employeeIds.length === 0) {
            employeeIds.push(allEmployees[0].id); // Default to first employee
            console.log(`     ℹ️  No valid employees found, defaulting to ${allEmployees[0].name}`);
          }
          
          // Create work activity with relaxed validation
          const workActivity = {
            workType: activity.workType || 'maintenance',
            date: activity.date,
            status: 'completed' as const,
            startTime: activity.startTime || null,
            endTime: activity.endTime || null,
            billableHours: Math.max(0, activity.totalHours), // Ensure non-negative
            totalHours: Math.max(0, activity.totalHours), // Ensure non-negative
            hourlyRate: null,
            clientId: clientId,
            projectId: null,
            travelTimeMinutes: activity.driveTime || 0,
            breakTimeMinutes: activity.lunchTime || 0,
            notes: activity.notes || '',
            tasks: activity.tasks.join('\n')
          };
          
          // Prepare employee assignments
          const employeeAssignments = employeeIds.map(empId => ({
            employeeId: empId,
            hours: activity.totalHours / employeeIds.length // Split hours evenly
          }));
          
          // Prepare charges (relaxed - skip invalid charges)
          const charges = (activity.charges || [])
            .filter(charge => charge.description && !isNaN(Number(charge.cost || 0)))
            .map(charge => ({
              chargeType: charge.type || 'material',
              description: charge.description,
              quantity: 1,
              unitRate: Number(charge.cost || 0),
              totalCost: Number(charge.cost || 0),
              billable: true
            }));
          
          // Create the work activity
          await workActivityService.createWorkActivity({
            workActivity,
            employees: employeeAssignments,
            charges
          });
          
          saved++;
          console.log(`     ✅ Saved activity: ${activity.totalHours}h, ${employeeIds.length} employees, ${charges.length} charges`);
          
        } catch (error) {
          failed++;
          const errorMsg = `Failed to save activity for ${activity.date}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.log(`     ❌ ${errorMsg}`);
        }
      }
      
      console.log(`\n📊 Import Results:`);
      console.log(`   ✅ Successfully saved: ${saved} activities`);
      console.log(`   ❌ Failed: ${failed} activities`);
      if (duplicateCount > 0) {
        console.log(`   🔄 Duplicates skipped: ${duplicateCount} activities`);
      }
      
      if (errors.length > 0) {
        console.log(`\n⚠️  Errors encountered:`);
        errors.slice(0, 5).forEach(error => console.log(`   - ${error}`));
        if (errors.length > 5) {
          console.log(`   ... and ${errors.length - 5} more errors`);
        }
      }
      
      if (duplicateCount > 0) {
        console.log(`\n💡 Tip: Use --force to overwrite existing activities`);
      }
      
      console.log(`\n✅ Import complete! Saved ${saved} work activities for ${clientName}`);
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      process.exit(1);
    } finally {
      rl.close();
    }
  });

program.parse(); 