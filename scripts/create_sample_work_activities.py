#!/usr/bin/env python3
"""
Script to create sample work activity data for testing the CRUD interface.
"""

import sqlite3
import json
from datetime import datetime, timedelta
import random

# Database connection
DB_PATH = "server/data/blossom-and-bough.db"

def create_sample_work_activities():
    """Create sample work activities with employees and charges."""
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # First, let's check if we have clients, employees, and projects
    cursor.execute("SELECT id, name FROM clients LIMIT 5")
    clients = cursor.fetchall()
    
    cursor.execute("SELECT id, name FROM employees LIMIT 5")
    employees = cursor.fetchall()
    
    cursor.execute("SELECT id, name, client_id FROM projects LIMIT 5")
    projects = cursor.fetchall()
    
    if not clients or not employees:
        print("Please create some clients and employees first!")
        return
    
    # Work activity types and statuses
    work_types = ['maintenance', 'installation', 'repair', 'consultation', 'design', 'cleanup']
    statuses = ['planned', 'in_progress', 'completed', 'invoiced']
    
    # Create sample work activities
    sample_activities = []
    
    # Generate activities for the past 30 days
    for i in range(15):  # Create 15 sample activities
        # Random date in the past 30 days
        days_ago = random.randint(0, 30)
        activity_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        
        # Random client and project
        client = random.choice(clients)
        client_projects = [p for p in projects if p[2] == client[0]]
        project = random.choice(client_projects) if client_projects else None
        
        # Random work details
        work_type = random.choice(work_types)
        status = random.choice(statuses)
        total_hours = random.choice([4, 6, 8, 10])
        billable_hours = total_hours if random.random() > 0.2 else total_hours - random.choice([0.5, 1, 1.5])
        hourly_rate = random.choice([45, 50, 55, 60])
        
        activity = {
            'work_type': work_type,
            'date': activity_date,
            'status': status,
            'start_time': '08:00',
            'end_time': f'{8 + total_hours}:00',
            'billable_hours': billable_hours,
            'total_hours': total_hours,
            'hourly_rate': hourly_rate,
            'project_id': project[0] if project else None,
            'client_id': client[0],
            'travel_time_minutes': random.choice([15, 30, 45, 60]),
            'break_time_minutes': random.choice([15, 30, 45]),
            'notes': f'Completed {work_type} work for {client[1]}. Weather was good.',
            'tasks': 'Follow up on additional plantings needed in spring.',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        sample_activities.append(activity)
    
    # Insert work activities
    for activity in sample_activities:
        cursor.execute("""
            INSERT INTO work_activities (
                work_type, date, status, start_time, end_time, billable_hours,
                total_hours, hourly_rate, project_id, client_id, travel_time_minutes,
                break_time_minutes, notes, tasks, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            activity['work_type'], activity['date'], activity['status'],
            activity['start_time'], activity['end_time'], activity['billable_hours'],
            activity['total_hours'], activity['hourly_rate'], activity['project_id'],
            activity['client_id'], activity['travel_time_minutes'],
            activity['break_time_minutes'], activity['notes'], activity['tasks'],
            activity['created_at'], activity['updated_at']
        ))
        
        work_activity_id = cursor.lastrowid
        
        # Assign random employees to each activity
        num_employees = random.choice([1, 2])  # 1 or 2 employees per activity
        selected_employees = random.sample(employees, num_employees)
        
        for employee in selected_employees:
            hours_per_employee = activity['total_hours'] / num_employees
            cursor.execute("""
                INSERT INTO work_activity_employees (work_activity_id, employee_id, hours, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            """, (
                work_activity_id, employee[0], hours_per_employee,
                datetime.now().isoformat(), datetime.now().isoformat()
            ))
        
        # Add some random charges
        if random.random() > 0.5:  # 50% chance of having charges
            charge_types = ['material', 'service', 'debris', 'delivery']
            charge_type = random.choice(charge_types)
            
            if charge_type == 'material':
                description = random.choice(['Mulch (3 yards)', 'Plants (assorted)', 'Fertilizer', 'Soil amendment'])
                total_cost = random.choice([45, 75, 120, 200])
            elif charge_type == 'debris':
                description = 'Debris removal (2 bags)'
                total_cost = random.choice([25, 35, 50])
            elif charge_type == 'delivery':
                description = 'Material delivery'
                total_cost = random.choice([30, 45, 60])
            else:
                description = 'Additional service'
                total_cost = random.choice([40, 60, 80])
            
            cursor.execute("""
                INSERT INTO other_charges (
                    work_activity_id, charge_type, description, quantity, unit_rate,
                    total_cost, billable, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                work_activity_id, charge_type, description, 1, total_cost,
                total_cost, True, datetime.now().isoformat(), datetime.now().isoformat()
            ))
    
    conn.commit()
    conn.close()
    
    print(f"Created {len(sample_activities)} sample work activities successfully!")
    print("You can now test the Work Activity CRUD interface.")

if __name__ == "__main__":
    create_sample_work_activities() 