import * as Result from "../src/pipe/index.js";
import { pipe } from "effect";

import * as AsyncResult from "../src/core/resultAsync.js"

const asyncValidatedUsername = await AsyncResult.match(
    AsyncResult.flatMap(
        AsyncResult.ok("Alice" as const),
        (username) => {
            if (username.toString() === "Bob") {
                return Promise.resolve(AsyncResult.error("Bob is not allowed"));
            }
            return Promise.resolve(AsyncResult.ok(username));
        }
    ),
    (username) => `Username is valid: ${username}` as const,
    (error) => `Error: ${error}` as const,
);