import assert from 'node:assert/strict';
import test from 'node:test';
import { validTracingDays, formatCcmddDate } from '../src/pharmacy/ccmdd/ccmddValidation.ts';

test('rejects empty, invalid and out-of-range tracing days', () => {
  for (const invalid of ['', ' ', '0', '91', '-1', '2.5', 'NaN', '1e2', '00100']) {
    assert.equal(validTracingDays(invalid), false, invalid);
  }
});

test('accepts valid integer tracing days', () => {
  for (const valid of ['1', '7', '90', ' 15 ']) assert.equal(validTracingDays(valid), true, valid);
});

test('shows missing and malformed timestamps without crashing', () => {
  assert.equal(formatCcmddDate(null), '—');
  assert.equal(formatCcmddDate(''), '—');
  assert.equal(formatCcmddDate('invalid-timestamp'), '—');
});

test('converts UTC timestamps to SAST', () => {
  const displayed = formatCcmddDate('2026-10-23T09:00:00Z');
  assert.match(displayed, /11:00/);
  assert.match(displayed, /SAST$/);
});
