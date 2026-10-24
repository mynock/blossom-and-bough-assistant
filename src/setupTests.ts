import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest globals are off, so RTL can't register its own afterEach cleanup.
afterEach(() => {
  cleanup();
});
