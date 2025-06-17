#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { DataMigrationService } from '../src/services/DataMigrationService';
import { DatabaseService } from '../src/services/DatabaseService';

async function main() {
  console.log('🚀 Starting data import...\n');
  
  try {
    // Initialize services
    const migrationService = new DataMigrationService();
    
    // Check current database status
    console.log('📊 Checking current database status...');
    const status = await migrationService.getMigrationStatus();
    console.log(`- Employees: ${status.employeesCount}`);
    console.log(`- Clients: ${status.clientsCount}`);
    console.log(`- Work Activities: ${status.workActivitiesCount}\n`);
    
    // Ask user what they want to do
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
      case 'status':
        console.log('✅ Status check complete');
        break;
        
      case 'clear':
        console.log('🗑️  Clearing all data...');
        await migrationService.clearAllData();
        console.log('✅ All data cleared');
        break;
        
      case 'employees':
        console.log('👥 Importing employees...');
        const employeeResult = await migrationService.migrateEmployees();
        console.log(`✅ Imported ${employeeResult.imported} employees`);
        if (employeeResult.errors.length > 0) {
          console.log(`⚠️  Errors: ${employeeResult.errors.length}`);
          employeeResult.errors.forEach(error => console.log(`   - ${error}`));
        }
        break;
        
      case 'clients':
        console.log('🏢 Importing clients...');
        const clientResult = await migrationService.migrateClients();
        console.log(`✅ Imported ${clientResult.imported} clients`);
        if (clientResult.errors.length > 0) {
          console.log(`⚠️  Errors: ${clientResult.errors.length}`);
          clientResult.errors.forEach(error => console.log(`   - ${error}`));
        }
        break;
        
      case 'all':
      case undefined:
        console.log('📦 Running full migration...');
        
        console.log('👥 Importing employees...');
        const empResult = await migrationService.migrateEmployees();
        console.log(`✅ Imported ${empResult.imported} employees`);
        if (empResult.errors.length > 0) {
          console.log(`⚠️  Employee errors: ${empResult.errors.length}`);
          empResult.errors.forEach(error => console.log(`   - ${error}`));
        }
        
        console.log('🏢 Importing clients...');
        const cliResult = await migrationService.migrateClients();
        console.log(`✅ Imported ${cliResult.imported} clients`);
        if (cliResult.errors.length > 0) {
          console.log(`⚠️  Client errors: ${cliResult.errors.length}`);
          cliResult.errors.forEach(error => console.log(`   - ${error}`));
        }
        
        console.log('✅ Full migration complete!');
        break;
        
      default:
        console.log('❌ Unknown command. Available commands:');
        console.log('  status   - Check current database status');
        console.log('  clear    - Clear all data from database');
        console.log('  employees - Import only employees');
        console.log('  clients  - Import only clients');
        console.log('  all      - Import all data (default)');
        process.exit(1);
    }
    
    // Show final status
    if (command !== 'status') {
      console.log('\n📊 Final database status:');
      const finalStatus = await migrationService.getMigrationStatus();
      console.log(`- Employees: ${finalStatus.employeesCount}`);
      console.log(`- Clients: ${finalStatus.clientsCount}`);
      console.log(`- Work Activities: ${finalStatus.workActivitiesCount}`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().then(() => {
    console.log('\n🎉 Import script completed successfully!');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 Import script failed:', error);
    process.exit(1);
  });
} 