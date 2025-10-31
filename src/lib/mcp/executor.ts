/**
 * MCP Tool Executor
 * 
 * Executes MCP tools with validation, error handling, and monitoring.
 */

import {
  ToolExecutionOptions,
  ToolExecutionResult,
  BatchExecutionRequest,
  MCPError,
  MCPErrorCode,
  MCPEventType,
  MCPEvent,
  MCPTool,
} from './types';
import MCPToolRegistry from './registry';
import MCPServerManager from './manager';
import logger from '../utils/logger';
import EventEmitter from 'events';

/**
 * Execution metrics
 */
interface ExecutionMetrics {
  toolId: string;
  executionTimeMs: number;
  success: boolean;
  timestamp: Date;
}

/**
 * Rate limiter
 */
class RateLimiter {
  private requests: Map<string, number[]>;
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.requests = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canExecute(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const recentRequests = requests.filter((time) => now - time < this.windowMs);
    this.requests.set(key, recentRequests);

    return recentRequests.length < this.maxRequests;
  }

  recordRequest(key: string): void {
    const requests = this.requests.get(key) || [];
    requests.push(Date.now());
    this.requests.set(key, requests);
  }
}

/**
 * MCP Tool Executor singleton
 * Executes tools from MCP servers with validation and monitoring
 */
class MCPToolExecutor extends EventEmitter {
  private static instance: MCPToolExecutor;
  private registry: MCPToolRegistry;
  private serverManager: MCPServerManager;
  private rateLimiter: RateLimiter;
  private metrics: ExecutionMetrics[];
  private readonly MAX_METRICS = 1000;
  private readonly DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
  private readonly DEFAULT_RETRIES = 2;

  private constructor() {
    super();
    this.registry = MCPToolRegistry.getInstance();
    this.serverManager = MCPServerManager.getInstance();
    this.rateLimiter = new RateLimiter();
    this.metrics = [];
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MCPToolExecutor {
    if (!MCPToolExecutor.instance) {
      MCPToolExecutor.instance = new MCPToolExecutor();
    }
    return MCPToolExecutor.instance;
  }

  /**
   * Execute a single tool
   */
  public async execute(
    toolId: string,
    input: Record<string, any>,
    options?: ToolExecutionOptions,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const timeout = options?.timeout || this.DEFAULT_TIMEOUT_MS;
    const retries = options?.retries || this.DEFAULT_RETRIES;

    try {
      // Get tool from registry
      const tool = await this.registry.getTool(toolId);
      if (!tool) {
        throw new MCPError(
          MCPErrorCode.TOOL_NOT_FOUND,
          `Tool with id ${toolId} not found`,
        );
      }

      // Check rate limit
      if (!this.rateLimiter.canExecute(toolId)) {
        throw new MCPError(
          MCPErrorCode.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded for tool ${tool.name}`,
        );
      }

      // Validate input if requested
      if (options?.validateInput !== false) {
        this.validateInput(tool, input);
      }

      // Get server connection
      const server = await this.serverManager.getServer(tool.serverId);
      if (server.status !== 'connected') {
        throw new MCPError(
          MCPErrorCode.CONNECTION_FAILED,
          `Server ${tool.serverName} is not connected`,
        );
      }

      // Execute with retries
      let lastError: Error | undefined;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const result = await this.executeWithTimeout(
            tool,
            input,
            timeout,
            options?.context,
          );

          // Validate output if requested
          if (options?.validateOutput && tool.outputSchema) {
            this.validateOutput(tool, result);
          }

          // Record success
          this.rateLimiter.recordRequest(toolId);
          const executionTimeMs = Date.now() - startTime;
          this.recordMetric(toolId, executionTimeMs, true);

          this.emitEvent({
            type: MCPEventType.TOOL_EXECUTED,
            timestamp: new Date(),
            toolId,
            data: { executionTimeMs, success: true },
          });

          return {
            toolId,
            toolName: tool.name,
            success: true,
            output: result,
            executionTimeMs,
          };
        } catch (error: any) {
          lastError = error;
          if (attempt < retries) {
            logger.warn(
              `Tool execution failed (attempt ${attempt + 1}/${retries + 1}): ${error.message}`,
            );
            await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
          }
        }
      }

      // All retries failed
      throw lastError;
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      this.recordMetric(toolId, executionTimeMs, false);

      logger.error(`Tool execution failed: ${error.message}`);

      this.emitEvent({
        type: MCPEventType.TOOL_FAILED,
        timestamp: new Date(),
        toolId,
        error: error.message,
      });

      return {
        toolId,
        toolName: toolId,
        success: false,
        error: error.message,
        executionTimeMs,
      };
    }
  }

  /**
   * Execute multiple tools in batch
   */
  public async batchExecute(
    requests: BatchExecutionRequest[],
  ): Promise<ToolExecutionResult[]> {
    logger.info(`Executing batch of ${requests.length} tools`);

    // Execute all tools in parallel
    const results = await Promise.all(
      requests.map((req) => this.execute(req.toolId, req.input, req.options)),
    );

    return results;
  }

  /**
   * Execute tool with timeout
   */
  private async executeWithTimeout(
    tool: MCPTool,
    input: Record<string, any>,
    timeoutMs: number,
    context?: Record<string, any>,
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new MCPError(
            MCPErrorCode.EXECUTION_TIMEOUT,
            `Tool execution timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      try {
        // TODO: Implement actual tool execution via MCP protocol
        // This is a placeholder for the actual implementation
        const result = await this.invokeTool(tool, input, context);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Invoke tool via MCP protocol (placeholder)
   */
  private async invokeTool(
    tool: MCPTool,
    input: Record<string, any>,
    context?: Record<string, any>,
  ): Promise<any> {
    // This is a placeholder for actual MCP protocol communication
    // In a real implementation, this would make the actual call to the MCP server
    // using the appropriate protocol (HTTP, WebSocket, stdio)
    
    logger.info(`Invoking tool ${tool.name} with input:`, input);
    
    // Simulate async operation
    await this.delay(100);
    
    // Return mock result
    return {
      status: 'success',
      message: `Mock execution of ${tool.name}`,
      input,
    };
  }

  /**
   * Validate tool input against schema
   */
  private validateInput(tool: MCPTool, input: Record<string, any>): void {
    const schema = tool.inputSchema;

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in input)) {
          throw new MCPError(
            MCPErrorCode.INVALID_INPUT,
            `Missing required field: ${field}`,
          );
        }
      }
    }

    // Basic type checking
    if (schema.properties) {
      for (const [key, value] of Object.entries(input)) {
        if (schema.properties[key]) {
          const expectedType = schema.properties[key].type;
          const actualType = typeof value;

          // Simple type validation
          if (expectedType === 'string' && actualType !== 'string') {
            throw new MCPError(
              MCPErrorCode.INVALID_INPUT,
              `Invalid type for field ${key}: expected string, got ${actualType}`,
            );
          }
          if (expectedType === 'number' && actualType !== 'number') {
            throw new MCPError(
              MCPErrorCode.INVALID_INPUT,
              `Invalid type for field ${key}: expected number, got ${actualType}`,
            );
          }
          if (expectedType === 'boolean' && actualType !== 'boolean') {
            throw new MCPError(
              MCPErrorCode.INVALID_INPUT,
              `Invalid type for field ${key}: expected boolean, got ${actualType}`,
            );
          }
        }
      }
    }
  }

  /**
   * Validate tool output against schema
   */
  private validateOutput(tool: MCPTool, output: any): void {
    if (!tool.outputSchema) {
      return;
    }

    // Basic validation
    // TODO: Implement more comprehensive validation
    if (tool.outputSchema.type === 'object' && typeof output !== 'object') {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        'Invalid output type: expected object',
      );
    }
  }

  /**
   * Record execution metrics
   */
  private recordMetric(
    toolId: string,
    executionTimeMs: number,
    success: boolean,
  ): void {
    const metric: ExecutionMetrics = {
      toolId,
      executionTimeMs,
      success,
      timestamp: new Date(),
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.shift();
    }
  }

  /**
   * Get execution metrics
   */
  public getMetrics(): ExecutionMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get metrics for a specific tool
   */
  public getToolMetrics(toolId: string): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTimeMs: number;
  } {
    const toolMetrics = this.metrics.filter((m) => m.toolId === toolId);

    if (toolMetrics.length === 0) {
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTimeMs: 0,
      };
    }

    const successfulExecutions = toolMetrics.filter((m) => m.success).length;
    const failedExecutions = toolMetrics.length - successfulExecutions;
    const averageExecutionTimeMs =
      toolMetrics.reduce((sum, m) => sum + m.executionTimeMs, 0) /
      toolMetrics.length;

    return {
      totalExecutions: toolMetrics.length,
      successfulExecutions,
      failedExecutions,
      averageExecutionTimeMs,
    };
  }

  /**
   * Clear metrics
   */
  public clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Emit MCP event
   */
  private emitEvent(event: MCPEvent): void {
    this.emit('mcpEvent', event);
  }
}

export default MCPToolExecutor;
