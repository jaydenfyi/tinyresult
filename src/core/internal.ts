// Implementation courtesy of Effect's `dual` implementation:
// https://github.com/Effect-TS/effect

/**
 * Dual-call helper for data-first and data-last usage (supports arity 2 or 3).
 */
export const dual: {
	<
		DataLast extends (...args: Array<any>) => any,
		DataFirst extends (...args: Array<any>) => any,
	>(
		arity: Parameters<DataFirst>['length'] & (2 | 3),
		body: DataFirst,
	): DataLast & DataFirst;
} = function (arity, body) {
	switch (arity) {
		case 2:
			return function (a: any, b: any) {
				if (arguments.length >= 2) return body(a, b);
				return function (self: any) {
					return body(self, a);
				};
			} as any;

		case 3:
			return function (a: any, b: any, c: any) {
				if (arguments.length >= 3) return body(a, b, c);
				return function (self: any) {
					return body(self, a, b);
				};
			} as any;
	}
};

export const isPromiseLike = (v: unknown): v is PromiseLike<unknown> =>
	!!v && typeof (v as any).then === 'function';
