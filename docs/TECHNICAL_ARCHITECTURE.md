# 🏗️ Architecture Technique et Fondamentaux

Ce document décrit les choix techniques profonds, les algorithmes utilisés et l'architecture interne du `mcp-repo-search-server`. Il est destiné aux mainteneurs souhaitant comprendre le "comment" et le "pourquoi".

---

## 🧠 1. Les Moteurs de Recherche (Search Engines)

Le serveur ne se contente pas de chercher du texte. Il utilise une approche **hybride** combinant analyse syntaxique (AST) et recherche textuelle brute.

### A. Recherche Symbolique : AST (Abstract Syntax Tree)
Pour les outils `find_functions`, `find_classes`, etc., nous n'utilisons **pas** de Regex. Les Regex sont fragiles pour le code (elles confondent les commentaires et le code).

**Technologie** : [`ast-grep`](https://ast-grep.github.io/) (via `@ast-grep/napi`).
*   **Pourquoi ?** C'est un parseur écrit en Rust, extrêmement rapide, qui convertit le code en un arbre syntaxique.
*   **Fonctionnement** :
    1.  Le serveur lit le fichier.
    2.  `ast-grep` parse le code en un arbre (AST).
    3.  Nous interrogeons l'arbre avec des patterns structurels (ex: *"trouve-moi tous les nœuds de type `function_declaration` qui ont le nom X"*).
*   **Avantage** :
    *   Distingue `function foo()` de `// function foo()`.
    *   Comprend la portée (scope) et les exports (`export { foo }`).

### B. Recherche Textuelle : Ripgrep
Pour l'outil `search_text`, la performance brute est prioritaire sur la compréhension syntaxique.

**Technologie** : `ripgrep` (`rg`) via binaire embarqué (`@vscode/ripgrep`).
*   **Pourquoi ?** C'est l'outil de recherche le plus rapide du marché (écrit en Rust).
*   **Optimisation** :
    *   Utilise le parallélisme CPU automatiquement.
    *   Respecte nativement les fichiers `.gitignore` (ne cherche pas dans `node_modules`).
    *   Stream les résultats ligne par ligne pour ne pas surcharger la RAM Node.js.

---

## ⚡ 2. Le Système de Cache

Le système a deux niveaux de mémoire, l'un persistant (Config), l'autre éphémère (Cache).

### A. Le Cache de Recherche (RAM Éphémère)
*   **Implémentation** : `LRU Cache` (Least Recently Used) en mémoire vive.
*   **Durée de Vie (TTL)** : Court (défaut 5 minutes).
*   **Stratégie d'Invalidation "Agressive"** :
    *   Le code changeant constamment, un cache obsolète est pire que pas de cache.
    *   **Règle** : Si une opération de modification survient (`register`, `unregister`, `refresh`), **TOUT** le cache est vidé instantanément.
*   **Clés de Cache** : Hash déterministe basé sur *tous* les paramètres de recherche (pattern, repos inclus, options).

### B. La Configuration (Disque Persistant)
*   **Stockage** : Fichier `repositories.json` dans `~/.config/mcp-repo-search/`.
*   **Contenu** : Chemins des dépôts, dernière branche vue, stats.
*   **Comportement** : Chargé uniquement au démarrage. Jamais utilisé pour les résultats de recherche (qui scannent le disque réel).

---

## 🛡️ 3. Architecture et Sécurité

Le projet suit scrupuleusement les principes SOLID et une architecture "Black Box".

### A. Gestion des repositories (Refactoring Phase 5)
La classe monolithique `RepositoryManager` a été découpée pour respecter le Single Responsibility Principle (SRP) :

1.  **`ConfigStore`** : Ne fait QUE charger/sauvegarder le JSON. Ne connait pas Git.
2.  **`RepositoryScanner`** : Ne fait QUE analyser le disque (compter fichiers, lire infos Git). Ne connait pas la config.
3.  **`RepositoryManager`** : Le chef d'orchestre. Il utilise les deux autres pour répondre aux demandes de l'utilisateur.

### B. Sécurité "Paranoïaque" (`path-utils.ts`)
Puisque le serveur lit des fichiers sur l'ordinateur de l'utilisateur, la sécurité est critique.

1.  **Protection Traversée (`../../`)** :
    *   Chaque chemin est résolu via `realpathSync` pour obtenir son chemin physique réel.
    *   On vérifie (via `isSubPath`) que le chemin réel est bien *dans* le dossier du repository autorisé.

2.  **Protection Symlink (Lien Symbolique)** :
    *   Un attaquant pourrait créer un lien symbolique dans le projet pointant vers `/etc/passwd`.
    *   **Contre-mesure** : Ouverture des fichiers avec le flag `O_NOFOLLOW` au niveau du Kernel Linux/Unix. Si le fichier est un lien, l'ouverture échoue immédiatement.

---

## 🔄 4. Flux d'une Requête (Exemple: `find_functions`)

1.  **MCP Request** : Le client (Claude) envoie `call_tool("find_functions", { name: "auth" })`.
2.  **Cache Check** : Le serveur calcule le hash. Si présent en RAM → Retour immédiat.
3.  **Validation** : Zod valide les inputs.
4.  **Orchestration** :
    *   `RepositoryManager` fournit la liste des chemins autorisés.
5.  **Recherche (SymbolSearchEngine)** :
    *   Scan des fichiers (`fast-glob`) dans les repos.
    *   Pour chaque fichier : Détection langage -> Lecture -> Parsing AST -> Filtrage des nœuds.
    *   Extraction de la signature de la fonction.
6.  **Réponse** : Formatage JSON et mise en cache du résultat.

---

## 🛠️ 5. Stack Technique

*   **Runtime** : Node.js (TypeScript strict).
*   **Protocole** : [Model Context Protocol (MCP)](https://modelcontextprotocol.io).
*   **Libs Clés** :
    *   `zod` : Validation rigoureuse des entrées/sorties.
    *   `vitest` : Tests unitaires rapides.
    *   `simple-git` : Opérations Git basiques.
