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

export function from<T, E>(result: Result<T, E>): Result<T, E> {
  return result.ok ? ok(result.value) : error(result.error);
}

export function isResult(value: unknown): value is Result<unknown, unknown> {
  return !!value && typeof value === "object" && "ok" in value;
}

export function tryCatch<T, E = unknown>(fn: () => T): Result<T, E> {
  try {
    return ok(fn());
  } catch (e) {
    return error(e as E);
  }
}

export function all<T, E>(iterable: Iterable<Result<T, E>>): Result<T[], E> {
  const values: T[] = [];
  for (const result of iterable) {
    if (!result.ok) {
      return error(result.error);
    }
    values.push(result.value);
  }
  return ok(values);
}

export function map<T, E, U>(result: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : error(result.error);
}

export function flatMap<T, E, U, F = E>(
  result: Result<T, E>,
  fn: (v: T) => Result<U, F> | PromiseLike<Result<U, F>>,
): Result<U, F> | PromiseLike<Result<U, F>> {
  return result.ok ? fn(result.value) : error(result.error as unknown as F);
}

export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (e: E) => F,
): Result<T, F> {
  return result.ok ? ok(result.value) : error(fn(result.error));
}

export function flatMapError<T, E, U, F = E>(
  result: Result<T, E>,
  fn: (e: E) => Result<U, F> | PromiseLike<Result<U, F>>,
): Result<T | U, F> | PromiseLike<Result<T | U, F>> {
  return result.ok ? ok(result.value) : fn(result.error);
}

export function catchError<T, E, U>(
  result: Result<T, E>,
  fn: (e: E) => U,
): Result<T | U, never> {
  return result.ok ? ok(result.value) : ok(fn(result.error));
}

export function tap<T, E>(result: Result<T, E>, onOk: (v: T) => void): Result<T, E> {
  if (result.ok) {
    onOk(result.value);
  }
  return result;
}

export function tapError<T, E>(
  result: Result<T, E>,
  onError: (e: E) => void,
): Result<T, E> {
  if (!result.ok) {
    onError(result.error);
  }
  return result;
}

export function tapBoth<T, E>(
  result: Result<T, E>,
  onFinally: () => void,
): Result<T, E> {
  onFinally();
  return result;
}

export function match<T, E, TValue, TError>(
  result: Result<T, E>,
  onOk: (v: T) => TValue,
  onError: (e: E) => TError,
): TValue | TError {
  return result.ok ? onOk(result.value) : onError(result.error);
}
