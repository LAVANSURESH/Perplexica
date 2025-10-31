/**
 * MCP (Model Context Protocol) Type Definitions
 * 
 * This file contains all TypeScript types and interfaces for the MCP integration.
 */

export type MCPProtocol = 'stdio' | 'http' | 'websocket';
export type MCPAuthType = 'bearer' | 'apiKey' | 'oauth' | 'none';
export type MCPServerStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
export type MCPToolCategory = 'search' | 'computation' | 'data' | 'api' | 'utility' | 'custom';

/**
 * Authentication configuration for MCP servers
 */
export interface MCPAuthConfig {
  type: MCPAuthType;
  credentials?: {
    apiKey?: string;
    bearer?: string;
    clientId?: string;
    clientSecret?: string;
    [key: string]: string | undefined;
  };
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  url: string;
  protocol: MCPProtocol;
  enabled: boolean;
  authConfig?: MCPAuthConfig;
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
}

/**
 * MCP Server connection state
 */
export interface MCPServerConnection {
  config: MCPServerConfig;
  status: MCPServerStatus;
  connectedAt?: Date;
  lastError?: string;
  tools?: MCPTool[];
}

/**
 * JSON Schema for tool input/output validation
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: any;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  id: string;
  serverId: string;
  serverName: string;
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  category?: MCPToolCategory;
  tags?: string[];
  examples?: Array<{
    input: Record<string, any>;
    output?: any;
    description?: string;
  }>;
  metadata?: Record<string, any>;
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  timeout?: number;
  retries?: number;
  validateInput?: boolean;
  validateOutput?: boolean;
  context?: Record<string, any>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  toolId: string;
  toolName: string;
  success: boolean;
  output?: any;
  error?: string;
  executionTimeMs?: number;
  metadata?: Record<string, any>;
}

/**
 * Batch execution request
 */
export interface BatchExecutionRequest {
  toolId: string;
  input: Record<string, any>;
  options?: ToolExecutionOptions;
}

/**
 * Tool search filters
 */
export interface ToolFilters {
  serverId?: string;
  category?: MCPToolCategory;
  tags?: string[];
  searchQuery?: string;
}

/**
 * MCP Configuration for the entire system
 */
export interface MCPConfiguration {
  enabled: boolean;
  servers: MCPServerConfig[];
  defaultTimeout: number;
  maxConcurrentExecutions: number;
  enableToolCaching: boolean;
  cacheTimeout?: number;
  rateLimits?: {
    perServer?: number;
    perUser?: number;
    perTool?: number;
  };
}

/**
 * MCP Server health check result
 */
export interface MCPHealthCheck {
  serverId: string;
  serverName: string;
  status: MCPServerStatus;
  healthy: boolean;
  latencyMs?: number;
  lastCheck: Date;
  toolCount?: number;
  errorMessage?: string;
}

/**
 * MCP Tool usage metrics
 */
export interface MCPToolMetrics {
  toolId: string;
  toolName: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageExecutionTimeMs: number;
  lastExecuted?: Date;
}

/**
 * MCP Server metrics
 */
export interface MCPServerMetrics {
  serverId: string;
  serverName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageLatencyMs: number;
  uptime?: number;
  toolMetrics: MCPToolMetrics[];
}

/**
 * Agent context for tool execution
 */
export interface AgentToolContext {
  conversationId?: string;
  userId?: string;
  query: string;
  chatHistory?: Array<{ role: string; content: string }>;
  focusMode?: string;
  selectedTools?: string[];
}

/**
 * Tool selection criteria
 */
export interface ToolSelectionCriteria {
  query: string;
  context?: AgentToolContext;
  maxTools?: number;
  preferredCategories?: MCPToolCategory[];
  excludeTools?: string[];
}

/**
 * Tool recommendation
 */
export interface ToolRecommendation {
  tool: MCPTool;
  relevanceScore: number;
  reasoning?: string;
  suggestedInput?: Record<string, any>;
}

/**
 * MCP Error types
 */
export enum MCPErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  EXECUTION_TIMEOUT = 'EXECUTION_TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVER_ERROR = 'SERVER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * MCP Error class
 */
export class MCPError extends Error {
  constructor(
    public code: MCPErrorCode,
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

/**
 * MCP Event types for monitoring
 */
export enum MCPEventType {
  SERVER_CONNECTED = 'SERVER_CONNECTED',
  SERVER_DISCONNECTED = 'SERVER_DISCONNECTED',
  SERVER_ERROR = 'SERVER_ERROR',
  TOOL_DISCOVERED = 'TOOL_DISCOVERED',
  TOOL_EXECUTED = 'TOOL_EXECUTED',
  TOOL_FAILED = 'TOOL_FAILED',
  CACHE_HIT = 'CACHE_HIT',
  CACHE_MISS = 'CACHE_MISS',
}

/**
 * MCP Event
 */
export interface MCPEvent {
  type: MCPEventType;
  timestamp: Date;
  serverId?: string;
  toolId?: string;
  data?: any;
  error?: string;
}
