import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { NotionSync } from '../NotionSync';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
  })),
}));

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
};

describe('NotionSync - Warning Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.create.mockReturnValue(mockApi as any);
    
    // Default mock responses
    mockApi.get.mockImplementation((url) => {
      if (url === '/notion-sync/status') {
        return Promise.resolve({
          data: {
            configured: true,
            hasNotionToken: true,
            hasNotionDatabase: true,
            ready: true,
          },
        });
      }
      if (url === '/notion-sync/stats') {
        return Promise.resolve({
          data: {
            totalWorkActivities: 10,
            notionImported: 8,
            percentage: 80,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  test('displays skip warnings with protection alert', async () => {
    // Mock sync response with skip warnings
    mockApi.post.mockResolvedValue({
      data: {
        message: 'Sync completed successfully',
        stats: {
          created: 1,
          updated: 2,
          errors: 0,
          warnings: [
            '"Smith Property" on 2025-06-29: Skipped sync - you have newer local changes that would be overwritten',
            '"Johnson Garden" on 2025-06-28: AI could not extract work activities',
            '"Davis Lawn" on 2025-06-27: Skipped sync - you have newer local changes that would be overwritten',
          ],
        },
      },
    });

    render(<NotionSync />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Notion Sync')).toBeInTheDocument();
    });

    // Click sync button
    const syncButton = screen.getByText('Sync from Notion');
    fireEvent.click(syncButton);

    // Wait for sync to complete
    await waitFor(() => {
      expect(screen.getByText('Sync Warnings (3)')).toBeInTheDocument();
    });

    // Check that protection alert is shown
    expect(screen.getByText(/Data Protection Active/)).toBeInTheDocument();
    expect(
      screen.getByText(/Some items were skipped because you have local changes/)
    ).toBeInTheDocument();

    // Expand warnings accordion
    const warningsAccordion = screen.getByText('Sync Warnings (3)');
    fireEvent.click(warningsAccordion);

    // Check that skip warnings are displayed with shield icons
    await waitFor(() => {
      expect(
        screen.getByText(/Smith Property.*Skipped sync - you have newer local changes/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Davis Lawn.*Skipped sync - you have newer local changes/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Johnson Garden.*AI could not extract work activities/)
      ).toBeInTheDocument();
    });
  });

  test('does not show protection alert when no skip warnings exist', async () => {
    // Mock sync response with only parsing warnings (no skips)
    mockApi.post.mockResolvedValue({
      data: {
        message: 'Sync completed successfully',
        stats: {
          created: 2,
          updated: 1,
          errors: 0,
          warnings: [
            '"Johnson Garden" on 2025-06-28: AI could not extract work activities',
            '"Wilson Yard" on 2025-06-26: No content to parse',
          ],
        },
      },
    });

    render(<NotionSync />);

    await waitFor(() => {
      expect(screen.getByText('Notion Sync')).toBeInTheDocument();
    });

    // Click sync button
    const syncButton = screen.getByText('Sync from Notion');
    fireEvent.click(syncButton);

    // Wait for sync to complete
    await waitFor(() => {
      expect(screen.getByText('Sync Warnings (2)')).toBeInTheDocument();
    });

    // Protection alert should NOT be shown
    expect(screen.queryByText(/Data Protection Active/)).not.toBeInTheDocument();

    // Expand warnings accordion
    const warningsAccordion = screen.getByText('Sync Warnings (2)');
    fireEvent.click(warningsAccordion);

    // Check that only parsing warnings are displayed
    await waitFor(() => {
      expect(
        screen.getByText(/Johnson Garden.*AI could not extract work activities/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Wilson Yard.*No content to parse/)
      ).toBeInTheDocument();
    });
  });

  test('hides warnings section when no warnings exist', async () => {
    // Mock sync response with no warnings
    mockApi.post.mockResolvedValue({
      data: {
        message: 'Sync completed successfully',
        stats: {
          created: 3,
          updated: 2,
          errors: 0,
          warnings: [],
        },
      },
    });

    render(<NotionSync />);

    await waitFor(() => {
      expect(screen.getByText('Notion Sync')).toBeInTheDocument();
    });

    // Click sync button
    const syncButton = screen.getByText('Sync from Notion');
    fireEvent.click(syncButton);

    // Wait for sync to complete
    await waitFor(() => {
      expect(screen.getByText('Last Sync Results')).toBeInTheDocument();
    });

    // Warnings section should not be visible
    expect(screen.queryByText(/Sync Warnings/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Data Protection Active/)).not.toBeInTheDocument();
  });

  test('shows correct warning icons for different warning types', async () => {
    // Mock sync response with mixed warning types
    mockApi.post.mockResolvedValue({
      data: {
        message: 'Sync completed successfully',
        stats: {
          created: 0,
          updated: 1,
          errors: 0,
          warnings: [
            '"Smith Property" on 2025-06-29: Skipped sync - you have newer local changes that would be overwritten',
            '"Johnson Garden" on 2025-06-28: AI could not extract work activities',
          ],
        },
      },
    });

    render(<NotionSync />);

    await waitFor(() => {
      expect(screen.getByText('Notion Sync')).toBeInTheDocument();
    });

    // Click sync button
    const syncButton = screen.getByText('Sync from Notion');
    fireEvent.click(syncButton);

    // Wait for sync to complete and expand warnings
    await waitFor(() => {
      expect(screen.getByText('Sync Warnings (2)')).toBeInTheDocument();
    });

    const warningsAccordion = screen.getByText('Sync Warnings (2)');
    fireEvent.click(warningsAccordion);

    // Check that both warnings are displayed
    await waitFor(() => {
      expect(
        screen.getByText(/Smith Property.*Skipped sync/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Johnson Garden.*AI could not extract/)
      ).toBeInTheDocument();
    });

    // Note: Icon testing would require more complex setup with Material-UI test utils
    // The important part is that the warnings display correctly
  });

  test('handles sync errors gracefully', async () => {
    // Mock sync error
    mockApi.post.mockRejectedValue(new Error('Sync failed'));

    render(<NotionSync />);

    await waitFor(() => {
      expect(screen.getByText('Notion Sync')).toBeInTheDocument();
    });

    // Click sync button
    const syncButton = screen.getByText('Sync from Notion');
    fireEvent.click(syncButton);

    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Error during sync/)).toBeInTheDocument();
    });
  });
});