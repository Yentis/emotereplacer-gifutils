declare module 'memoizeasync' {
  // eslint-disable-next-line no-unused-vars
  export type Callback = (error: Error | null, path?: string) => unknown;

  // eslint-disable-next-line no-unused-vars
  const memoize: (func: (callback: Callback) => unknown) => (callback: Callback) => unknown;
  export default memoize;
}
