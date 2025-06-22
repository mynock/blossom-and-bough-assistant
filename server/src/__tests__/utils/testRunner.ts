/**
 * Test Runner Utility
 * 
 * This utility helps organize and run tests with proper reporting.
 * It can be used to run specific test suites or all tests together.
 */

export interface TestSuite {
  name: string;
  description: string;
  testFile: string;
  category: 'unit' | 'integration' | 'e2e';
  priority: 'high' | 'medium' | 'low';
}

export const TEST_SUITES: TestSuite[] = [
  {
    name: 'ClientService',
    description: 'Tests for client management operations',
    testFile: 'services/ClientService.test.ts',
    category: 'unit',
    priority: 'high'
  },
  {
    name: 'EmployeeService',
    description: 'Tests for employee management operations',
    testFile: 'services/EmployeeService.test.ts',
    category: 'unit',
    priority: 'high'
  },
  {
    name: 'WorkActivityService',
    description: 'Tests for work activity management and business logic',
    testFile: 'services/WorkActivityService.test.ts',
    category: 'unit',
    priority: 'high'
  },
  {
    name: 'SchedulingService',
    description: 'Tests for scheduling logic and conflict detection',
    testFile: 'services/SchedulingService.test.ts',
    category: 'unit',
    priority: 'high'
  }
];

export const getTestSuitesByCategory = (category: TestSuite['category']): TestSuite[] => {
  return TEST_SUITES.filter(suite => suite.category === category);
};

export const getTestSuitesByPriority = (priority: TestSuite['priority']): TestSuite[] => {
  return TEST_SUITES.filter(suite => suite.priority === priority);
};

export const getCriticalTestSuites = (): TestSuite[] => {
  return getTestSuitesByPriority('high');
};

export const generateTestReport = (): string => {
  let report = '# Test Suite Coverage Report\n\n';
  
  report += `## Summary\n`;
  report += `- Total Test Suites: ${TEST_SUITES.length}\n`;
  report += `- Critical (High Priority): ${getTestSuitesByPriority('high').length}\n`;
  report += `- Unit Tests: ${getTestSuitesByCategory('unit').length}\n`;
  report += `- Integration Tests: ${getTestSuitesByCategory('integration').length}\n\n`;
  
  report += `## Test Suites by Priority\n\n`;
  
  ['high', 'medium', 'low'].forEach(priority => {
    const suites = getTestSuitesByPriority(priority as TestSuite['priority']);
    if (suites.length > 0) {
      report += `### ${priority.toUpperCase()} Priority\n`;
      suites.forEach(suite => {
        report += `- **${suite.name}**: ${suite.description}\n`;
      });
      report += '\n';
    }
  });
  
  return report;
};