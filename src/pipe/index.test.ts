import { describe, expect, test, vi } from "vitest"
import {
  ok,
  error,
  map,
  flatMap,
  mapError,
  flatMapError,
  catchError,
  tap,
  tapError,
  tapBoth,
  match,
} from "./index.js"

describe("pipe", () => {
  describe("map", () => {
    test("maps the value if ok", () => {
      const r = map((v: number) => v * 3)(ok(2))
      expect(r).toEqual({ ok: true, value: 6 })
    })

    test("skips mapping if error", () => {
      const r = map((v: number) => v * 3)(error("e"))
      expect(r).toEqual({ ok: false, error: "e" })
    })
  })

  describe("flatMap", () => {
    test("flattens the result if ok", () => {
      const r = flatMap((v: number) => ok(v + 1))(ok(2))
      expect(r).toEqual({ ok: true, value: 3 })
    })

    test("skips callback if error", () => {
      const r = flatMap((v: number) => ok(v + 1))(error("e"))
      expect(r).toEqual({ ok: false, error: "e" })
    })

    test("handles promise results", async () => {
      const r = flatMap(async (v: number) => ok(v + 1))(ok(2))
      const res = await r
      expect(res).toEqual({ ok: true, value: 3 })
    })
  })

  describe("mapError", () => {
    test("maps the error if present", () => {
      const r = mapError((e: string) => `err:${e}`)(error("e"))
      expect(r).toEqual({ ok: false, error: "err:e" })
    })

    test("leaves ok result unchanged", () => {
      const r = mapError((e: string) => `err:${e}`)(ok(1))
      expect(r).toEqual({ ok: true, value: 1 })
    })
  })

  describe("flatMapError", () => {
    test("flattens error mapping", () => {
      const r = flatMapError((e: string) => error(`err:${e}`))(error("e"))
      expect(r).toEqual({ ok: false, error: "err:e" })
    })

    test("skips callback when ok", () => {
      const r = flatMapError((e: string) => error(`err:${e}`))(ok(1))
      expect(r).toEqual({ ok: true, value: 1 })
    })

    test("handles promise results", async () => {
      const r = flatMapError(async (e: string) => error(`err:${e}`))(error("e"))
      const res = await r
      expect(res).toEqual({ ok: false, error: "err:e" })
    })
  })

  describe("catchError", () => {
    test("converts error to ok", () => {
      const r = catchError((e: string) => `handled:${e}`)(error("e"))
      expect(r).toEqual({ ok: true, value: "handled:e" })
    })

    test("does nothing if ok", () => {
      const r = catchError((e: string) => `handled:${e}`)(ok(1))
      expect(r).toEqual({ ok: true, value: 1 })
    })
  })

  describe("tap", () => {
    test("calls callback if ok", () => {
      const spy = vi.fn()
      const r = tap(spy)(ok(2))
      expect(spy).toHaveBeenCalledWith(2)
      expect(r).toEqual({ ok: true, value: 2 })
    })

    test("does not call callback if error", () => {
      const spy = vi.fn()
      const r = tap(spy)(error("e"))
      expect(spy).not.toHaveBeenCalled()
      expect(r).toEqual({ ok: false, error: "e" })
    })
  })

  describe("tapError", () => {
    test("calls callback if error", () => {
      const spy = vi.fn()
      const r = tapError(spy)(error("e"))
      expect(spy).toHaveBeenCalledWith("e")
      expect(r).toEqual({ ok: false, error: "e" })
    })

    test("does not call callback if ok", () => {
      const spy = vi.fn()
      const r = tapError(spy)(ok(1))
      expect(spy).not.toHaveBeenCalled()
      expect(r).toEqual({ ok: true, value: 1 })
    })
  })

  describe("finally_", () => {
    test("calls callback and returns original", () => {
      const spy = vi.fn()
      const r1 = tapBoth(spy)(ok(1))
      const r2 = tapBoth(spy)(error("e"))
      expect(spy).toHaveBeenCalledTimes(2)
      expect(r1).toEqual({ ok: true, value: 1 })
      expect(r2).toEqual({ ok: false, error: "e" })
    })
  })

  describe("match", () => {
    test("returns onOk for ok value", () => {
      const r = match(
        (v: number) => v + 1,
        (e: string) => 0,
      )(ok(2))
      expect(r).toBe(3)
    })

    test("returns onError for error", () => {
      const r = match(
        (v: number) => v,
        (e: string) => `err:${e}`,
      )(error("e"))
      expect(r).toBe("err:e")
    })
  })
})
