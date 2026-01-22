import type { Repository } from '../types/repository.js';
import type { TextSearchOptions, TextSearchResult } from '../types/search.js';
export declare class TextSearchEngine {
    private timeout;
    constructor(timeout?: number);
    search(options: TextSearchOptions, repositories: Repository[]): Promise<TextSearchResult[]>;
    private searchInRepo;
    private buildRgArgs;
}
//# sourceMappingURL=text-search.d.ts.map