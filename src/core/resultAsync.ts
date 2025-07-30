// core/index.ts — same API as your sync core, but with overloads that
// accept either a sync Result<T,E> or a PromiseLike<Result<T,E>>.
// Return types become PromiseLike<> when either the input or the callback is async.

export interface OkResult<T> {
    readonly ok: true;
    readonly value: T;
}

export interface ErrorResult<E> {
    readonly ok: false;
    readonly error: E;
}

export type Result<T, E> = OkResult<T> | ErrorResult<E>;

export function ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

export function error<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

export function isResult(value: unknown): value is Result<unknown, unknown> {
    return !!value
        && typeof value === "object"
        && "ok" in value
        && (("value" in (value as any) && (value as any).ok === true)
            || ("error" in (value as any) && (value as any).ok === false));
}

// ---------- helpers ----------

function isThenable<T = unknown>(v: unknown): v is PromiseLike<T> {
    if (v === null) return false;
    const t = typeof v;
    if (t !== "object" && t !== "function") return false;
    // @ts-expect-error runtime check
    return typeof v.then === "function";
}

function fromSync<T, E>(result: Result<T, E>): Result<T, E> {
    return result.ok ? ok(result.value) : error(result.error);
}

function allSync<T, E>(iterable: Iterable<Result<T, E>>): Result<T[], E> {
    const values: T[] = [];
    for (const r of iterable) {
        if (!r.ok) return error(r.error);
        values.push(r.value);
    }
    return ok(values);
}

// ---------- from ----------

export function from<T, E>(result: Result<T, E>): Result<T, E>;
export function from<T, E>(result: PromiseLike<Result<T, E>>): PromiseLike<Result<T, E>>;
export function from<T, E>(result: Result<T, E> | PromiseLike<Result<T, E>>):
    Result<T, E> | PromiseLike<Result<T, E>> {
    if (isThenable(result)) {
        return Promise.resolve(result).then((r) => (r.ok ? ok(r.value) : error(r.error)));
    }
    return fromSync(result);
}

// ---------- tryCatch ----------

export function tryCatch<T, E = unknown>(fn: () => T): Result<T, E>;
export function tryCatch<T, E = unknown>(fn: () => PromiseLike<T>): PromiseLike<Result<T, E>>;
export function tryCatch<T, E = unknown>(fn: () => T | PromiseLike<T>):
    Result<T, E> | PromiseLike<Result<T, E>> {
    try {
        const out = fn();
        if (isThenable(out)) return Promise.resolve(out).then(ok, (e) => error(e as E));
        return ok(out);
    } catch (e) {
        return error(e as E);
    }
}

// ---------- all ----------

export function all<T, E>(iterable: Iterable<Result<T, E>>): Result<T[], E>;
export function all<T, E>(iterable: Iterable<Result<T, E> | PromiseLike<Result<T, E>>>): PromiseLike<Result<T[], E>>;
export function all<T, E>(iterable: Iterable<Result<T, E> | PromiseLike<Result<T, E>>>):
    Result<T[], E> | PromiseLike<Result<T[], E>> {
    let anyAsync = false;
    const items: Array<Result<T, E> | PromiseLike<Result<T, E>>> = [];
    for (const item of iterable) {
        if (isThenable(item)) anyAsync = true;
        items.push(item);
    }
    if (!anyAsync) return allSync(items as Result<T, E>[]);
    return Promise.all(items.map((i) => Promise.resolve(i))).then((rs) => allSync(rs));
}

// ---------- map ----------

export function map<T, E, U>(result: Result<T, E>, fn: (v: T) => U): Result<U, E>;
export function map<T, E, U>(result: Result<T, E>, fn: (v: T) => PromiseLike<U>): PromiseLike<Result<U, E>>;
export function map<T, E, U>(result: PromiseLike<Result<T, E>>, fn: (v: T) => U): PromiseLike<Result<U, E>>;
export function map<T, E, U>(result: PromiseLike<Result<T, E>>, fn: (v: T) => PromiseLike<U>): PromiseLike<Result<U, E>>;
export function map<T, E, U>(
    result: Result<T, E> | PromiseLike<Result<T, E>>,
    fn: (v: T) => U | PromiseLike<U>,
): Result<U, E> | PromiseLike<Result<U, E>> {
    if (isThenable(result)) {
        return Promise.resolve(result).then((r) => {
            if (!r.ok) return error<E>(r.error) as Result<U, E>;
            const out = fn(r.value);
            if (isThenable(out)) return Promise.resolve(out).then((u) => ok<U>(u));
            return ok(out);
        });
    }

    if (!result.ok) return error(result.error);
    const out = fn(result.value);
    if (isThenable(out)) return Promise.resolve(out).then((u) => ok<U>(u));
    return ok(out);
}

// ---------- flatMap ----------

export function flatMap<T, E, U, F = E>(result: Result<T, E>, fn: (v: T) => Result<U, F>): Result<U, F>;
export function flatMap<T, E, U, F = E>(result: Result<T, E>, fn: (v: T) => PromiseLike<Result<U, F>>): PromiseLike<Result<U, F>>;
export function flatMap<T, E, U, F = E>(result: PromiseLike<Result<T, E>>, fn: (v: T) => Result<U, F>): PromiseLike<Result<U, F>>;
export function flatMap<T, E, U, F = E>(result: PromiseLike<Result<T, E>>, fn: (v: T) => PromiseLike<Result<U, F>>): PromiseLike<Result<U, F>>;
export function flatMap<T, E, U, F = E>(
    result: Result<T, E> | PromiseLike<Result<T, E>>,
    fn: (v: T) => Result<U, F> | PromiseLike<Result<U, F>>,
): Result<U, F> | PromiseLike<Result<U, F>> {
    if (isThenable(result)) {
        return Promise.resolve(result).then((r) => {
            if (!r.ok) return error<F>(r.error as unknown as F);
            const out = fn(r.value);
            return isThenable(out) ? Promise.resolve(out) : out;
        });
    }

    if (!result.ok) return error(result.error as unknown as F);
    const out = fn(result.value);
    return isThenable(out) ? Promise.resolve(out) : out;
}

// ---------- mapError ----------

export function mapError<T, E, F>(result: Result<T, E>, fn: (e: E) => F): Result<T, F>;
export function mapError<T, E, F>(result: Result<T, E>, fn: (e: E) => PromiseLike<F>): PromiseLike<Result<T, F>>;
export function mapError<T, E, F>(result: PromiseLike<Result<T, E>>, fn: (e: E) => F): PromiseLike<Result<T, F>>;
export function mapError<T, E, F>(result: PromiseLike<Result<T, E>>, fn: (e: E) => PromiseLike<F>): PromiseLike<Result<T, F>>;
export function mapError<T, E, F>(
    result: Result<T, E> | PromiseLike<Result<T, E>>,
    fn: (e: E) => F | PromiseLike<F>,
): Result<T, F> | PromiseLike<Result<T, F>> {
    if (isThenable(result)) {
        return Promise.resolve(result).then((r) => {
            if (r.ok) return ok<T>(r.value) as Result<T, F>;
            const out = fn(r.error);
            if (isThenable(out)) return Promise.resolve(out).then((f) => error<F>(f));
            return error(out);
        });
    }

    if (result.ok) return ok(result.value) as Result<T, F>;
    const out = fn(result.error);
    if (isThenable(out)) return Promise.resolve(out).then((f) => error<F>(f));
    return error(out);
}

// ---------- flatMapError ----------

export function flatMapError<T, E, U, F = E>(result: Result<T, E>, fn: (e: E) => Result<U, F>): Result<T | U, F>;
export function flatMapError<T, E, U, F = E>(result: Result<T, E>, fn: (e: E) => PromiseLike<Result<U, F>>): PromiseLike<Result<T | U, F>>;
export function flatMapError<T, E, U, F = E>(result: PromiseLike<Result<T, E>>, fn: (e: E) => Result<U, F>): PromiseLike<Result<T | U, F>>;
export function flatMapError<T, E, U, F = E>(result: PromiseLike<Result<T, E>>, fn: (e: E) => PromiseLike<Result<U, F>>): PromiseLike<Result<T | U, F>>;
export function flatMapError<T, E, U, F = E>(
    result: Result<T, E> | PromiseLike<Result<T, E>>,
    fn: (e: E) => Result<U, F> | PromiseLike<Result<U, F>>,
): Result<T | U, F> | PromiseLike<Result<T | U, F>> {
    if (isThenable(result)) {
        return Promise.resolve(result).then((r) => {
            if (r.ok) return ok<T>(r.value) as Result<T | U, F>;
            const out = fn(r.error);
            return isThenable(out) ? Promise.resolve(out) : out;
        });
    }

    if (result.ok) return ok(result.value) as Result<T | U, F>;
    const out = fn(result.error);
    return isThenable(out) ? Promise.resolve(out) : out;
}

// ---------- catchError ----------

export function catchError<T, E, U>(result: Result<T, E>, fn: (e: E) => U): Result<T | U, never>;
export function catchError<T, E, U>(result: Result<T, E>, fn: (e: E) => PromiseLike<U>): PromiseLike<Result<T | U, never>>;
export function catchError<T, E, U>(result: PromiseLike<Result<T, E>>, fn: (e: E) => U): PromiseLike<Result<T | U, never>>;
export function catchError<T, E, U>(result: PromiseLike<Result<T, E>>, fn: (e: E) => PromiseLike<U>): PromiseLike<Result<T | U, never>>;
export function catchError<T, E, U>(
    result: Result<T, E> | PromiseLike<Result<T, E>>,
    fn: (e: E) => U | PromiseLike<U>,
): Result<T | U, never> | PromiseLike<Result<T | U, never>> {
    if (isThenable(result)) {
        return Promise.resolve(result).then((r) => {
            if (r.ok) return ok<T>(r.value) as Result<T | U, never>;
            const out = fn(r.error);
            if (isThenable(out)) return Promise.resolve(out).then((u) => ok<T | U>(u) as Result<T | U, never>);
            return ok(out) as Result<T | U, never>;
        });
    }

    if (result.ok) return ok(result.value) as Result<T | U, never>;
    const out = fn(result.error);
    if (isThenable(out)) return Promise.resolve(out).then((u) => ok<T | U>(u) as Result<T | U, never>);
    return ok(out) as Result<T | U, never>;
}

// ---------- tap ----------

export function tap<T, E>(result: Result<T, E>, onOk: (v: T) => void): Result<T, E>;
export function tap<T, E>(result: Result<T, E>, onOk: (v: T) => PromiseLike<void>): PromiseLike<Result<T, E>>;
export function tap<T, E>(result: PromiseLike<Result<T, E>>, onOk: (v: T) => void): PromiseLike<Result<T, E>>;
export function tap<T, E>(result: PromiseLike<Result<T, E>>, onOk: (v: T) => PromiseLike<void>): PromiseLike<Result<T, E>>;
export function tap<T, E>(
    result: Result<T, E> | PromiseLike<Result<T, E>>,
    onOk: (v: T) => void | PromiseLike<void>,
): Result<T, E> | PromiseLike<Result<T, E>> {
    if (isThenable(result)) {
        return Promise.resolve(result).then(async (r) => {
            if (r.ok) {
                try {
                    await Promise.resolve(onOk(r.value));
                } catch { }
            }
            return r;
        });
    }

    if (result.ok) {
        const out = onOk(result.value);
        if (isThenable(out)) return Promise.resolve(out).then(() => result);
    }
    return result;
}

// ---------- tapError ----------

export function tapError<T, E>(result: Result<T, E>, onError: (e: E) => void): Result<T, E>;
export function tapError<T, E>(result: Result<T, E>, onError: (e: E) => PromiseLike<void>): PromiseLike<Result<T, E>>;
export function tapError<T, E>(result: PromiseLike<Result<T, E>>, onError: (e: E) => void): PromiseLike<Result<T, E>>;
export function tapError<T, E>(result: PromiseLike<Result<T, E>>, onError: (e: E) => PromiseLike<void>): PromiseLike<Result<T, E>>;
export function tapError<T, E>(
    result: Result<T, E> | PromiseLike<Result<T, E>>,
    onError: (e: E) => void | PromiseLike<void>,
): Result<T, E> | PromiseLike<Result<T, E>> {
    if (isThenable(result)) {
        return Promise.resolve(result).then(async (r) => {
            if (!r.ok) {
                try {
                    await Promise.resolve(onError(r.error));
                } catch { }
            }
            return r;
        });
    }

    if (!result.ok) {
        const out = onError(result.error);
        if (isThenable(out)) return Promise.resolve(out).then(() => result);
    }
    return result;
}

// ---------- tapBoth ----------

export function tapBoth<T, E>(result: Result<T, E>, onFinally: () => void): Result<T, E>;
export function tapBoth<T, E>(result: Result<T, E>, onFinally: () => PromiseLike<void>): PromiseLike<Result<T, E>>;
export function tapBoth<T, E>(result: PromiseLike<Result<T, E>>, onFinally: () => void): PromiseLike<Result<T, E>>;
export function tapBoth<T, E>(result: PromiseLike<Result<T, E>>, onFinally: () => PromiseLike<void>): PromiseLike<Result<T, E>>;
export function tapBoth<T, E>(
    result: Result<T, E> | PromiseLike<Result<T, E>>,
    onFinally: () => void | PromiseLike<void>,
): Result<T, E> | PromiseLike<Result<T, E>> {
    if (isThenable(result)) {
        return Promise.resolve(result)
            .then((r) => r)
            .finally(() => Promise.resolve(onFinally()).catch(() => { })) as PromiseLike<Result<T, E>>;
    }

    const out = onFinally();
    if (isThenable(out)) return Promise.resolve(out).then(() => result);
    return result;
}

// ---------- match ----------

export function match<T, E, TValue, TError>(
    result: Result<T, E>,
    onOk: (v: T) => TValue,
    onError: (e: E) => TError,
): TValue | TError;

export function match<T, E, TValue, TError>(
    result: Result<T, E>,
    onOk: (v: T) => PromiseLike<TValue>,
    onError: (e: E) => TError | PromiseLike<TError>,
): PromiseLike<TValue | TError>;

export function match<T, E, TValue, TError>(
    result: PromiseLike<Result<T, E>>,
    onOk: (v: T) => TValue,
    onError: (e: E) => TError,
): PromiseLike<TValue | TError>;

export function match<T, E, TValue, TError>(
    result: PromiseLike<Result<T, E>>,
    onOk: (v: T) => PromiseLike<TValue>,
    onError: (e: E) => TError | PromiseLike<TError>,
): PromiseLike<TValue | TError>;

export function match<T, E, TValue, TError>(
    result: Result<T, E> | PromiseLike<Result<T, E>>,
    onOk: (v: T) => TValue | PromiseLike<TValue>,
    onError: (e: E) => TError | PromiseLike<TError>,
): (TValue | TError) | PromiseLike<TValue | TError> {
    if (isThenable(result)) {
        return Promise.resolve(result).then((r) => (r.ok ? onOk(r.value) : onError(r.error)));
    }

    if (!result.ok) return onError(result.error);
    const out = onOk(result.value);
    if (isThenable(out)) return Promise.resolve(out);
    return out;
}
