'use strict';

const ProjectStore = require('../src/models/project.store');

beforeEach(() => ProjectStore._reset());

describe('ProjectStore.listAll', () => {
  test('returns all 5 seeded projects', () => {
    const projects = ProjectStore.listAll();
    expect(projects.length).toBe(5);
  });

  test('filters by status', () => {
    const active = ProjectStore.listAll({ status: 'active' });
    expect(active.every(p => p.status === 'active')).toBe(true);
    expect(active.length).toBeGreaterThan(0);
  });

  test('filters by team', () => {
    const platform = ProjectStore.listAll({ team: 'platform' });
    expect(platform.every(p => p.team === 'platform')).toBe(true);
  });

  test('filters by portfolioId', () => {
    const fintech = ProjectStore.listAll({ portfolioId: 'pf-fintech' });
    expect(fintech.length).toBeGreaterThan(0);
    expect(fintech.every(p => p.portfolioId === 'pf-fintech')).toBe(true);
  });

  test('combined filter returns subset', () => {
    const results = ProjectStore.listAll({ status: 'active', team: 'platform' });
    expect(results.every(p => p.status === 'active' && p.team === 'platform')).toBe(true);
  });
});

describe('ProjectStore.findById', () => {
  test('finds seeded project by id', () => {
    const p = ProjectStore.findById('proj-001');
    expect(p).not.toBeNull();
    expect(p.name).toBe('Payments Gateway v3');
  });

  test('returns null for unknown id', () => {
    expect(ProjectStore.findById('nonexistent')).toBeNull();
  });
});

describe('ProjectStore.create', () => {
  const newProject = {
    name: 'Test Project Alpha',
    description: 'A test project',
    status: 'active',
    team: 'engineering',
    startDate: '2026-01-01',
    targetDate: '2026-12-31',
    metadata: { repo: 'org/test' },
  };

  test('creates project with generated id', () => {
    const p = ProjectStore.create(newProject);
    expect(p.id).toBeTruthy();
    expect(p.name).toBe('Test Project Alpha');
    expect(p.status).toBe('active');
    expect(p.portfolioId).toBe('pf-unassigned');
    expect(p.portfolioName).toBe('Unassigned Portfolio');
  });

  test('creates project with provided portfolio fields', () => {
    const p = ProjectStore.create({
      ...newProject,
      portfolioId: 'pf-enterprise',
      portfolioName: 'Enterprise Portfolio',
    });

    expect(p.portfolioId).toBe('pf-enterprise');
    expect(p.portfolioName).toBe('Enterprise Portfolio');
  });

  test('created project is retrievable', () => {
    const created = ProjectStore.create(newProject);
    const found = ProjectStore.findById(created.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(created.id);
  });

  test('throws INVALID_STATUS for bad status', () => {
    expect(() => ProjectStore.create({ ...newProject, status: 'ghost' }))
      .toThrow();
  });
});

describe('ProjectStore.updateStatus', () => {
  test('updates status of existing project', () => {
    const updated = ProjectStore.updateStatus('proj-001', 'paused');
    expect(updated.status).toBe('paused');
  });

  test('returns null for unknown project', () => {
    expect(ProjectStore.updateStatus('no-id', 'active')).toBeNull();
  });

  test('throws for invalid status', () => {
    expect(() => ProjectStore.updateStatus('proj-001', 'invalid_status')).toThrow();
  });
});
