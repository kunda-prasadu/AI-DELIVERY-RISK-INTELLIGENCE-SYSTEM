'use strict';

const AuditStore = require('../src/models/audit.store');

describe('AuditStore', () => {
  beforeEach(() => AuditStore.clear());

  test('records chained audit entries with hashes', () => {
    const first = AuditStore.record({
      actorId: 'u1',
      actorRole: 'admin',
      action: 'auth.login',
      resourceType: 'session',
      resourceId: 'u1',
      outcome: 'SUCCESS',
      metadata: { email: 'admin@test.com' },
    });
    const second = AuditStore.record({
      actorId: 'u1',
      actorRole: 'admin',
      action: 'auth.logout',
      resourceType: 'session',
      resourceId: 'u1',
      outcome: 'SUCCESS',
      metadata: {},
    });

    expect(first.hash).toBeTruthy();
    expect(second.previousHash).toBe(first.hash);
    expect(AuditStore.verifyIntegrity().valid).toBe(true);
  });

  test('filters entries by action and outcome', () => {
    AuditStore.record({ action: 'auth.login', resourceType: 'session', outcome: 'SUCCESS' });
    AuditStore.record({ action: 'auth.login', resourceType: 'session', outcome: 'FAILURE' });
    AuditStore.record({ action: 'auth.logout', resourceType: 'session', outcome: 'SUCCESS' });

    const results = AuditStore.list({ action: 'auth.login', outcome: 'FAILURE' });
    expect(results.length).toBe(1);
    expect(results[0].action).toBe('auth.login');
    expect(results[0].outcome).toBe('FAILURE');
  });

  test('limits results and returns newest first', () => {
    AuditStore.record({ action: 'one', resourceType: 'event', outcome: 'SUCCESS' });
    AuditStore.record({ action: 'two', resourceType: 'event', outcome: 'SUCCESS' });
    AuditStore.record({ action: 'three', resourceType: 'event', outcome: 'SUCCESS' });

    const results = AuditStore.list({ limit: 2 });
    expect(results.length).toBe(2);
    expect(results[0].action).toBe('three');
    expect(results[1].action).toBe('two');
  });
});
