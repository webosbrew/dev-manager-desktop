import {Buffer} from "buffer";

import type {BackendErrorBody} from "./backend-client";

/**
 * Lives here rather than in `remote-command.service.ts` because `backend-client.ts`
 * needs it too, and importing it from the service created a require cycle between
 * the two modules. `import type` above keeps this file free of a runtime edge back
 * to `backend-client`.
 */
export class ExecutionError extends Error {
    constructor(message: string, public status: number, public details: string, public command: string) {
        super(message);
    }

    static isCompatible(e: unknown): e is ExecutionError {
        if (!(e instanceof Error)) {
            return false;
        }
        const p = e as Partial<ExecutionError>;
        return typeof (p.status) === 'number' && p.details !== null;
    }

    static fromBackendError(e: BackendErrorBody): ExecutionError {
        const stderr = e['stderr'] as number[];
        const data = convertOutput(stderr, 'utf-8');
        const exitCode = e['exit_code'] as number;
        const command = e['command'] as string;
        return new ExecutionError(`Command \`${command}\` exited with code ${exitCode}`, exitCode, data, command);
    }
}

export function convertOutput(data: number[], format: 'buffer'): Buffer;
export function convertOutput(data: number[], format: 'utf-8'): string;

export function convertOutput(data: number[], format: 'buffer' | 'utf-8'): Buffer | string {
    const outputData = Buffer.from(data);
    switch (format) {
        case 'utf-8':
            return outputData.toString('utf-8');
        default:
            return outputData;
    }
}
