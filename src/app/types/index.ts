export * from './device-manager';
export * from './file-session';
export * from './device';

export interface AsyncResult<T, E = Error> {
    result?: T;
    error?: E;
}
