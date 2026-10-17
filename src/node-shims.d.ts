declare const process: any;
declare const console: any;
declare module 'node:fs/promises' { export const access: any; export const cp: any; export const mkdir: any; export const readFile: any; export const rename: any; export const rm: any; export const writeFile: any; }
declare module 'node:path' { export const dirname: any; export const join: any; export const resolve: any; }
declare module 'node:url' { export const fileURLToPath: any; }
declare module 'node:os' { export const homedir: any; }
