import type { Repository, RegisterOptions, RepositoryFilter } from '../types/repository.js';
export declare class RepositoryManager {
    private repositories;
    private configPath;
    constructor(configDir: string);
    register(path: string, options?: RegisterOptions): Promise<Repository>;
    unregister(identifier: string): Promise<void>;
    list(filter?: RepositoryFilter): Promise<Repository[]>;
    get(identifier: string): Promise<Repository | null>;
    refresh(identifier: string): Promise<Repository>;
    resolveIdentifier(identifier: string): Repository | null;
    resolveIdentifiers(identifiers?: string[]): Repository[];
    resolvePath(filePath: string): {
        repo: Repository;
        relativePath: string;
    } | null;
    save(): Promise<void>;
    load(): Promise<void>;
    private detectLanguages;
    private countFiles;
}
//# sourceMappingURL=repository-manager.d.ts.map