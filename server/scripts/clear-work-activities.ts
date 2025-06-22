#!/usr/bin/env tsx

import { DataMigrationService } from '../src/services/DataMigrationService.js';
import { DatabaseService } from '../src/services/DatabaseService.js';
import { workActivities, workActivityEmployees, otherCharges, projects, clientNotes } from '../src/db/index.js';
import * as readline from 'readline';

// Initialize readline interface for user confirmation
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

async function clearWorkActivities() {
  try {
    console.log('🗑️  Work Activity Database Cleaner\n');
    
    // Initialize database
    const dbService = new DatabaseService();
    
    // Get current count
    const currentActivities = await dbService.db.select().from(workActivities);
    const currentEmployees = await dbService.db.select().from(workActivityEmployees);
    const currentCharges = await dbService.db.select().from(otherCharges);
    
    console.log('📊 Current Database Contents:');
    console.log(`   Work Activities: ${currentActivities.length}`);
    console.log(`   Employee Assignments: ${currentEmployees.length}`);
    console.log(`   Charges: ${currentCharges.length}`);
    
    if (currentActivities.length === 0) {
      console.log('\n✅ Database is already empty - nothing to clear');
      return;
    }
    
    console.log('\n⚠️  This will permanently delete ALL work activity data:');
    console.log('   - All work activities');
    console.log('   - All employee assignments');
    console.log('   - All charges');
    console.log('   (Clients, employees, and projects will remain)');
    
    const shouldProceed = await askYesNo('\nAre you sure you want to clear all work activity data?');
    
    if (!shouldProceed) {
      console.log('❌ Operation cancelled');
      return;
    }
    
    // Double confirmation for safety
    const doubleConfirm = await askYesNo('This action cannot be undone. Please confirm again');
    
    if (!doubleConfirm) {
      console.log('❌ Operation cancelled');
      return;
    }
    
    console.log('\n🗑️  Clearing work activity data...');
    
    // Delete in correct order to respect foreign key constraints
    console.log('   Deleting charges...');
    await dbService.db.delete(otherCharges);
    
    console.log('   Deleting employee assignments...');
    await dbService.db.delete(workActivityEmployees);
    
    console.log('   Deleting work activities...');
    await dbService.db.delete(workActivities);
    
    console.log('\n✅ Work activity data cleared successfully!');
    console.log('\n🔄 Database is now ready for fresh imports');
    
  } catch (error) {
    console.error('\n❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Option to clear projects and work data (but keep clients and employees)
async function clearProjectsAndWorkData() {
  try {
    console.log('🗑️  Projects & Work Data Cleaner\n');
    
    // Initialize database
    const dbService = new DatabaseService();
    
    // Get current count
    const currentActivities = await dbService.db.select().from(workActivities);
    const currentEmployees = await dbService.db.select().from(workActivityEmployees);  
    const currentCharges = await dbService.db.select().from(otherCharges);
    const currentProjects = await dbService.db.select().from(projects);
    const currentNotes = await dbService.db.select().from(clientNotes);
    
    console.log('📊 Current Database Contents:');
    console.log(`   Work Activities: ${currentActivities.length}`);
    console.log(`   Employee Assignments: ${currentEmployees.length}`);
    console.log(`   Charges: ${currentCharges.length}`);
    console.log(`   Projects: ${currentProjects.length}`);
    console.log(`   Client Notes: ${currentNotes.length}`);
    
    if (currentActivities.length === 0 && currentProjects.length === 0) {
      console.log('\n✅ No projects or work data to clear');
      return;
    }
    
    console.log('\n⚠️  This will permanently delete ALL projects and work data:');
    console.log('   - All work activities');
    console.log('   - All employee assignments');
    console.log('   - All charges');
    console.log('   - All projects');
    console.log('   - All client notes');
    console.log('   (Clients and employees will be preserved)');
    
    const shouldProceed = await askYesNo('\nAre you sure you want to clear all projects and work data?');
    
    if (!shouldProceed) {
      console.log('❌ Operation cancelled');
      return;
    }
    
    // Double confirmation for safety
    const doubleConfirm = await askYesNo('This action cannot be undone. Please confirm again');
    
    if (!doubleConfirm) {
      console.log('❌ Operation cancelled');
      return;
    }
    
    console.log('\n🗑️  Clearing projects and work data...');
    
    // Delete in correct order to respect foreign key constraints
    console.log('   Deleting charges...');
    await dbService.db.delete(otherCharges);
    
    console.log('   Deleting employee assignments...');
    await dbService.db.delete(workActivityEmployees);
    
    console.log('   Deleting work activities...');
    await dbService.db.delete(workActivities);
    
    console.log('   Deleting client notes...');
    await dbService.db.delete(clientNotes);
    
    console.log('   Deleting projects...');
    await dbService.db.delete(projects);
    
    console.log('\n✅ Projects and work data cleared successfully!');
    console.log('\n🔄 Database is ready for fresh imports (clients and employees preserved)');
    
  } catch (error) {
    console.error('\n❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Option to clear everything (clients, employees, projects too)
async function clearAllData() {
  try {
    console.log('🗑️  FULL Database Cleaner\n');
    
    const migrationService = new DataMigrationService();
    
    console.log('⚠️  This will delete EVERYTHING in the database:');
    console.log('   - All work activities, charges, and employee assignments');
    console.log('   - All clients, projects, and employees');
    console.log('   - ALL DATA will be lost');
    
    const shouldProceed = await askYesNo('\nAre you ABSOLUTELY sure you want to clear EVERYTHING?');
    
    if (!shouldProceed) {
      console.log('❌ Operation cancelled');
      return;
    }
    
    // Triple confirmation for complete wipe
    const tripleConfirm = await askYesNo('This will delete ALL clients, employees, projects, and work activities. Confirm');
    
    if (!tripleConfirm) {
      console.log('❌ Operation cancelled');
      return;
    }
    
    await migrationService.clearAllData();
    console.log('\n✅ All data cleared successfully!');
    console.log('\n🔄 Database is completely empty and ready for fresh data');
    
  } catch (error) {
    console.error('\n❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--all')) {
  clearAllData();
} else if (args.includes('--projects')) {
  clearProjectsAndWorkData();
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📋 Work Activity Database Cleaner

Usage:
  npm run clear-db                 # Clear only work activities data
  npm run clear-db -- --projects   # Clear projects and work data (keep clients/employees)
  npm run clear-db -- --all        # Clear ALL database data

Options:
  --projects  Clear projects, work activities, and related data (preserve clients/employees)
  --all       Clear everything (clients, employees, projects, work activities)
  --help      Show this help message

Examples:
  npm run clear-db                 # Safe: keeps clients/employees/projects, clears work logs only
  npm run clear-db -- --projects   # Medium: keeps clients/employees, clears projects and work
  npm run clear-db -- --all        # Nuclear: clears everything
`);
} else {
  clearWorkActivities();
} 