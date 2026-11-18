import test from 'node:test';
import assert from 'node:assert/strict';
import { communityErrorDiagnostic } from '../community-db.js';

test('diagnóstico informa usuário e origem sem expor SQL ou senha', () => {
  assert.equal(communityErrorDiagnostic({ code: 'ER_ACCESS_DENIED_ERROR', message: "Access denied for user 'account_user'@'10.0.0.5' (using password: YES)", sql: 'private-query', password: 'private-secret' }), 'ER_ACCESS_DENIED_ERROR user=account_user origin=10.0.0.5 passwordProvided=YES');
  assert.equal(communityErrorDiagnostic({ code: 'ER_UNKNOWN_ERROR', message: 'private-secret' }), 'ER_UNKNOWN_ERROR');
  assert.equal(communityErrorDiagnostic({ code: 'ER_ACCESS_DENIED_ERROR', message: 'private-secret' }), 'ER_ACCESS_DENIED_ERROR');
});
