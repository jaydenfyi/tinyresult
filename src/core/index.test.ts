import { describe, expect, test, vi } from 'vitest';
import {
	ok,
	error,
	tryCatch,
	all,
	from,
	isResult as isResultLike,
	map,
	flatMap,
	mapError,
	flatMapError,
	catchError,
	tap,
	tapError,
	tapBoth,
	match,
	Result,
	pipe,
} from './index.js';

describe('core', () => {
	describe('ok', () => {
		test('creates an ok result', () => {
			const r = ok(5);
			expect(r).toEqual({ ok: true, value: 5 });
		});
	});

	describe('error', () => {
		test('creates an error result', () => {
			const e = error('err');
			expect(e).toEqual({ ok: false, error: 'err' });
		});
	});

	describe('from', () => {
		test('returns a cloned result', () => {
			const r = from({ ok: true, value: 1 });
			expect(r).toEqual({ ok: true, value: 1 });
		});
	});

	describe('isResultLike', () => {
		test('detects result objects', () => {
			expect(isResultLike({ ok: true, value: 1 })).toBe(true);
			expect(isResultLike({ ok: false, error: 'e' })).toBe(true);
			expect(isResultLike(null)).toBe(false);
			expect(isResultLike(undefined)).toBe(false);
			expect(isResultLike({})).toBe(false);
		});
	});

	describe('tryCatch', () => {
		test('returns ok when function succeeds', () => {
			const r = tryCatch(() => 2);
			expect(r.ok).toBe(true);
			if (!r.ok) throw new Error();
			expect(r.value).toBe(2);
		});

		test('returns error when function throws', () => {
			const err = new Error('boom');
			const fn = (): void => {
				throw err;
			};
			const r = tryCatch(fn);
			expect(r.ok).toBe(false);
			if (r.ok) throw new Error();
			expect(r.error).toBe(err);
		});
	});
	``;
	describe('all', () => {
		test('collects all ok values', () => {
			const r = all([ok(1), ok(2)] as const);
			expect(r.ok).toBe(true);
			if (!r.ok) throw new Error();
			expect(r.value).toEqual([1, 2]);
		});

		test('returns first error', () => {
			const err = error('e');
			const r = all([ok(1), err, ok(3)]);
			expect(r.ok).toBe(false);
			if (r.ok) throw new Error();
			expect(r.error).toBe('e');
		});
	});

	describe('map', () => {
		test('maps the value if ok', () => {
			const r = map(ok(2), (v) => v * 3);
			expect(r).toEqual({ ok: true, value: 6 });
		});

		test('skips mapping if error', () => {
			const r = map(error('e'), (v: number) => v * 3);
			expect(r).toEqual({ ok: false, error: 'e' });
		});
	});

	describe('flatMap', () => {
		test('flattens the result if ok', () => {
			const r = flatMap(ok(2), (v) => ok(v + 1));
			expect(r).toEqual({ ok: true, value: 3 });
		});

		test('skips callback if error', () => {
			const r = flatMap(error('e'), () => ok(2));
			expect(r).toEqual({ ok: false, error: 'e' });
		});

		test('handles promise results', async () => {
			const r = flatMap(ok(2), async (v) => ok(v + 1));
			const res = await r;
			expect(res).toEqual({ ok: true, value: 3 });
		});
	});

	describe('mapError', () => {
		test('maps the error if present', () => {
			const r = mapError(error('e'), (e) => `err:${e}`);
			expect(r).toEqual({ ok: false, error: 'err:e' });
		});

		test('leaves ok result unchanged', () => {
			const r = mapError(ok(1), (e) => `err:${e}`);
			expect(r).toEqual({ ok: true, value: 1 });
		});
	});

	describe('flatMapError', () => {
		test('flattens error mapping', () => {
			const r = flatMapError(error('e'), (e) =>
				error(`err:${e}`),
			) as Result<never, string>;
			expect(r).toEqual({ ok: false, error: 'err:e' });
		});

		test('skips callback when ok', () => {
			const r = flatMapError(ok(1), (e) => error(`err:${e}`));
			expect(r).toEqual({ ok: true, value: 1 });
		});

		test('handles promise results', async () => {
			const r = flatMapError(error('e'), async (e) => error(`err:${e}`));
			const res = await r;
			expect(res).toEqual({ ok: false, error: 'err:e' });
		});
	});

	describe('catchError', () => {
		test('converts error to ok', () => {
			const r = catchError(error('e'), (e) => `handled:${e}`);
			expect(r).toEqual({ ok: true, value: 'handled:e' });
		});

		test('does nothing if ok', () => {
			const r = catchError(ok(1), (e) => `handled:${e}`);
			expect(r).toEqual({ ok: true, value: 1 });
		});
	});

	describe('tap', () => {
		test('calls callback if ok', () => {
			const spy = vi.fn();
			const r = tap(ok(2), spy);
			expect(spy).toHaveBeenCalledWith(2);
			expect(r).toEqual({ ok: true, value: 2 });
		});

		test('does not call callback if error', () => {
			const spy = vi.fn();
			const r = tap(error('e'), spy);
			expect(spy).not.toHaveBeenCalled();
			expect(r).toEqual({ ok: false, error: 'e' });
		});
	});

	describe('tapError', () => {
		test('calls callback if error', () => {
			const spy = vi.fn();
			const r = tapError(error('e'), spy);
			expect(spy).toHaveBeenCalledWith('e');
			expect(r).toEqual({ ok: false, error: 'e' });
		});

		test('does not call callback if ok', () => {
			const spy = vi.fn();
			const r = tapError(ok(1), spy);
			expect(spy).not.toHaveBeenCalled();
			expect(r).toEqual({ ok: true, value: 1 });
		});
	});

	describe('finally_', () => {
		test('calls callback and returns original', () => {
			const spy = vi.fn();
			const r1 = tapBoth(ok(1), spy);
			const r2 = tapBoth(error('e'), spy);
			expect(spy).toHaveBeenCalledTimes(2);
			expect(r1).toEqual({ ok: true, value: 1 });
			expect(r2).toEqual({ ok: false, error: 'e' });
		});
	});

	describe('match', () => {
		test('returns onOk for ok value', () => {
			const r = match(
				ok(2),
				(v) => v + 1,
				(e) => 0,
			);
			expect(r).toBe(3);
		});

		test('returns onError for error', () => {
			const r = match(
				error('e'),
				(v) => v,
				(e) => `err:${e}`,
			);
			expect(r).toBe('err:e');
		});
	});
});

// describe('pipe map test', () => {
// 	test('should correctly handle async operations', async () => {
// 		console.log('Starting pipe test...');
// 		const startTime = new Date().toISOString();
// 		console.log('Start time:', startTime);
// 		const result = await pipe(
// 			ok(2),
// 			flatMap((x) => ok(x + 1)),
// 			map((x) => x * 2),
// 			flatMap(async (x) => {
// 				// Simulate an async operation
// 				await new Promise((resolve) => setTimeout(resolve, 100));
// 				return ok(x - 1);
// 			}),
// 			// tap(async (x) => {
// 			// 	await new Promise((resolve) => setTimeout(resolve, 2000));
// 			// 	console.log('Final value:', x);
// 			// }),
// 			tap(async (x) => {
// 				// Simulate another async operation
// 				await new Promise((resolve) => setTimeout(resolve, 2000));
// 				const ellapsedMs = Date.now() - new Date(startTime).getTime();
// 				console.log({
// 					time: new Date().toISOString(),
// 					value: x,
// 					ellapsedMs,
// 				});
// 			}),
// 		);
// 		console.log('Result:', result);
// 		expect(result).toEqual({ ok: true, value: 5 });
// 	});
// });

// test('should handle async map', async () => {
// 	const checkAsyncMap = map(ok(1), (v) => v + 1);
// 	const foo = mapError(
// 		map({ ok: true, value: 1 }, (v) => `Number is ${v}` as const),
// 		(e) => `Error: ${e}` as const,
// 	);

// 	console.log('checkAsyncMap:', checkAsyncMap);
// 	expect(checkAsyncMap).toEqual({ ok: true, value: 2 });
// });

// const asyncOk = Promise.resolve(ok(1 as const));
// test('should handle async map (pipe)', async () => {
// 	const startTime = new Date().toISOString();
// 	const result = pipe(
// 		{ ok: true, value: 1 } as const,
// 		tap((v) => {
// 			console.log('Value before flatMap:', v);
// 		}),
// 		flatMap(async (v) => ok(v + 1)),
// 		flatMap((v) => {
// 			return tryCatch(() => {
// 				return v + 1;
// 			});
// 		}),
// 		tap((v) => {
// 			console.log('Value after flatMap:', v);
// 		}),
// 		tapBoth(async (v) => {
// 			console.log('Just hanging out for 2 seconds...', v);
// 			await new Promise((resolve) => setTimeout(resolve, 2_000));
// 			console.log('Done hanging out!');
// 		}),
// 		map((v) => `Number is ${v}` as const),
// 		// match(
// 		// 	(v) => v,
// 		// 	(e) => `Error: ${e}` as const,
// 		// ),
// 	);

// 	const concurrencyTest = all([
// 		result,
// 		pipe(
// 			{ ok: true, value: 1 } as const,
// 			tap((v) => {
// 				console.log('inline started...');
// 				console.log('Value before flatMap:', v);
// 			}),
// 			flatMap(async (v) => ok(v + 1)),
// 			flatMap((v) => {
// 				return tryCatch(() => {
// 					return v + 1;
// 				});
// 			}),
// 			tap((v) => {
// 				console.log('Value after flatMap:', v);
// 			}),
// 			tapBoth(async (v) => {
// 				console.log('Just hanging out for 2 seconds...', v);
// 				await new Promise((resolve) => setTimeout(resolve, 10));
// 				console.log('Done hanging out!');
// 			}),
// 			map((v) => `Number is ${v}` as const),
// 			tapBoth((v) => {
// 				console.log('inline done', v);
// 			}),
// 			// match(
// 			// 	(v) => v,
// 			// 	(e) => `Error: ${e}` as const,
// 			// ),
// 		),
// 	]);

// 	console.log('concurrencyTest:', await concurrencyTest);

// 	const endTime = new Date().toISOString();
// 	console.log('Time ellapsed:', {
// 		startTime,
// 		endTime,
// 		ellapsedMs: new Date(endTime).getTime() - new Date(startTime).getTime(),
// 	});
// 	console.log('Result:', result);
// 	expect(await result).toEqual(ok('Number is 3' as const));
// });
