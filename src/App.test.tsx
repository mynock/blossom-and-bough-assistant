import React from 'react';

// Very basic test to ensure React and Jest are working
test('React is working', () => {
  expect(React).toBeDefined();
  expect(typeof React.createElement).toBe('function');
});

// Basic test for simple React element creation
test('can create basic React elements', () => {
  const element = React.createElement('div', null, 'Hello World');
  expect(React.isValidElement(element)).toBe(true);
});

// Test that we can run basic assertions
test('basic Jest functionality works', () => {
  expect(1 + 1).toBe(2);
  expect('frontend').toContain('front');
  expect([1, 2, 3]).toHaveLength(3);
});