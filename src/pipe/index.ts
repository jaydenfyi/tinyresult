import {
  map as mapFn,
  flatMap as flatMapFn,
  mapError as mapErrorFn,
  flatMapError as flatMapErrorFn,
  catchError as catchErrorFn,
  tap as tapFn,
  tapError as tapErrorFn,
  tapBoth as finallyFn,
  match as matchFn,
  type Result as CoreResult,
} from "../core/index.js"

export type Result<T, E = unknown> = CoreResult<T, E>

export { ok, error, from, isResult, tryCatch, all } from '../core/index.js'

export function map<T, E, U>(fn: (value: T) => U) {
  return (result: CoreResult<T, E>) => mapFn(result, fn)
}

export function flatMap<T, E, U, F = E>(
  fn: (value: T) => Result<U, F> | PromiseLike<Result<U, F>>,
) {
  return (result: Result<T, E>) => flatMapFn(result, fn)
}

export function mapError<T, E, F>(fn: (error: E) => F) {
  return (result: CoreResult<T, E>) => mapErrorFn(result, fn)
}

export function flatMapError<T, E, U, F = E>(
  fn: (error: E) => Result<U, F> | PromiseLike<Result<U, F>>,
) {
  return (result: Result<T, E>) => flatMapErrorFn(result, fn)
}

export function catchError<T, E, U>(fn: (error: E) => U) {
  return (result: CoreResult<T, E>) => catchErrorFn(result, fn)
}

export function tap<T, E>(onOk: (value: T) => void) {
  return (result: CoreResult<T, E>) => tapFn(result, onOk)
}

export function tapError<T, E>(onError: (error: E) => void) {
  return (result: CoreResult<T, E>) => tapErrorFn(result, onError)
}

export function tapBoth<T, E>(callbackFn: () => void) {
  return (result: CoreResult<T, E>) => finallyFn(result, callbackFn)
}

export function match<T, E, TValue, TError>(
  onOk: (value: T) => TValue,
  onError: (error: E) => TError,
) {
  return (result: CoreResult<T, E>) => matchFn(result, onOk, onError)
}