import { describe, expect, expectTypeOf, test, vi } from 'vitest';
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
	type AsyncResult,
} from './index.js';

describe('core', () => {
	/* ────────────────────────────────────────────────────────────────────────── *
	 * constructors / type guards
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('ok', () => {
		test('creates an ok result', () => {
			const r = ok(5 as const);
			expectTypeOf(r).toEqualTypeOf<Result<5, never>>();
			expect(r).toEqual({ ok: true, value: 5 });
		});
	});

	describe('error', () => {
		test('creates an error result', () => {
			const e = error('err' as const);
			expectTypeOf(e).toEqualTypeOf<Result<never, 'err'>>();
			expect(e).toEqual({ ok: false, error: 'err' });
		});
	});

	describe('from', () => {
		test('returns a cloned result (ok)', () => {
			const r = from({ ok: true, value: 1 } as const);
			expectTypeOf(r).toEqualTypeOf<Result<1, unknown>>();
			expect(r).toEqual({ ok: true, value: 1 });
		});

		test('returns a cloned result (error)', () => {
			const r = from({ ok: false, error: 'e' } as const);
			expectTypeOf(r).toEqualTypeOf<Result<unknown, 'e'>>();
			expect(r).toEqual({ ok: false, error: 'e' });
		});

		test('unwraps an async ok result', async () => {
			const r = from(Promise.resolve(ok(42 as const)));
			expectTypeOf(r).toEqualTypeOf<AsyncResult<42, never>>();
			await expect(r).resolves.toEqual({ ok: true, value: 42 });
		});

		test('unwraps an async error result', async () => {
			const r = from(Promise.resolve(error('nope' as const)));
			expectTypeOf(r).toEqualTypeOf<AsyncResult<never, 'nope'>>();
			await expect(r).resolves.toEqual({ ok: false, error: 'nope' });
		});

		test('handles nested async results by fully normalizing', async () => {
			const nested = Promise.resolve(Promise.resolve(ok('deep')) as any);
			// from() only handles Promise<Result>, so make the inner promise resolve to a Result
			const r = from(nested.then((p) => p as Result<string, never>));
			await expect(r).resolves.toEqual({ ok: true, value: 'deep' });
		});
	});

	describe('isResultLike', () => {
		test('detects result objects', () => {
			expect(isResultLike({ ok: true, value: 1 })).toBe(true);
			expect(isResultLike({ ok: false, error: 'e' })).toBe(true);
			expect(isResultLike(null)).toBe(false);
			expect(isResultLike(undefined)).toBe(false);
			expect(isResultLike({})).toBe(false);
			expect(isResultLike({ ok: true })).toBe(false);
			expect(isResultLike({ ok: false })).toBe(false);
			expect(isResultLike({ value: 1 })).toBe(false);
			expect(isResultLike({ error: 'e' })).toBe(false);
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * try / tryCatch
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('tryCatch', () => {
		test('returns ok when function succeeds (sync)', () => {
			const r = tryCatch(() => 2);
			expect(r.ok).toBe(true);
			if (!r.ok) throw new Error();
			expect(r.value).toBe(2);
		});

		test('returns error when function throws (sync)', () => {
			const err = new Error('boom');
			const fn = (): void => {
				throw err;
			};
			const r = tryCatch(fn);
			expect(r.ok).toBe(false);
			if (r.ok) throw new Error();
			expect(r.error).toBe(err);
		});

		test('maps error with onError (sync)', () => {
			const r = tryCatch(
				() => {
					throw 'x';
				},
				(e) => `mapped:${String(e)}`,
			);
			expect(r).toEqual({ ok: false, error: 'mapped:x' });
		});

		test('returns ok when async function resolves', async () => {
			const r = tryCatch(async () => 7);
			await expect(r).resolves.toEqual({ ok: true, value: 7 });
		});

		test('returns error when async function rejects', async () => {
			const r = tryCatch(
				async () => {
					throw new Error('kapow');
				},
				(e) => (e as Error).message,
			);
			await expect(r).resolves.toEqual({ ok: false, error: 'kapow' });
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * all
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('all', () => {
		test('collects all ok values (sync)', () => {
			const r = all([ok(1), ok(2)] as const);
			expect(r.ok).toBe(true);
			if (!r.ok) throw new Error();
			expect(r.value).toEqual([1, 2]);
		});

		test('returns first error (sync)', () => {
			const err = error('e');
			const r = all([ok(1), err, ok(3)]);
			expect(r.ok).toBe(false);
			if (r.ok) throw new Error();
			expect(r.error).toBe('e');
		});

		test('collects all ok values (async inputs)', async () => {
			const r = all([
				Promise.resolve(ok(1)),
				ok(2),
				Promise.resolve(ok(3)),
			]);
			await expect(r).resolves.toEqual({ ok: true, value: [1, 2, 3] });
		});

		test('returns first error from resolved ordering (async inputs)', async () => {
			const r = all([
				Promise.resolve(ok('a')),
				Promise.resolve(error('bad')),
				Promise.resolve(ok('c')),
			]);
			const res = await r;
			expect(res).toEqual({ ok: false, error: 'bad' });
		});

		test('works with async results produced by tryCatch', async () => {
			const good = tryCatch(async () => 10);
			const bad = tryCatch(async () => {
				throw 'nope';
			});
			const r = all([good, bad, Promise.resolve(ok(3))]);
			const res = await r;
			expect(res).toEqual({ ok: false, error: 'nope' });
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * map
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('map', () => {
		describe('data-first', () => {
			test('maps the value if ok (sync)', () => {
				const r = map(ok(2), (v) => v * 3);
				expect(r).toEqual({ ok: true, value: 6 });
			});

			test('skips mapping if error (sync)', () => {
				const r = map(error('e'), (v: number) => v * 3);
				expect(r).toEqual({ ok: false, error: 'e' });
			});

			test('propagates async when input is async', async () => {
				const r = map(Promise.resolve(ok(3)), (v) => v + 1);
				await expect(r).resolves.toEqual({ ok: true, value: 4 });
			});

			test('becomes async when mapper returns a promise', async () => {
				const r = map(ok(3), async (v) => v + 2);
				const res = await r;
				expect(res).toEqual({ ok: true, value: 5 });
			});
		});

		describe('data-last (curried)', () => {
			test('maps (sync)', () => {
				const double = map((n: number) => n * 2);
				const r = double(ok(5));
				expect(r).toEqual({ ok: true, value: 10 });
			});

			test('becomes async when mapper returns a promise', async () => {
				const inc = map(async (n: number) => n + 1);
				const r = inc(ok(1));
				await expect(r).resolves.toEqual({ ok: true, value: 2 });
			});

			test('skips mapping if error', () => {
				const double = map((n: number) => n * 2);
				const r = double(error('x'));
				expect(r).toEqual({ ok: false, error: 'x' });
			});
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * flatMap
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('flatMap', () => {
		describe('data-first', () => {
			test('flattens the result if ok (sync)', () => {
				const r = flatMap(ok(2), (v) => ok(v + 1));
				expect(r).toEqual({ ok: true, value: 3 });
			});

			test('skips callback if error (sync)', () => {
				const r = flatMap(error('e'), () => ok(2));
				expect(r).toEqual({ ok: false, error: 'e' });
			});

			test('handles promise results (mapper returns async)', async () => {
				const r = flatMap(ok(2), async (v) => ok(v + 1));
				const res = await r;
				expect(res).toEqual({ ok: true, value: 3 });
			});

			test('propagates async when input is async', async () => {
				const r = flatMap(Promise.resolve(ok(5)), (v) => ok(v * 2));
				await expect(r).resolves.toEqual({ ok: true, value: 10 });
			});
		});

		describe('data-last (curried)', () => {
			test('works (sync mapper)', () => {
				const plus1 = flatMap((v: number) => ok(v + 1));
				const r = plus1(ok(1));
				expect(r).toEqual({ ok: true, value: 2 });
			});

			test('works (async mapper)', async () => {
				const plus1 = flatMap(async (v: number) => ok(v + 1));
				const res = await plus1(ok(1));
				expect(res).toEqual({ ok: true, value: 2 });
			});

			test('skips on error', () => {
				const f = flatMap((_: number) => ok(123));
				const r = f(error('nope'));
				expect(r).toEqual({ ok: false, error: 'nope' });
			});
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * mapError
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('mapError', () => {
		describe('data-first', () => {
			test('maps the error if present (sync)', () => {
				const r = mapError(error('e'), (e) => `err:${e}`);
				expect(r).toEqual({ ok: false, error: 'err:e' });
			});

			test('leaves ok result unchanged (sync)', () => {
				const r = mapError(ok(1), (e) => `err:${e}`);
				expect(r).toEqual({ ok: true, value: 1 });
			});

			test('propagates async when input is async', async () => {
				const r = mapError(
					Promise.resolve(error('x')),
					(e) => `bad:${e}`,
				);
				await expect(r).resolves.toEqual({ ok: false, error: 'bad:x' });
			});

			test('becomes async when mapper returns a promise', async () => {
				const r = mapError(error('x'), async (e) => `bad:${e}`);
				const res = await r;
				expect(res).toEqual({ ok: false, error: 'bad:x' });
			});
		});

		describe('data-last (curried)', () => {
			test('maps error (sync)', () => {
				const tag = mapError((e: string) => `E:${e}`);
				const r = tag(error('boom'));
				expect(r).toEqual({ ok: false, error: 'E:boom' });
			});

			test('skips mapping for ok', () => {
				const tag = mapError((e: string) => `E:${e}`);
				const r = tag(ok(9));
				expect(r).toEqual({ ok: true, value: 9 });
			});

			test('async mapper', async () => {
				const tag = mapError(async (e: string) => `E:${e}`);
				const r = tag(error('boom'));
				await expect(r).resolves.toEqual({
					ok: false,
					error: 'E:boom',
				});
			});
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * flatMapError
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('flatMapError', () => {
		describe('data-first', () => {
			test('flattens error mapping (sync)', () => {
				const r = flatMapError(error('e'), (e) =>
					error(`err:${e}`),
				) as Result<never, string>;
				expect(r).toEqual({ ok: false, error: 'err:e' });
			});

			test('skips callback when ok (sync)', () => {
				const r = flatMapError(ok(1), (e) => error(`err:${e}`));
				expect(r).toEqual({ ok: true, value: 1 });
			});

			test('handles promise results (mapper returns async)', async () => {
				const r = flatMapError(error('e'), async (e) =>
					error(`err:${e}`),
				);
				const res = await r;
				expect(res).toEqual({ ok: false, error: 'err:e' });
			});

			test('propagates async when input is async', async () => {
				const r = flatMapError(Promise.resolve(error('e')), (e) =>
					ok(`recovered:${e}`),
				);
				await expect(r).resolves.toEqual({
					ok: true,
					value: 'recovered:e',
				});
			});
		});

		describe('data-last (curried)', () => {
			test('maps error to error (sync)', () => {
				const tag = flatMapError((e: string) => error(`X:${e}`));
				const r = tag(error('no'));
				expect(r).toEqual({ ok: false, error: 'X:no' });
			});

			test('maps error to ok (recovery)', () => {
				const recover = flatMapError((e: string) => ok(`ok:${e}`));
				const r = recover(error('oops'));
				expect(r).toEqual({ ok: true, value: 'ok:oops' });
			});

			test('async mapper', async () => {
				const recover = flatMapError(async (e: string) =>
					ok(`ok:${e}`),
				);
				const r = recover(error('oops'));
				await expect(r).resolves.toEqual({
					ok: true,
					value: 'ok:oops',
				});
			});

			test('skips when ok', () => {
				const recover = flatMapError((e: string) => ok(`ok:${e}`));
				const r = recover(ok(1));
				expect(r).toEqual({ ok: true, value: 1 });
			});
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * catchError
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('catchError', () => {
		describe('data-first', () => {
			test('converts error to ok (sync)', () => {
				const r = catchError(error('e'), (e) => `handled:${e}`);
				expect(r).toEqual({ ok: true, value: 'handled:e' });
			});

			test('does nothing if ok (sync)', () => {
				const r = catchError(ok(1), (e) => `handled:${e}`);
				expect(r).toEqual({ ok: true, value: 1 });
			});

			test('propagates async when input is async', async () => {
				const r = catchError(
					Promise.resolve(error('x')),
					(e) => `yay:${e}`,
				);
				await expect(r).resolves.toEqual({ ok: true, value: 'yay:x' });
			});

			test('becomes async when mapper returns a promise', async () => {
				const r = catchError(error('x'), async (e) => `yay:${e}`);
				const res = await r;
				expect(res).toEqual({ ok: true, value: 'yay:x' });
			});
		});

		describe('data-last (curried)', () => {
			test('recovers (sync)', () => {
				const recover = catchError((e: string) => `R:${e}`);
				const r = recover(error('bad'));
				expect(r).toEqual({ ok: true, value: 'R:bad' });
			});

			test('recovers (async)', async () => {
				const recover = catchError(async (e: string) => `R:${e}`);
				const r = recover(error('bad'));
				await expect(r).resolves.toEqual({ ok: true, value: 'R:bad' });
			});

			test('no-op on ok', () => {
				const recover = catchError((e: string) => `R:${e}`);
				const r = recover(ok(9));
				expect(r).toEqual({ ok: true, value: 9 });
			});
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * tap
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('tap', () => {
		describe('data-first', () => {
			test('calls callback if ok (sync cb)', () => {
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

			test('returns a promise when cb is async (and preserves the original)', async () => {
				const spy = vi.fn();
				const r = tap(ok('x'), async (v) => {
					await new Promise((r) => setTimeout(r, 5));
					spy(v);
				});
				const res = await r;
				expect(spy).toHaveBeenCalledWith('x');
				expect(res).toEqual({ ok: true, value: 'x' });
			});

			test('propagates async input unchanged through tap', async () => {
				const spy = vi.fn();
				const r = tap(Promise.resolve(ok(9)), (v) => spy(v));
				const res = await r;
				expect(spy).toHaveBeenCalledWith(9);
				expect(res).toEqual({ ok: true, value: 9 });
			});
		});

		describe('data-last (curried)', () => {
			test('calls callback (sync cb)', () => {
				const spy = vi.fn();
				const run = tap(spy);
				const r = run(ok(3));
				expect(spy).toHaveBeenCalledWith(3);
				expect(r).toEqual({ ok: true, value: 3 });
			});

			test('async cb returns promise and preserves original', async () => {
				const spy = vi.fn();
				const run = tap(async (v: number) => {
					await new Promise((r) => setTimeout(r, 5));
					spy(v);
				});
				const r = run(ok(4));
				await expect(r).resolves.toEqual({ ok: true, value: 4 });
				expect(spy).toHaveBeenCalledWith(4);
			});

			test('skips on error', () => {
				const spy = vi.fn();
				const run = tap(spy);
				const r = run(error('no'));
				expect(spy).not.toHaveBeenCalled();
				expect(r).toEqual({ ok: false, error: 'no' });
			});
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * tapError
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('tapError', () => {
		describe('data-first', () => {
			test('calls callback if error (sync cb)', () => {
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

			test('returns a promise when cb is async (and preserves the original)', async () => {
				const spy = vi.fn();
				const r = tapError(error('bad'), async (e) => {
					await new Promise((r) => setTimeout(r, 5));
					spy(e);
				});
				const res = await r;
				expect(spy).toHaveBeenCalledWith('bad');
				expect(res).toEqual({ ok: false, error: 'bad' });
			});

			test('propagates async input unchanged through tapError', async () => {
				const spy = vi.fn();
				const r = tapError(Promise.resolve(error('nope')), (e) =>
					spy(e),
				);
				const res = await r;
				expect(spy).toHaveBeenCalledWith('nope');
				expect(res).toEqual({ ok: false, error: 'nope' });
			});
		});

		describe('data-last (curried)', () => {
			test('calls callback on error (sync cb)', () => {
				const spy = vi.fn();
				const run = tapError(spy);
				const r = run(error('X'));
				expect(spy).toHaveBeenCalledWith('X');
				expect(r).toEqual({ ok: false, error: 'X' });
			});

			test('async cb preserves original', async () => {
				const spy = vi.fn();
				const run = tapError(async (e: string) => {
					await new Promise((r) => setTimeout(r, 5));
					spy(e);
				});
				const r = run(error('Y'));
				await expect(r).resolves.toEqual({ ok: false, error: 'Y' });
				expect(spy).toHaveBeenCalledWith('Y');
			});

			test('skips on ok', () => {
				const spy = vi.fn();
				const run = tapError(spy);
				const r = run(ok(10));
				expect(spy).not.toHaveBeenCalled();
				expect(r).toEqual({ ok: true, value: 10 });
			});
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * tapBoth
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('tapBoth', () => {
		describe('data-first', () => {
			test('calls callback and returns original (sync)', () => {
				const spy = vi.fn();
				const r1 = tapBoth(ok(1), spy);
				const r2 = tapBoth(error('e'), spy);
				expect(spy).toHaveBeenCalledTimes(2);
				expect(r1).toEqual({ ok: true, value: 1 });
				expect(r2).toEqual({ ok: false, error: 'e' });
			});

			test('async callback yields a promise that resolves to original', async () => {
				const calls: Array<Result<number, string>> = [];
				const r = tapBoth(ok(5), async (r) => {
					await new Promise((r) => setTimeout(r, 5));
					calls.push(r as Result<number, string>);
				});
				const res = await r;
				expect(calls).toHaveLength(1);
				expect(res).toEqual({ ok: true, value: 5 });
			});

			test('works with async input unchanged', async () => {
				const spy = vi.fn();
				const r = tapBoth(Promise.resolve(error('X')), (r) => spy(r));
				const res = await r;
				expect(spy).toHaveBeenCalledTimes(1);
				expect(res).toEqual({ ok: false, error: 'X' });
			});
		});

		describe('data-last (curried)', () => {
			test('calls callback and returns original (sync)', () => {
				const spy = vi.fn();
				const run = tapBoth(spy);
				const r1 = run(ok(2));
				const r2 = run(error('E'));
				expect(spy).toHaveBeenCalledTimes(2);
				expect(r1).toEqual({ ok: true, value: 2 });
				expect(r2).toEqual({ ok: false, error: 'E' });
			});

			test('async callback returns promise and preserves original', async () => {
				const spy = vi.fn();
				const run = tapBoth(async (_: Result<number, string>) => {
					await new Promise((r) => setTimeout(r, 5));
					spy('did');
				});
				const r = run(ok(9));
				await expect(r).resolves.toEqual({ ok: true, value: 9 });
				expect(spy).toHaveBeenCalledWith('did');
			});
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * match
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('match', () => {
		describe('data-first', () => {
			test('returns onOk for ok value (sync)', () => {
				const r = match(
					ok(2),
					(v) => v + 1,
					(e) => 0,
				);
				expect(r).toBe(3);
			});

			test('returns onError for error (sync)', () => {
				const r = match(
					error('e'),
					(v) => v,
					(e) => `err:${e}`,
				);
				expect(r).toBe('err:e');
			});

			test('works with async input', async () => {
				const r = match(
					Promise.resolve(ok(10)),
					(v) => v * 3,
					() => -1,
				);
				await expect(r).resolves.toBe(30);
			});
		});

		describe('data-last (curried)', () => {
			test('ok path (sync)', () => {
				const onOk = (n: number) => n + 2;
				const onErr = (e: string) => `bad:${e}`;
				const m = match(onOk, onErr);
				expect(m(ok(1))).toBe(3);
			});

			test('error path (sync)', () => {
				const onOk = (n: number) => n + 2;
				const onErr = (e: string) => `bad:${e}`;
				const m = match(onOk, onErr);
				expect(m(error('x'))).toBe('bad:x');
			});

			test('async input', async () => {
				const m = match(
					(n: number) => n * 2,
					(_: string) => -1,
				);
				const out = m(Promise.resolve(ok(7)));
				await expect(out).resolves.toBe(14);
			});
		});
	});

	/* ────────────────────────────────────────────────────────────────────────── *
	 * pipe integration (sync + async boundaries)
	 * (kept for completeness; not part of the "data-first vs data-last" checks)
	 * ────────────────────────────────────────────────────────────────────────── */

	describe('pipe integration', () => {
		test('purely sync pipeline stays sync', () => {
			const r = pipe(
				ok(2),
				map((x) => x + 1),
				flatMap((x) => ok(x * 2)),
				map((x) => x - 1),
			);
			expect(r).toEqual({ ok: true, value: 5 });
		});

		test('pipeline crosses into async when a step returns a promise', async () => {
			const startTime = Date.now();
			const r = pipe(
				ok(2),
				flatMap((x) => ok(x + 1)),
				map((x) => x * 2),
				flatMap(async (x) => {
					await new Promise((resolve) => setTimeout(resolve, 5));
					return ok(x - 1);
				}),
				tap(async () => {
					// async side effect, should keep result shape and become async
					await new Promise((resolve) => setTimeout(resolve, 5));
				}),
				map((x) => x + 0),
			);

			const res = await r;
			expect(res).toEqual({ ok: true, value: 5 });
			expect(Date.now() - startTime).toBeGreaterThanOrEqual(10);
		});

		test('errors short-circuit subsequent mapping steps (sync)', () => {
			const spy = vi.fn();
			const r = pipe(
				error('bad'),
				map((x: number) => x + 1), // skipped
				tap(spy), // skipped
				flatMap((x: number) => ok(x * 2)), // skipped
			);
			expect(spy).not.toHaveBeenCalled();
			expect(r).toEqual({ ok: false, error: 'bad' });
		});

		test('recovering from error mid-pipe and continuing (sync)', () => {
			const r = pipe(
				error('boom'),
				catchError((e) => 10),
				map((x) => x + 5),
			);
			expect(r).toEqual({ ok: true, value: 15 });
		});

		test('recovering from error with async mapper and continuing', async () => {
			const r = pipe(
				error('nope'),
				catchError(async (e) => {
					await new Promise((r) => setTimeout(r, 5));
					return 3;
				}),
				map((x) => x * 4),
			);
			const res = await r;
			expect(res).toEqual({ ok: true, value: 12 });
		});

		test('async input remains async through subsequent sync steps', async () => {
			const r = pipe(
				Promise.resolve(ok(5)),
				map((x) => x + 1),
				flatMap((x) => ok(x * 2)),
			);
			await expect(r).resolves.toEqual({ ok: true, value: 12 });
		});

		test('tap/tapError/tapBoth do not alter the value and preserve async boundary', async () => {
			const tapOk = vi.fn();
			const tapErr = vi.fn();
			const tapAny = vi.fn();

			const r1 = pipe(
				ok(1),
				tap(tapOk),
				tapError(tapErr),
				tapBoth(tapAny),
			);
			expect(tapOk).toHaveBeenCalledWith(1);
			expect(tapErr).not.toHaveBeenCalled();
			expect(tapAny).toHaveBeenCalledTimes(1);
			expect(r1).toEqual({ ok: true, value: 1 });

			const r2 = pipe(
				Promise.resolve(error('x')),
				tap(tapOk),
				tapError(tapErr),
				tapBoth(tapAny),
			);
			const res2 = await r2;
			expect(tapOk).toHaveBeenCalledTimes(1);
			expect(tapErr).toHaveBeenCalledWith('x');
			expect(tapAny).toHaveBeenCalledTimes(2);
			expect(res2).toEqual({ ok: false, error: 'x' });
		});

		test('pipe + match with async result returns awaited mapped value', async () => {
			const out = pipe(
				ok(2),
				flatMap(async (v) => ok(v + 3)),
				match(
					(v) => v * 2,
					() => -1,
				),
			);
			await expect(out).resolves.toBe(10);
		});
	});
});
