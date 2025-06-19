#!/usr/bin/env python3
"""
Test script for work notes import functionality
"""

import requests
import json
import sys

# Sample work notes from the design docs
SAMPLE_WORK_NOTES = """6/3
Time: 8:45-3:10 w V inc 22x2 min drive
Lunch: 12:35-2
Stoller
Work Completed:
- Misc clean up/weeds
- Deadhead brunnera
- Prune choisya (n side)
- Take photos for design drawing

6/10 w Anne & V
Silver
Kabeiseman on site 1:30-3:50 (V stayed extra 10 min) charge 1 debris bag
Kurzweil me & Anne til 5:10 - light weeds, debris, deadheading, sluggo"""

def test_parse_work_notes():
    """Test the work notes parsing endpoint"""
    print("🧪 Testing work notes parsing...")
    
    url = "http://localhost:3001/api/work-notes/parse"
    payload = {"workNotesText": SAMPLE_WORK_NOTES}
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Parsing successful!")
            print(f"📊 Summary: {data['summary']['totalActivities']} activities, {data['summary']['validActivities']} valid")
            
            # Print activities
            for i, activity in enumerate(data['activities']):
                print(f"\n🔍 Activity {i+1}:")
                print(f"   Client: {activity['clientName']}")
                print(f"   Date: {activity['date']}")
                print(f"   Hours: {activity['totalHours']}")
                print(f"   Employees: {', '.join(activity['employees'])}")
                print(f"   Confidence: {activity['confidence']:.1%}")
                print(f"   Can Import: {'✅' if activity['canImport'] else '❌'}")
                
                if activity['validationIssues']:
                    print(f"   Issues: {len(activity['validationIssues'])}")
                    for issue in activity['validationIssues']:
                        print(f"     - {issue['type']}: {issue['message']}")
            
            return data
        else:
            error_data = response.json() if response.headers.get('content-type') == 'application/json' else {}
            print(f"❌ Parsing failed: {response.status_code}")
            print(f"   Error: {error_data.get('error', 'Unknown error')}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return None

def test_templates_endpoint():
    """Test the templates endpoint"""
    print("\n🧪 Testing templates endpoint...")
    
    url = "http://localhost:3001/api/work-notes/templates"
    
    try:
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Templates endpoint working!")
            print(f"📚 Found {len(data['examples'])} examples")
            print(f"💡 Found {len(data['tips'])} tips")
            return True
        else:
            print(f"❌ Templates failed: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return False

def test_server_health():
    """Test if the server is running"""
    print("🧪 Testing server health...")
    
    url = "http://localhost:3001/api/health"
    
    try:
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            print("✅ Server is healthy!")
            return True
        else:
            print(f"❌ Server health check failed: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot reach server: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Testing Work Notes Import Functionality\n")
    
    # Test server health first
    if not test_server_health():
        print("\n❌ Server is not running. Please start the server first:")
        print("   cd server && npm start")
        sys.exit(1)
    
    # Test templates endpoint
    test_templates_endpoint()
    
    # Test parsing
    parse_result = test_parse_work_notes()
    
    if parse_result:
        print(f"\n🎉 All tests completed!")
        print(f"📈 Parsing confidence: {parse_result['summary']['validActivities']}/{parse_result['summary']['totalActivities']} activities ready for import")
    else:
        print(f"\n❌ Parsing test failed")
        sys.exit(1)

if __name__ == "__main__":
    main() 