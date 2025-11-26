/**
 * Deep readonly utility type that makes all nested properties readonly.
 */
export type DeepReadonly<T> = {
	readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
