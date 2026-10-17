declare const process: any;
declare const console: any;
declare module 'node:fs/promises' { export const access: any; export const cp: any; export const lstat: any; export const mkdir: any; export const mkdtemp: any; export const open: any; export const readFile: any; export const readdir: any; export const rename: any; export const rm: any; export const symlink: any; export const unlink: any; export const writeFile: any; }
declare module 'node:path' { export const dirname: any; export const join: any; export const relative: any; export const resolve: any; export const sep: any; }
declare module 'node:url' { export const fileURLToPath: any; }
declare module 'node:os' { export const homedir: any; export const tmpdir: any; }
declare module 'node:child_process' { export const execFile: any; }
declare module 'node:crypto' { export const createHash: any; export const randomUUID: any; }
declare module 'node:util' { export const promisify: any; }
