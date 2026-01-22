import type { Repository } from '../types/repository.js';
import type { SymbolSearchOptions, SymbolResult } from '../types/symbols.js';
export declare class SymbolSearchEngine {
    search(options: SymbolSearchOptions, repositories: Repository[]): Promise<SymbolResult[]>;
    private searchInRepo;
    private searchInFile;
    private matchesName;
    /**
     * Check if a symbol is exported using pre-split lines array
     */
    private isExportedFromLines;
    private extractSignature;
    private getExtensionsForLanguage;
}
//# sourceMappingURL=symbol-search.d.ts.map