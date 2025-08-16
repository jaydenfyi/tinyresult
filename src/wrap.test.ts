import { Result } from './index';
import { describe, it, expect } from 'vitest';

describe('wrap', () => {
	it('should wrap a sync function', () => {
		const wrapped = Result.wrap((a: number, b: number) => a + b);
		const result = wrapped(1, 2);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(3);
		}
	});

	it('should wrap a sync function that throws', () => {
		const wrapped = Result.wrap((): void => {
			throw new Error('error');
		});
		const result = wrapped();
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toEqual(new Error('error'));
		}
	});

	it('should wrap an async function', async () => {
		const wrapped = Result.wrap(async (a: number, b: number) => a + b);
		const result = await wrapped(1, 2);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toBe(3);
		}
	});

	it('should wrap an async function that rejects', async () => {
		const wrapped = Result.wrap(async () => {
			throw new Error('error');
		});
		const result = await wrapped();
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toEqual(new Error('error'));
		}
	});

	it('should map an error', () => {
		const wrapped = Result.wrap(
			(): void => {
				throw new Error('error');
			},
			(e) => (e as Error).message,
		);
		const result = wrapped();
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('error');
		}
	});

	it('should map a rejection', async () => {
		const wrapped = Result.wrap(
			async () => {
				throw new Error('error');
			},
			(e) => (e as Error).message,
		);
		const result = await wrapped();
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe('error');
		}
	});
});
