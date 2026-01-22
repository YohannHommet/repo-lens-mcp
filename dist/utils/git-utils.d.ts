export interface GitInfo {
    remote?: string;
    branch: string;
    lastCommit: string;
}
export declare function isGitRepository(path: string): Promise<boolean>;
export declare function getGitInfo(path: string): Promise<GitInfo>;
//# sourceMappingURL=git-utils.d.ts.map