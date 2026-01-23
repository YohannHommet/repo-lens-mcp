import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { isSubPath, normalizePath, safeOpenFile } from './path-utils.js';

// Mock fs and path modules
vi.mock('fs');
vi.mock('fs/promises');
vi.mock('path', async () => {
    const actual = await vi.importActual('path');
    return {
        ...actual,
        resolve: vi.fn((...args) => args.join('/')), // Simple resolve mock
        relative: vi.fn((from, to) => {
            if (to.startsWith(from)) {
                return to.slice(from.length + 1);
            }
            return '../' + to; // Simplified logic
        }),
        isAbsolute: vi.fn((p) => p.startsWith('/')),
    };
});

describe('Path Utils', () => {
    describe('normalizePath', () => {
        it('should resolve path', () => {
            const result = normalizePath('/foo/bar');
            expect(result).toBeDefined();
        });
    });

    describe('isSubPath', () => {
        beforeEach(() => {
            // Setup default mocks
            vi.mocked(fs.realpathSync).mockImplementation((p) => p as string);
            vi.mocked(path.resolve).mockImplementation((...args) => args.join('/'));
            vi.mocked(path.relative).mockImplementation((from, to) => {
                if (to.startsWith(from)) {
                    const rel = to.slice(from.length);
                    return rel.startsWith('/') ? rel.slice(1) : rel;
                }
                return '../' + to;
            });
        });

        it('should return true for child path', () => {
            const parent = '/data';
            const child = '/data/file.txt';
            expect(isSubPath(parent, child)).toBe(true);
        });

        it('should return false for parent path', () => {
            const parent = '/data/subdir';
            const child = '/data';
            expect(isSubPath(parent, child)).toBe(false);
        });

        it('should return false for path traversal', () => {
            const parent = '/data';
            const child = '/data/../etc/passwd';

            // Mock realpath to simulate resolution
            vi.mocked(fs.realpathSync).mockImplementation((p) => {
                if (p === '/data/../etc/passwd') return '/etc/passwd';
                return p as string;
            });

            expect(isSubPath(parent, child)).toBe(false);
        });

        it('should resolve symlinks', () => {
            const parent = '/data';
            const child = '/data/link';

            // Symlink points outside
            vi.mocked(fs.realpathSync).mockImplementation((p) => {
                if (p === '/data/link') return '/etc/passwd';
                return p as string;
            });

            expect(isSubPath(parent, child)).toBe(false);
        });
    });

    describe('safeOpenFile', () => {
        const mockFileHandle = {
            fd: 123,
            close: vi.fn(),
            readFile: vi.fn(),
        };

        beforeEach(() => {
            vi.mocked(fsPromises.open).mockResolvedValue(mockFileHandle as any);
            vi.mocked(fs.constants).O_RDONLY = 0;
            vi.mocked(fs.constants).O_NOFOLLOW = 0x20000;
        });

        it('should open valid file', async () => {
            // Mock realpathSync for Linux /proc check
            vi.mocked(fs.realpathSync).mockImplementation((p) => {
                if (typeof p === 'string' && p.includes('/proc/self/fd/')) return '/data/file.txt';
                return p as string;
            });

            // Mock isSubPath behavior (simplified since we mocked utils entirely? No, we mocked sub-dependencies)
            // Wait, we are testing the REAL isSubPath logic which uses fs.realpathSync

            await safeOpenFile('/data/file.txt', '/data');
            expect(fsPromises.open).toHaveBeenCalledWith('/data/file.txt', expect.any(Number));
        });

        it('should throw if file is outside allowed dir', async () => {
            // Ensure isSubPath returns false
            vi.mocked(fs.realpathSync).mockImplementation((p) => p as string);

            await expect(safeOpenFile('/etc/passwd', '/data'))
                .rejects.toThrow('File is not within allowed directory');
        });

        it('should throw on symlink error (ELOOP/EMLINK)', async () => {
            // Ensure isSubPath passes initially
            vi.mocked(fs.realpathSync).mockImplementation((p) => p as string);

            vi.mocked(fsPromises.open).mockRejectedValue({ code: 'ELOOP' });

            await expect(safeOpenFile('/data/link', '/data'))
                .rejects.toThrow('File is a symbolic link');
        });
    });
});
