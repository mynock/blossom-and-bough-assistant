import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { NotionSyncService } from '../services/NotionSyncService';
import type { Employee, NewEmployee } from '../db/schema';

type ResolveResult = { employeeIds: number[]; warnings: string[] };

function makeEmployee(overrides: Partial<Employee> & { id: number; name: string }): Employee {
  return {
    employeeId: `emp-${overrides.id}`,
    regularWorkdays: '',
    homeAddress: '',
    minHoursPerDay: 0,
    maxHoursPerDay: 8,
    capabilityLevel: 1,
    hourlyRate: null,
    notes: null,
    activeStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Employee;
}

describe('NotionSyncService.resolveTeamMembers', () => {
  let service: NotionSyncService;
  let getAllEmployees: jest.Mock<() => Promise<Employee[]>>;
  let createEmployee: jest.Mock<(data: NewEmployee) => Promise<Employee>>;
  let resolveTeamMembers: (names: string[]) => Promise<ResolveResult>;
  let nextEmployeeId: number;

  beforeEach(() => {
    service = new NotionSyncService();
    nextEmployeeId = 100;

    getAllEmployees = jest.fn<() => Promise<Employee[]>>();
    createEmployee = jest.fn<(data: NewEmployee) => Promise<Employee>>(async (data) => {
      return makeEmployee({ id: nextEmployeeId++, name: data.name });
    });

    (service as any).employeeService = {
      getAllEmployees,
      createEmployee
    };

    resolveTeamMembers = (service as any).resolveTeamMembers.bind(service);
  });

  it('returns existing employee IDs without warnings when every name matches', async () => {
    getAllEmployees.mockResolvedValue([
      makeEmployee({ id: 1, name: 'Andrea Wilson' }),
      makeEmployee({ id: 2, name: 'Anne McGary' })
    ]);

    const result = await resolveTeamMembers(['Andrea', 'Anne']);

    expect(result.employeeIds).toEqual([1, 2]);
    expect(result.warnings).toEqual([]);
    expect(createEmployee).not.toHaveBeenCalled();
  });

  it('auto-creates an unmatched team member and emits a warning', async () => {
    getAllEmployees.mockResolvedValue([
      makeEmployee({ id: 1, name: 'Andrea Wilson' }),
      makeEmployee({ id: 2, name: 'Anne McGary' })
    ]);

    const result = await resolveTeamMembers(['Andrea', 'Syd', 'Anne']);

    expect(result.employeeIds).toEqual([1, 100, 2]);
    expect(result.warnings).toEqual([
      'Auto-created employee "Syd" from Notion - please review their details'
    ]);
    expect(createEmployee).toHaveBeenCalledTimes(1);

    const created = createEmployee.mock.calls[0][0];
    expect(created.name).toBe('Syd');
    expect(created.activeStatus).toBe('active');
    expect(created.notes).toMatch(/Auto-created from Notion/i);
    expect(created.employeeId).toMatch(/^notion-/);
  });

  it('does NOT treat nickname variants as a match (e.g., "Andy" is not "Andrea")', async () => {
    getAllEmployees.mockResolvedValue([
      makeEmployee({ id: 1, name: 'Andrea Wilson' })
    ]);

    const result = await resolveTeamMembers(['Andy']);

    expect(result.employeeIds).toEqual([100]);
    expect(result.warnings).toEqual([
      'Auto-created employee "Andy" from Notion - please review their details'
    ]);
    expect(createEmployee).toHaveBeenCalledTimes(1);
  });

  it('matches a first name in Notion against a full name in the DB (e.g., "Anne" → "Anne McGary")', async () => {
    getAllEmployees.mockResolvedValue([
      makeEmployee({ id: 2, name: 'Anne McGary' })
    ]);

    const result = await resolveTeamMembers(['Anne']);

    expect(result.employeeIds).toEqual([2]);
    expect(result.warnings).toEqual([]);
    expect(createEmployee).not.toHaveBeenCalled();
  });

  it('skips blank and whitespace-only names', async () => {
    getAllEmployees.mockResolvedValue([
      makeEmployee({ id: 1, name: 'Andrea Wilson' })
    ]);

    const result = await resolveTeamMembers(['', '   ', 'Andrea']);

    expect(result.employeeIds).toEqual([1]);
    expect(result.warnings).toEqual([]);
    expect(createEmployee).not.toHaveBeenCalled();
  });

  it('does not double-create when the same unmatched name appears twice', async () => {
    getAllEmployees.mockResolvedValue([]);

    const result = await resolveTeamMembers(['Syd', 'Syd']);

    expect(result.employeeIds).toEqual([100, 100]);
    expect(result.warnings).toHaveLength(1);
    expect(createEmployee).toHaveBeenCalledTimes(1);
  });

  it('returns an empty result for an empty input list', async () => {
    getAllEmployees.mockResolvedValue([]);

    const result = await resolveTeamMembers([]);

    expect(result.employeeIds).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(createEmployee).not.toHaveBeenCalled();
  });

  it('preserves input order so per-employee hour splits stay aligned with team members', async () => {
    getAllEmployees.mockResolvedValue([
      makeEmployee({ id: 2, name: 'Anne McGary' })
    ]);

    const result = await resolveTeamMembers(['Syd', 'Anne', 'NewPerson']);

    expect(result.employeeIds).toEqual([100, 2, 101]);
    expect(result.employeeIds).toHaveLength(3);
  });

  it('rejects arbitrary substring matches that are not whole tokens (e.g., "An" is not "Anne McGary")', async () => {
    getAllEmployees.mockResolvedValue([
      makeEmployee({ id: 1, name: 'Anne McGary' }),
      makeEmployee({ id: 2, name: 'Andrea Wilson' })
    ]);

    const result = await resolveTeamMembers(['An']);

    expect(result.employeeIds).toEqual([100]);
    expect(result.warnings).toEqual([
      'Auto-created employee "An" from Notion - please review their details'
    ]);
  });

  it('auto-creates when a first name is ambiguous across multiple employees', async () => {
    getAllEmployees.mockResolvedValue([
      makeEmployee({ id: 1, name: 'Anne McGary' }),
      makeEmployee({ id: 2, name: 'Anne Patterson' })
    ]);

    const result = await resolveTeamMembers(['Anne']);

    // Two valid candidates → ambiguous → auto-create rather than silently pick one
    expect(result.employeeIds).toEqual([100]);
    expect(result.warnings).toEqual([
      'Auto-created employee "Anne" from Notion - please review their details'
    ]);
  });

  it('matches a multi-token Notion name against a single-token DB record (e.g., "Anne McGary" → "Anne")', async () => {
    getAllEmployees.mockResolvedValue([
      makeEmployee({ id: 2, name: 'Anne' })
    ]);

    const result = await resolveTeamMembers(['Anne McGary']);

    expect(result.employeeIds).toEqual([2]);
    expect(result.warnings).toEqual([]);
    expect(createEmployee).not.toHaveBeenCalled();
  });

  it('matches across hyphenated last names (e.g., "Smith" → "Anna Smith-Jones")', async () => {
    getAllEmployees.mockResolvedValue([
      makeEmployee({ id: 5, name: 'Anna Smith-Jones' })
    ]);

    const result = await resolveTeamMembers(['Smith']);

    expect(result.employeeIds).toEqual([5]);
    expect(result.warnings).toEqual([]);
  });

  it('prefers an exact match over a token match when both exist', async () => {
    getAllEmployees.mockResolvedValue([
      makeEmployee({ id: 1, name: 'Anne McGary' }),
      makeEmployee({ id: 2, name: 'Anne' })
    ]);

    const result = await resolveTeamMembers(['Anne']);

    // Exact match wins; ambiguity check never fires
    expect(result.employeeIds).toEqual([2]);
    expect(result.warnings).toEqual([]);
    expect(createEmployee).not.toHaveBeenCalled();
  });
});
