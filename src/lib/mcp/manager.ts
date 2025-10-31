/**
 * MCP Server Manager
 * 
 * Manages the lifecycle and connections to MCP servers.
 * Handles connection pooling, health checks, and server state management.
 */

import EventEmitter from 'events';
import {
  MCPServerConfig,
  MCPServerConnection,
  MCPServerStatus,
  MCPHealthCheck,
  MCPError,
  MCPErrorCode,
  MCPEventType,
  MCPEvent,
} from './types';
import logger from '../utils/logger';

/**
 * MCP Server Manager singleton
 * Manages all MCP server connections and their lifecycle
 */
class MCPServerManager extends EventEmitter {
  private static instance: MCPServerManager;
  private servers: Map<string, MCPServerConnection>;
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly HEALTH_CHECK_INTERVAL_MS = 60000; // 1 minute

  private constructor() {
    super();
    this.servers = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MCPServerManager {
    if (!MCPServerManager.instance) {
      MCPServerManager.instance = new MCPServerManager();
    }
    return MCPServerManager.instance;
  }

  /**
   * Initialize the server manager and start health checks
   */
  public async initialize(): Promise<void> {
    logger.info('Initializing MCP Server Manager');
    
    // Start periodic health checks
    this.startHealthChecks();
    
    this.emitEvent({
      type: MCPEventType.SERVER_CONNECTED,
      timestamp: new Date(),
      data: { message: 'MCP Server Manager initialized' },
    });
  }

  /**
   * Add a new MCP server
   */
  public async addServer(config: MCPServerConfig): Promise<void> {
    try {
      logger.info(`Adding MCP server: ${config.name} (${config.id})`);

      // Validate config
      this.validateServerConfig(config);

      // Check if server already exists
      if (this.servers.has(config.id)) {
        throw new MCPError(
          MCPErrorCode.SERVER_ERROR,
          `Server with id ${config.id} already exists`,
        );
      }

      // Create connection object
      const connection: MCPServerConnection = {
        config,
        status: 'disconnected',
      };

      // Store the server
      this.servers.set(config.id, connection);

      // Connect if enabled
      if (config.enabled) {
        await this.connectServer(config.id);
      }

      this.emitEvent({
        type: MCPEventType.SERVER_CONNECTED,
        timestamp: new Date(),
        serverId: config.id,
        data: { serverName: config.name },
      });
    } catch (error: any) {
      logger.error(`Failed to add MCP server ${config.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove an MCP server
   */
  public async removeServer(serverId: string): Promise<void> {
    try {
      logger.info(`Removing MCP server: ${serverId}`);

      const server = this.servers.get(serverId);
      if (!server) {
        throw new MCPError(
          MCPErrorCode.TOOL_NOT_FOUND,
          `Server with id ${serverId} not found`,
        );
      }

      // Disconnect if connected
      if (server.status === 'connected') {
        await this.disconnectServer(serverId);
      }

      // Remove from map
      this.servers.delete(serverId);

      this.emitEvent({
        type: MCPEventType.SERVER_DISCONNECTED,
        timestamp: new Date(),
        serverId,
        data: { serverName: server.config.name },
      });
    } catch (error: any) {
      logger.error(`Failed to remove MCP server ${serverId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a specific server connection
   */
  public async getServer(serverId: string): Promise<MCPServerConnection> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new MCPError(
        MCPErrorCode.TOOL_NOT_FOUND,
        `Server with id ${serverId} not found`,
      );
    }
    return server;
  }

  /**
   * List all registered servers
   */
  public async listServers(): Promise<MCPServerConfig[]> {
    return Array.from(this.servers.values()).map((conn) => conn.config);
  }

  /**
   * Get all server connections
   */
  public async getConnections(): Promise<MCPServerConnection[]> {
    return Array.from(this.servers.values());
  }

  /**
   * Connect to a specific server
   */
  private async connectServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new MCPError(
        MCPErrorCode.TOOL_NOT_FOUND,
        `Server with id ${serverId} not found`,
      );
    }

    try {
      logger.info(`Connecting to MCP server: ${server.config.name}`);
      server.status = 'connecting';

      // TODO: Implement actual connection logic based on protocol
      // This is a placeholder for the actual implementation
      switch (server.config.protocol) {
        case 'http':
          await this.connectHTTP(server);
          break;
        case 'websocket':
          await this.connectWebSocket(server);
          break;
        case 'stdio':
          await this.connectStdio(server);
          break;
        default:
          throw new MCPError(
            MCPErrorCode.CONNECTION_FAILED,
            `Unsupported protocol: ${server.config.protocol}`,
          );
      }

      server.status = 'connected';
      server.connectedAt = new Date();
      server.lastError = undefined;

      logger.info(`Successfully connected to MCP server: ${server.config.name}`);

      this.emitEvent({
        type: MCPEventType.SERVER_CONNECTED,
        timestamp: new Date(),
        serverId,
        data: { serverName: server.config.name },
      });
    } catch (error: any) {
      server.status = 'error';
      server.lastError = error.message;

      logger.error(
        `Failed to connect to MCP server ${server.config.name}: ${error.message}`,
      );

      this.emitEvent({
        type: MCPEventType.SERVER_ERROR,
        timestamp: new Date(),
        serverId,
        error: error.message,
      });

      throw new MCPError(
        MCPErrorCode.CONNECTION_FAILED,
        `Failed to connect to server ${server.config.name}: ${error.message}`,
      );
    }
  }

  /**
   * Disconnect from a specific server
   */
  private async disconnectServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new MCPError(
        MCPErrorCode.TOOL_NOT_FOUND,
        `Server with id ${serverId} not found`,
      );
    }

    try {
      logger.info(`Disconnecting from MCP server: ${server.config.name}`);

      // TODO: Implement actual disconnection logic
      // This is a placeholder

      server.status = 'disconnected';
      server.connectedAt = undefined;

      this.emitEvent({
        type: MCPEventType.SERVER_DISCONNECTED,
        timestamp: new Date(),
        serverId,
        data: { serverName: server.config.name },
      });
    } catch (error: any) {
      logger.error(
        `Failed to disconnect from MCP server ${server.config.name}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Perform health check on all servers
   */
  public async healthCheck(): Promise<Map<string, MCPHealthCheck>> {
    const results = new Map<string, MCPHealthCheck>();

    for (const [serverId, server] of this.servers.entries()) {
      const startTime = Date.now();
      let healthy = false;
      let errorMessage: string | undefined;

      try {
        // TODO: Implement actual health check logic
        // For now, just check if status is connected
        healthy = server.status === 'connected';
      } catch (error: any) {
        errorMessage = error.message;
      }

      const latencyMs = Date.now() - startTime;

      results.set(serverId, {
        serverId,
        serverName: server.config.name,
        status: server.status,
        healthy,
        latencyMs,
        lastCheck: new Date(),
        toolCount: server.tools?.length || 0,
        errorMessage,
      });
    }

    return results;
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error: any) {
        logger.error(`Health check failed: ${error.message}`);
      }
    }, this.HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Validate server configuration
   */
  private validateServerConfig(config: MCPServerConfig): void {
    if (!config.id || !config.name || !config.url || !config.protocol) {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        'Invalid server configuration: missing required fields',
      );
    }

    if (!['stdio', 'http', 'websocket'].includes(config.protocol)) {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        `Invalid protocol: ${config.protocol}`,
      );
    }
  }

  /**
   * Connect via HTTP
   */
  private async connectHTTP(server: MCPServerConnection): Promise<void> {
    // TODO: Implement HTTP connection
    // This is a placeholder for actual implementation
    logger.info(`Connecting to HTTP server: ${server.config.url}`);
  }

  /**
   * Connect via WebSocket
   */
  private async connectWebSocket(server: MCPServerConnection): Promise<void> {
    // TODO: Implement WebSocket connection
    // This is a placeholder for actual implementation
    logger.info(`Connecting to WebSocket server: ${server.config.url}`);
  }

  /**
   * Connect via stdio
   */
  private async connectStdio(server: MCPServerConnection): Promise<void> {
    // TODO: Implement stdio connection
    // This is a placeholder for actual implementation
    logger.info(`Connecting to stdio server: ${server.config.url}`);
  }

  /**
   * Emit MCP event
   */
  private emitEvent(event: MCPEvent): void {
    this.emit('mcpEvent', event);
  }

  /**
   * Shutdown the server manager
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down MCP Server Manager');

    // Stop health checks
    this.stopHealthChecks();

    // Disconnect all servers
    for (const [serverId, server] of this.servers.entries()) {
      if (server.status === 'connected') {
        await this.disconnectServer(serverId);
      }
    }

    // Clear servers
    this.servers.clear();

    logger.info('MCP Server Manager shutdown complete');
  }
}

export default MCPServerManager;
