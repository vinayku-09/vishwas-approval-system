import { describe, expect, it } from 'vitest';
import { resolveAlertRecipient } from '../services/mailer.js';

describe('Alert email recipient resolution', () => {
  it('uses the configured override recipient', () => {
    expect(resolveAlertRecipient('role@example.gov.in', 'inbox@example.com')).toBe(
      'inbox@example.com'
    );
  });

  it('falls back to the role recipient when no override is set', () => {
    expect(resolveAlertRecipient('role@example.gov.in', '')).toBe('role@example.gov.in');
    expect(resolveAlertRecipient('role@example.gov.in', '   ')).toBe('role@example.gov.in');
  });

  it('trims surrounding whitespace from either recipient', () => {
    expect(resolveAlertRecipient('  role@example.gov.in  ', '')).toBe('role@example.gov.in');
    expect(resolveAlertRecipient('role@example.gov.in', '  inbox@example.com  ')).toBe(
      'inbox@example.com'
    );
  });
});
