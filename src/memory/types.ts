/**
 * Memory Module Types
 *
 * TypeScript types for the persistent memory system.
 * Extended with three-tier architecture and domain classification.
 */

/**
 * Observation types that can be recorded
 */
export type ObservationType =
  | 'state_change'    // Worker state transition
  | 'pr_event'        // PR created, merged, etc.
  | 'error'           // Error occurred
  | 'task_complete'   // Task completed
  | 'message_sent'    // Message sent to worker
  | 'pattern'         // Reusable pattern or convention learned
  | 'decision'        // Architectural or design decision made
  | 'handoff'         // Session handoff summary for continuity
  | 'custom';         // Custom observation

/**
 * Domain classification for observations
 * Enables domain-specific memory isolation
 */
export type ObservationDomain =
  | 'frontend'        // UI components, styling, client-side state
  | 'backend'         // API routes, business logic, services
  | 'database'        // Migrations, models, queries
  | 'auth'            // Authentication, authorization, sessions
  | 'testing'         // Unit tests, integration tests, e2e
  | 'devops'          // CI/CD, deployment, infrastructure
  | 'docs'            // Documentation, READMEs, guides
  | 'orchestrator'    // Orchestrator-level coordination patterns
  | 'shared';         // Project-wide facts all domains should know

/**
 * Memory tier for three-tier precedence model
 * Seed → User → Project (each tier can override previous)
 */
export type MemoryTier =
  | 'seed'            // Built-in defaults (read-only)
  | 'user'            // Cross-project user preferences
  | 'project';        // Project-specific learnings

/**
 * A session represents a single orchestrator run
 */
export interface Session {
  id: string;
  startedAt: string;
  endedAt: string | null;
  workerCount: number;
  summary: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Input for creating a new session
 */
export interface NewSession {
  id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * An observation is a captured event or piece of information
 */
export interface Observation {
  id: number;
  sessionId: string;
  workerId: string;
  type: ObservationType;
  domain: ObservationDomain | null;  // Domain classification (null for unclassified)
  tier: MemoryTier;                   // Which tier this observation belongs to
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Input for creating a new observation
 */
export interface NewObservation {
  sessionId: string;
  workerId: string;
  type: ObservationType;
  domain?: ObservationDomain;         // Optional domain classification
  tier?: MemoryTier;                  // Defaults to 'project'
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * A summary is a compressed version of session activity
 */
export interface Summary {
  id: number;
  sessionId: string;
  summary: string;
  createdAt: string;
}

/**
 * Input for creating a new summary
 */
export interface NewSummary {
  sessionId: string;
  summary: string;
}

/**
 * Filter options for querying observations
 */
export interface ObservationFilter {
  sessionId?: string;
  workerId?: string;
  type?: ObservationType;
  domain?: ObservationDomain;         // Filter by domain
  tier?: MemoryTier;                  // Filter by tier
  since?: string;
  limit?: number;
  offset?: number;
}

/**
 * Options for search queries
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  sessionId?: string;
  workerId?: string;
  type?: ObservationType;
  domain?: ObservationDomain;         // Filter by domain
  tier?: MemoryTier;                  // Filter by tier
  since?: string;
}

/**
 * A search result with relevance score
 */
export interface SearchResult {
  observation: Observation;
  rank: number;
  snippet: string;
}

/**
 * Memory service configuration
 * Supports three-tier architecture: seed → user → project
 */
export interface MemoryConfig {
  dataDir: string;
  dbPath?: string;
  tiers?: {
    seed?: string;      // Path to seed tier DB (read-only defaults)
    user?: string;      // Path to user tier DB (cross-project preferences)
    project?: string;   // Path to project tier DB (project-specific)
  };
}

/**
 * Database row types (internal)
 */
export interface SessionRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  worker_count: number;
  summary: string | null;
  metadata: string | null;
}

export interface ObservationRow {
  id: number;
  session_id: string;
  worker_id: string;
  type: string;
  domain: string | null;
  tier: string;
  content: string;
  metadata: string | null;
  created_at: string;
}

export interface SummaryRow {
  id: number;
  session_id: string;
  summary: string;
  created_at: string;
}

export interface FtsSearchRow extends ObservationRow {
  rank: number;
}
