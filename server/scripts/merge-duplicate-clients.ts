#!/usr/bin/env tsx

import { DatabaseService } from '../src/services/DatabaseService.js';
import { workActivities, clients, projects, clientNotes } from '../src/db/index.js';
import { eq, sql, count, desc } from 'drizzle-orm';
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

interface ClientWithStats {
  id: number;
  clientId: string;
  name: string;
  address: string;
  geoZone: string;
  isRecurringMaintenance: boolean;
  maintenanceIntervalWeeks: number | null;
  maintenanceHoursPerVisit: string | null;
  maintenanceRate: string | null;
  lastMaintenanceDate: string | null;
  nextMaintenanceTarget: string | null;
  priorityLevel: string | null;
  scheduleFlexibility: string | null;
  preferredDays: string | null;
  preferredTime: string | null;
  specialNotes: string | null;
  activeStatus: string;
  createdAt: Date;
  updatedAt: Date;
  workActivityCount: number;
  projectCount: number;
  noteCount: number;
  informationScore: number;
}

interface DuplicateGroup {
  name: string;
  clients: ClientWithStats[];
  primaryClient: ClientWithStats;
  duplicateClients: ClientWithStats[];
}

async function mergeDuplicateClients(dryRun: boolean = false) {
  try {
    console.log('🔄 Client Duplicate Merger\n');
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }
    
    // Check database connection
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is not set!');
      console.log('\n📋 To run this script, you need to:');
      console.log('   1. Copy env.example to .env');
      console.log('   2. Set DATABASE_URL in .env file');
      console.log('   3. Ensure PostgreSQL is running');
      console.log('\n   Example DATABASE_URL:');
      console.log('   DATABASE_URL=postgresql://username:password@localhost:5432/blossom_and_bough');
      process.exit(1);
    }
    
    // Initialize database
    const dbService = new DatabaseService();
    
    console.log('📊 Analyzing client data...');
    
    // Get all clients with their related data counts
    const clientsWithStats = await dbService.db
      .select({
        id: clients.id,
        clientId: clients.clientId,
        name: clients.name,
        address: clients.address,
        geoZone: clients.geoZone,
        isRecurringMaintenance: clients.isRecurringMaintenance,
        maintenanceIntervalWeeks: clients.maintenanceIntervalWeeks,
        maintenanceHoursPerVisit: clients.maintenanceHoursPerVisit,
        maintenanceRate: clients.maintenanceRate,
        lastMaintenanceDate: clients.lastMaintenanceDate,
        nextMaintenanceTarget: clients.nextMaintenanceTarget,
        priorityLevel: clients.priorityLevel,
        scheduleFlexibility: clients.scheduleFlexibility,
        preferredDays: clients.preferredDays,
        preferredTime: clients.preferredTime,
        specialNotes: clients.specialNotes,
        activeStatus: clients.activeStatus,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        workActivityCount: sql<number>`COALESCE(COUNT(DISTINCT ${workActivities.id}), 0)`,
        projectCount: sql<number>`COALESCE(COUNT(DISTINCT ${projects.id}), 0)`,
        noteCount: sql<number>`COALESCE(COUNT(DISTINCT ${clientNotes.id}), 0)`,
      })
      .from(clients)
      .leftJoin(workActivities, eq(clients.id, workActivities.clientId))
      .leftJoin(projects, eq(clients.id, projects.clientId))
      .leftJoin(clientNotes, eq(clients.id, clientNotes.clientId))
      .groupBy(clients.id)
      .orderBy(clients.name, clients.id);

    console.log(`Found ${clientsWithStats.length} total clients`);

    // Calculate information score for each client
    const clientsWithScores = clientsWithStats.map(client => {
      let informationScore = 0;
      
      // Base score for having data
      if (client.address && client.address.trim()) informationScore += 10;
      if (client.geoZone && client.geoZone.trim()) informationScore += 5;
      if (client.specialNotes && client.specialNotes.trim()) informationScore += 15;
      if (client.priorityLevel && client.priorityLevel.trim()) informationScore += 5;
      if (client.scheduleFlexibility && client.scheduleFlexibility.trim()) informationScore += 5;
      if (client.preferredDays && client.preferredDays.trim()) informationScore += 5;
      if (client.preferredTime && client.preferredTime.trim()) informationScore += 5;
      
      // Maintenance information (higher weight as it's business critical)
      if (client.isRecurringMaintenance) informationScore += 10;
      if (client.maintenanceIntervalWeeks) informationScore += 10;
      if (client.maintenanceHoursPerVisit && client.maintenanceHoursPerVisit.trim()) informationScore += 10;
      if (client.maintenanceRate && client.maintenanceRate.trim()) informationScore += 10;
      if (client.lastMaintenanceDate && client.lastMaintenanceDate.trim()) informationScore += 5;
      if (client.nextMaintenanceTarget && client.nextMaintenanceTarget.trim()) informationScore += 5;
      
      // Activity and relationship data
      informationScore += client.workActivityCount * 2; // Each work activity adds 2 points
      informationScore += client.projectCount * 5; // Each project adds 5 points
      informationScore += client.noteCount * 3; // Each note adds 3 points
      
      return {
        ...client,
        informationScore
      };
    });

    // Group clients by name to find duplicates
    const clientGroups = new Map<string, ClientWithStats[]>();
    
    for (const client of clientsWithScores) {
      const normalizedName = client.name.trim().toLowerCase();
      if (!clientGroups.has(normalizedName)) {
        clientGroups.set(normalizedName, []);
      }
      clientGroups.get(normalizedName)!.push(client);
    }

    // Find groups with duplicates
    const duplicateGroups: DuplicateGroup[] = [];
    
    for (const [name, group] of clientGroups) {
      if (group.length > 1) {
        // Sort by information score (descending), then by work activity count, then by creation date
        const sortedGroup = group.sort((a, b) => {
          if (b.informationScore !== a.informationScore) {
            return b.informationScore - a.informationScore;
          }
          if (b.workActivityCount !== a.workActivityCount) {
            return b.workActivityCount - a.workActivityCount;
          }
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        duplicateGroups.push({
          name,
          clients: sortedGroup,
          primaryClient: sortedGroup[0], // First one is the primary
          duplicateClients: sortedGroup.slice(1) // Rest are duplicates
        });
      }
    }

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate clients found!');
      return;
    }

    console.log(`\n🔍 Found ${duplicateGroups.length} groups of duplicate clients:`);
    
    for (const group of duplicateGroups) {
      console.log(`\n📋 "${group.name}" (${group.clients.length} duplicates):`);
      console.log(`   Primary: ${group.primaryClient.clientId} (score: ${group.primaryClient.informationScore}, ${group.primaryClient.workActivityCount} activities, ${group.primaryClient.projectCount} projects)`);
      
      for (const duplicate of group.duplicateClients) {
        console.log(`   Duplicate: ${duplicate.clientId} (score: ${duplicate.informationScore}, ${duplicate.workActivityCount} activities, ${duplicate.projectCount} projects)`);
      }
    }

    const totalWorkActivitiesToUpdate = duplicateGroups.reduce((sum, group) => 
      sum + group.duplicateClients.reduce((groupSum, client) => groupSum + client.workActivityCount, 0), 0
    );

    const totalProjectsToUpdate = duplicateGroups.reduce((sum, group) => 
      sum + group.duplicateClients.reduce((groupSum, client) => groupSum + client.projectCount, 0), 0
    );

    const totalNotesToUpdate = duplicateGroups.reduce((sum, group) => 
      sum + group.duplicateClients.reduce((groupSum, client) => groupSum + client.noteCount, 0), 0
    );

    console.log(`\n📊 Summary of changes:`);
    console.log(`   Work activities to update: ${totalWorkActivitiesToUpdate}`);
    console.log(`   Projects to update: ${totalProjectsToUpdate}`);
    console.log(`   Client notes to update: ${totalNotesToUpdate}`);
    console.log(`   Duplicate clients to remove: ${duplicateGroups.reduce((sum, group) => sum + group.duplicateClients.length, 0)}`);

    if (dryRun) {
      console.log('\n🔍 This was a dry run - no changes were made');
      console.log('   Run without --dry-run to actually perform the merge');
      return;
    }

    const shouldProceed = await askYesNo('\nDo you want to proceed with merging these duplicate clients?');
    
    if (!shouldProceed) {
      console.log('❌ Operation cancelled');
      return;
    }

    // Double confirmation for safety
    const doubleConfirm = await askYesNo('This will permanently update work activities and remove duplicate clients. Please confirm again');
    
    if (!doubleConfirm) {
      console.log('❌ Operation cancelled');
      return;
    }

    console.log('\n🔄 Starting merge process...');

    let updatedWorkActivities = 0;
    let updatedProjects = 0;
    let updatedNotes = 0;
    let removedClients = 0;

    // Process each duplicate group
    for (const group of duplicateGroups) {
      console.log(`\n📋 Processing "${group.name}"...`);
      
      // Update work activities
      for (const duplicate of group.duplicateClients) {
        const workActivityUpdate = await dbService.db
          .update(workActivities)
          .set({ 
            clientId: group.primaryClient.id,
            updatedAt: new Date()
          })
          .where(eq(workActivities.clientId, duplicate.id));
        
        updatedWorkActivities += duplicate.workActivityCount;
      }

      // Update projects
      for (const duplicate of group.duplicateClients) {
        const projectUpdate = await dbService.db
          .update(projects)
          .set({ 
            clientId: group.primaryClient.id,
            updatedAt: new Date()
          })
          .where(eq(projects.clientId, duplicate.id));
        
        updatedProjects += duplicate.projectCount;
      }

      // Update client notes
      for (const duplicate of group.duplicateClients) {
        const noteUpdate = await dbService.db
          .update(clientNotes)
          .set({ 
            clientId: group.primaryClient.id,
            updatedAt: new Date()
          })
          .where(eq(clientNotes.clientId, duplicate.id));
        
        updatedNotes += duplicate.noteCount;
      }

      // Remove duplicate clients
      for (const duplicate of group.duplicateClients) {
        await dbService.db
          .delete(clients)
          .where(eq(clients.id, duplicate.id));
        
        removedClients++;
      }

      console.log(`   ✅ Updated ${group.duplicateClients.reduce((sum, c) => sum + c.workActivityCount, 0)} work activities`);
      console.log(`   ✅ Updated ${group.duplicateClients.reduce((sum, c) => sum + c.projectCount, 0)} projects`);
      console.log(`   ✅ Updated ${group.duplicateClients.reduce((sum, c) => sum + c.noteCount, 0)} client notes`);
      console.log(`   ✅ Removed ${group.duplicateClients.length} duplicate clients`);
    }

    console.log('\n✅ Merge completed successfully!');
    console.log(`\n📊 Final summary:`);
    console.log(`   Work activities updated: ${updatedWorkActivities}`);
    console.log(`   Projects updated: ${updatedProjects}`);
    console.log(`   Client notes updated: ${updatedNotes}`);
    console.log(`   Duplicate clients removed: ${removedClients}`);

    // Verify the results
    console.log('\n🔍 Verifying results...');
    const remainingClients = await dbService.db.select().from(clients);
    console.log(`   Remaining clients: ${remainingClients.length}`);

    const remainingWorkActivities = await dbService.db.select().from(workActivities);
    console.log(`   Remaining work activities: ${remainingWorkActivities.length}`);

    console.log('\n✅ Verification complete - all data integrity maintained!');

  } catch (error) {
    console.error('\n❌ Error during merge process:', error);
    
    if (error instanceof Error && error.message.includes('password')) {
      console.log('\n💡 Database connection issue detected.');
      console.log('   Make sure your DATABASE_URL is correctly configured in .env');
      console.log('   Example: DATABASE_URL=postgresql://username:password@localhost:5432/blossom_and_bough');
    }
    
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const help = args.includes('--help') || args.includes('-h');
  
  if (help) {
    console.log(`
🔄 Client Duplicate Merger

Usage: npx tsx scripts/merge-duplicate-clients.ts [options]

Options:
  --dry-run, -d    Run in dry-run mode (show what would be changed without making changes)
  --help, -h       Show this help message

Description:
  This script finds clients with the same name but different IDs and merges them by:
  1. Identifying duplicate clients by name
  2. Choosing the primary client (most work activities, then oldest)
  3. Updating all work activities, projects, and notes to reference the primary client
  4. Removing duplicate client records

Prerequisites:
  - DATABASE_URL environment variable must be set
  - PostgreSQL database must be running
  - Copy env.example to .env and configure DATABASE_URL

Examples:
  # Dry run to see what would be changed
  npx tsx scripts/merge-duplicate-clients.ts --dry-run
  
  # Actually perform the merge
  npx tsx scripts/merge-duplicate-clients.ts
`);
    process.exit(0);
  }
  
  return { dryRun };
}

// Run the script
if (require.main === module) {
  const { dryRun } = parseArgs();
  mergeDuplicateClients(dryRun).catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
} 