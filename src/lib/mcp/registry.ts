/**
 * MCP Tool Registry
 * 
 * Discovers, registers, and manages available tools from MCP servers.
 * Provides search and filtering capabilities for tools.
 */

import {
  MCPTool,
  ToolFilters,
  MCPError,
  MCPErrorCode,
  MCPEventType,
  MCPEvent,
} from './types';
import MCPServerManager from './manager';
import logger from '../utils/logger';
import EventEmitter from 'events';

/**
 * Tool cache entry
 */
interface ToolCacheEntry {
  tool: MCPTool;
  cachedAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

/**
 * MCP Tool Registry singleton
 * Manages the registry of available tools from all MCP servers
 */
class MCPToolRegistry extends EventEmitter {
  private static instance: MCPToolRegistry;
  private tools: Map<string, ToolCacheEntry>;
  private serverManager: MCPServerManager;
  private readonly CACHE_TTL_MS = 300000; // 5 minutes

  private constructor() {
    super();
    this.tools = new Map();
    this.serverManager = MCPServerManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MCPToolRegistry {
    if (!MCPToolRegistry.instance) {
      MCPToolRegistry.instance = new MCPToolRegistry();
    }
    return MCPToolRegistry.instance;
  }

  /**
   * Initialize the tool registry
   */
  public async initialize(): Promise<void> {
    logger.info('Initializing MCP Tool Registry');
    
    // Discover tools from all servers
    await this.refreshRegistry();
    
    logger.info(`Tool registry initialized with ${this.tools.size} tools`);
  }

  /**
   * Discover tools from a specific MCP server
   */
  public async discoverTools(serverId: string): Promise<MCPTool[]> {
    try {
      logger.info(`Discovering tools from server: ${serverId}`);

      const server = await this.serverManager.getServer(serverId);

      if (server.status !== 'connected') {
        throw new MCPError(
          MCPErrorCode.CONNECTION_FAILED,
          `Server ${serverId} is not connected`,
        );
      }

      // TODO: Implement actual tool discovery via MCP protocol
      // This is a placeholder that returns mock tools for demonstration
      const discoveredTools = await this.fetchToolsFromServer(server.config.url);

      // Cache the tools
      for (const tool of discoveredTools) {
        const cacheEntry: ToolCacheEntry = {
          tool,
          cachedAt: new Date(),
          accessCount: 0,
          lastAccessed: new Date(),
        };
        this.tools.set(tool.id, cacheEntry);

        this.emitEvent({
          type: MCPEventType.TOOL_DISCOVERED,
          timestamp: new Date(),
          serverId,
          toolId: tool.id,
          data: { toolName: tool.name },
        });
      }

      // Update server connection with tools
      server.tools = discoveredTools;

      logger.info(
        `Discovered ${discoveredTools.length} tools from server ${serverId}`,
      );

      return discoveredTools;
    } catch (error: any) {
      logger.error(
        `Failed to discover tools from server ${serverId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get a specific tool by ID
   */
  public async getTool(toolId: string): Promise<MCPTool | null> {
    const entry = this.tools.get(toolId);

    if (!entry) {
      return null;
    }

    // Check if cache is stale
    if (this.isCacheStale(entry)) {
      // Refresh the tool
      await this.refreshTool(toolId);
      return this.tools.get(toolId)?.tool || null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = new Date();

    return entry.tool;
  }

  /**
   * Get all tools
   */
  public async getAllTools(): Promise<MCPTool[]> {
    return Array.from(this.tools.values()).map((entry) => entry.tool);
  }

  /**
   * Search tools with filters
   */
  public async searchTools(
    query: string = '',
    filters?: ToolFilters,
  ): Promise<MCPTool[]> {
    let results = Array.from(this.tools.values()).map((entry) => entry.tool);

    // Filter by server ID
    if (filters?.serverId) {
      results = results.filter((tool) => tool.serverId === filters.serverId);
    }

    // Filter by category
    if (filters?.category) {
      results = results.filter((tool) => tool.category === filters.category);
    }

    // Filter by tags
    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter((tool) =>
        filters.tags!.some((tag) => tool.tags?.includes(tag)),
      );
    }

    // Search in name and description
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(
        (tool) =>
          tool.name.toLowerCase().includes(lowerQuery) ||
          tool.description.toLowerCase().includes(lowerQuery) ||
          tool.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)),
      );
    }

    // Apply search query filter if provided
    if (filters?.searchQuery) {
      const lowerSearchQuery = filters.searchQuery.toLowerCase();
      results = results.filter(
        (tool) =>
          tool.name.toLowerCase().includes(lowerSearchQuery) ||
          tool.description.toLowerCase().includes(lowerSearchQuery),
      );
    }

    return results;
  }

  /**
   * Refresh the entire registry
   */
  public async refreshRegistry(): Promise<void> {
    try {
      logger.info('Refreshing tool registry');

      const servers = await this.serverManager.listServers();
      const enabledServers = servers.filter((s) => s.enabled);

      // Discover tools from all enabled servers
      await Promise.all(
        enabledServers.map((server) => this.discoverTools(server.id)),
      );

      // Clean up stale tools
      this.cleanupStaleTools();

      logger.info(`Tool registry refreshed with ${this.tools.size} tools`);
    } catch (error: any) {
      logger.error(`Failed to refresh tool registry: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh a specific tool
   */
  private async refreshTool(toolId: string): Promise<void> {
    const entry = this.tools.get(toolId);
    if (!entry) {
      return;
    }

    try {
      // Re-discover the tool from its server
      await this.discoverTools(entry.tool.serverId);
    } catch (error: any) {
      logger.error(`Failed to refresh tool ${toolId}: ${error.message}`);
    }
  }

  /**
   * Get tools by server ID
   */
  public async getToolsByServer(serverId: string): Promise<MCPTool[]> {
    return Array.from(this.tools.values())
      .filter((entry) => entry.tool.serverId === serverId)
      .map((entry) => entry.tool);
  }

  /**
   * Get tools by category
   */
  public async getToolsByCategory(category: string): Promise<MCPTool[]> {
    return Array.from(this.tools.values())
      .filter((entry) => entry.tool.category === category)
      .map((entry) => entry.tool);
  }

  /**
   * Remove tools from a specific server
   */
  public async removeServerTools(serverId: string): Promise<void> {
    const toolsToRemove: string[] = [];

    for (const [toolId, entry] of this.tools.entries()) {
      if (entry.tool.serverId === serverId) {
        toolsToRemove.push(toolId);
      }
    }

    for (const toolId of toolsToRemove) {
      this.tools.delete(toolId);
    }

    logger.info(`Removed ${toolsToRemove.length} tools from server ${serverId}`);
  }

  /**
   * Get tool statistics
   */
  public async getToolStats(): Promise<{
    totalTools: number;
    toolsByServer: Map<string, number>;
    toolsByCategory: Map<string, number>;
    mostAccessedTools: Array<{ tool: MCPTool; accessCount: number }>;
  }> {
    const toolsByServer = new Map<string, number>();
    const toolsByCategory = new Map<string, number>();
    const accessedTools: Array<{ tool: MCPTool; accessCount: number }> = [];

    for (const entry of this.tools.values()) {
      // Count by server
      const serverCount = toolsByServer.get(entry.tool.serverId) || 0;
      toolsByServer.set(entry.tool.serverId, serverCount + 1);

      // Count by category
      if (entry.tool.category) {
        const categoryCount = toolsByCategory.get(entry.tool.category) || 0;
        toolsByCategory.set(entry.tool.category, categoryCount + 1);
      }

      // Track accessed tools
      if (entry.accessCount > 0) {
        accessedTools.push({
          tool: entry.tool,
          accessCount: entry.accessCount,
        });
      }
    }

    // Sort most accessed tools
    accessedTools.sort((a, b) => b.accessCount - a.accessCount);

    return {
      totalTools: this.tools.size,
      toolsByServer,
      toolsByCategory,
      mostAccessedTools: accessedTools.slice(0, 10),
    };
  }

  /**
   * Check if cache entry is stale
   */
  private isCacheStale(entry: ToolCacheEntry): boolean {
    const now = Date.now();
    const cacheAge = now - entry.cachedAt.getTime();
    return cacheAge > this.CACHE_TTL_MS;
  }

  /**
   * Clean up stale tools from cache
   */
  private cleanupStaleTools(): void {
    const now = Date.now();
    const toolsToRemove: string[] = [];

    for (const [toolId, entry] of this.tools.entries()) {
      const cacheAge = now - entry.cachedAt.getTime();
      const lastAccessAge = now - entry.lastAccessed.getTime();

      // Remove if stale and not accessed recently
      if (cacheAge > this.CACHE_TTL_MS * 2 && lastAccessAge > this.CACHE_TTL_MS) {
        toolsToRemove.push(toolId);
      }
    }

    for (const toolId of toolsToRemove) {
      this.tools.delete(toolId);
    }

    if (toolsToRemove.length > 0) {
      logger.info(`Cleaned up ${toolsToRemove.length} stale tools from cache`);
    }
  }

  /**
   * Fetch tools from server (placeholder)
   * TODO: Implement actual MCP protocol communication
   */
  private async fetchToolsFromServer(serverUrl: string): Promise<MCPTool[]> {
    // This is a placeholder that returns empty array
    // In actual implementation, this would make MCP protocol calls
    // to discover available tools from the server
    return [];
  }

  /**
   * Emit MCP event
   */
  private emitEvent(event: MCPEvent): void {
    this.emit('mcpEvent', event);
  }

  /**
   * Clear the entire registry
   */
  public async clear(): Promise<void> {
    this.tools.clear();
    logger.info('Tool registry cleared');
  }
}

export default MCPToolRegistry;
