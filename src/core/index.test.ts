import { describe, expect, test, vi } from "vitest";
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
  Result as ResultLike,
} from "./index.js";

describe("core", () => {
  describe("ok", () => {
    test("creates an ok result", () => {
      const r = ok(5);
      expect(r).toEqual({ ok: true, value: 5 });
    });
  });

  describe("error", () => {
    test("creates an error result", () => {
      const e = error("err");
      expect(e).toEqual({ ok: false, error: "err" });
    });
  });

  describe("from", () => {
    test("returns a cloned result", () => {
      const r = from({ ok: true, value: 1 });
      expect(r).toEqual({ ok: true, value: 1 });
    });
  });

  describe("isResultLike", () => {
    test("detects result objects", () => {
      expect(isResultLike({ ok: true, value: 1 })).toBe(true);
      expect(isResultLike({ ok: false, error: "e" })).toBe(true);
      expect(isResultLike(null)).toBe(false);
      expect(isResultLike(undefined)).toBe(false);
      expect(isResultLike({})).toBe(false);
    });
  });

  describe("tryCatch", () => {
    test("returns ok when function succeeds", () => {
      const r = tryCatch(() => 2);
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error();
      expect(r.value).toBe(2);
    });

    test("returns error when function throws", () => {
      const err = new Error("boom");
      const r = tryCatch(() => {
        throw err;
      });
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error();
      expect(r.error).toBe(err);
    });
  });

  describe("all", () => {
    test("collects all ok values", () => {
      const r = all([ok(1), ok(2)]);
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error();
      expect(r.value).toEqual([1, 2]);
    });

    test("returns first error", () => {
      const err = error("e");
      const r = all([ok(1), err, ok(3)]);
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error();
      expect(r.error).toBe("e");
    });
  });

  describe("map", () => {
    test("maps the value if ok", () => {
      const r = map(ok(2), (v) => v * 3);
      expect(r).toEqual({ ok: true, value: 6 });
    });

    test("skips mapping if error", () => {
      const r = map(error("e"), (v: number) => v * 3);
      expect(r).toEqual({ ok: false, error: "e" });
    });
  });

  describe("flatMap", () => {
    test("flattens the result if ok", () => {
      const r = flatMap(ok(2), (v) => ok(v + 1)) as ResultLike<number, never>;
      expect(r).toEqual({ ok: true, value: 3 });
    });

    test("skips callback if error", () => {
      const r = flatMap(error("e"), () => ok(2));
      expect(r).toEqual({ ok: false, error: "e" });
    });

    test("handles promise results", async () => {
      const r = flatMap(ok(2), async (v) => ok(v + 1));
      const res = await r;
      expect(res).toEqual({ ok: true, value: 3 });
    });
  });

  describe("mapError", () => {
    test("maps the error if present", () => {
      const r = mapError(error("e"), (e) => `err:${e}`);
      expect(r).toEqual({ ok: false, error: "err:e" });
    });

    test("leaves ok result unchanged", () => {
      const r = mapError(ok(1), (e) => `err:${e}`);
      expect(r).toEqual({ ok: true, value: 1 });
    });
  });

  describe("flatMapError", () => {
    test("flattens error mapping", () => {
      const r = flatMapError(error("e"), (e) => error(`err:${e}`)) as ResultLike<never, string>;
      expect(r).toEqual({ ok: false, error: "err:e" });
    });

    test("skips callback when ok", () => {
      const r = flatMapError(ok(1), (e) => error(`err:${e}`));
      expect(r).toEqual({ ok: true, value: 1 });
    });

    test("handles promise results", async () => {
      const r = flatMapError(error("e"), async (e) => error(`err:${e}`));
      const res = await r;
      expect(res).toEqual({ ok: false, error: "err:e" });
    });
  });

  describe("catchError", () => {
    test("converts error to ok", () => {
      const r = catchError(error("e"), (e) => `handled:${e}`);
      expect(r).toEqual({ ok: true, value: "handled:e" });
    });

    test("does nothing if ok", () => {
      const r = catchError(ok(1), (e) => `handled:${e}`);
      expect(r).toEqual({ ok: true, value: 1 });
    });
  });

  describe("tap", () => {
    test("calls callback if ok", () => {
      const spy = vi.fn();
      const r = tap(ok(2), spy);
      expect(spy).toHaveBeenCalledWith(2);
      expect(r).toEqual({ ok: true, value: 2 });
    });

    test("does not call callback if error", () => {
      const spy = vi.fn();
      const r = tap(error("e"), spy);
      expect(spy).not.toHaveBeenCalled();
      expect(r).toEqual({ ok: false, error: "e" });
    });
  });

  describe("tapError", () => {
    test("calls callback if error", () => {
      const spy = vi.fn();
      const r = tapError(error("e"), spy);
      expect(spy).toHaveBeenCalledWith("e");
      expect(r).toEqual({ ok: false, error: "e" });
    });

    test("does not call callback if ok", () => {
      const spy = vi.fn();
      const r = tapError(ok(1), spy);
      expect(spy).not.toHaveBeenCalled();
      expect(r).toEqual({ ok: true, value: 1 });
    });
  });

  describe("finally_", () => {
    test("calls callback and returns original", () => {
      const spy = vi.fn();
      const r1 = tapBoth(ok(1), spy);
      const r2 = tapBoth(error("e"), spy);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(r1).toEqual({ ok: true, value: 1 });
      expect(r2).toEqual({ ok: false, error: "e" });
    });
  });

  describe("match", () => {
    test("returns onOk for ok value", () => {
      const r = match(ok(2), (v) => v + 1, (e) => 0);
      expect(r).toBe(3);
    });

    test("returns onError for error", () => {
      const r = match(error("e"), (v) => v, (e) => `err:${e}`);
      expect(r).toBe("err:e");
    });
  });
});
