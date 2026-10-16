import { describe, expect, it } from 'vitest';
import { NF_REGEX } from '@/lib/validation/recebimento';

describe('correção da NF principal', () => {
  it('aceita NF com traço e recusa letra', () => {
    expect(NF_REGEX.test('087781-1')).toBe(true);
    expect(NF_REGEX.test('123456')).toBe(true);
    expect(NF_REGEX.test('12A')).toBe(false);
  });
});
