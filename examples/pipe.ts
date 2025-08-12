import * as Result from '@jaydenfyi/tinyresult/core';

const validatedUsername = Result.pipe(
	Result.ok('zuck' as const),
	Result.flatMap((username) => {
		if (username.length === 0) {
			return Result.error('EMPTY_USERNAME' as const);
		}

		if (username.length < 2) {
			return Result.error('USERNAME_TOO_SHORT' as const);
		}

		return Result.ok(username);
	}),
	Result.flatMap(async (username) => {
		return Result.ok(username);
	}),
	Result.flatMap((username) =>
		Result.ok(`Username is valid: ${username}` as const),
	),
);
