/**
 * MCP Configuration Manager
 * 
 * Manages MCP system configuration including servers, timeouts, and settings.
 */

import {
  MCPConfiguration,
  MCPServerConfig,
  MCPError,
  MCPErrorCode,
} from './types';
import logger from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

/**
 * Default MCP configuration
 */
const DEFAULT_CONFIG: MCPConfiguration = {
  enabled: false,
  servers: [],
  defaultTimeout: 30000,
  maxConcurrentExecutions: 10,
  enableToolCaching: true,
  cacheTimeout: 300000, // 5 minutes
  rateLimits: {
    perServer: 100,
    perUser: 1000,
    perTool: 50,
  },
};

/**
 * MCP Configuration Manager singleton
 */
class MCPConfigManager {
  private static instance: MCPConfigManager;
  private config: MCPConfiguration;
  private configPath: string;
  private initialized: boolean = false;

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.configPath = path.join(
      process.cwd(),
      'data',
      'mcp-config.json',
    );
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MCPConfigManager {
    if (!MCPConfigManager.instance) {
      MCPConfigManager.instance = new MCPConfigManager();
    }
    return MCPConfigManager.instance;
  }

  /**
   * Initialize the configuration manager
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing MCP Configuration Manager');

      // Try to load existing config
      await this.loadConfig();

      this.initialized = true;
      logger.info('MCP Configuration Manager initialized');
    } catch (error: any) {
      logger.warn(
        `Failed to load MCP config, using defaults: ${error.message}`,
      );
      this.initialized = true;
    }
  }

  /**
   * Get current configuration
   */
  public async getConfig(): Promise<MCPConfiguration> {
    if (!this.initialized) {
      await this.initialize();
    }
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public async updateConfig(
    updates: Partial<MCPConfiguration>,
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('Updating MCP configuration');

    // Merge updates with current config
    this.config = {
      ...this.config,
      ...updates,
    };

    // Validate the updated config
    this.validateConfig(this.config);

    // Save to file
    await this.saveConfig();

    logger.info('MCP configuration updated successfully');
  }

  /**
   * Add a new MCP server
   */
  public async addServer(server: MCPServerConfig): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info(`Adding MCP server: ${server.name}`);

    // Validate server config
    this.validateServerConfig(server);

    // Check if server already exists
    if (this.config.servers.some((s) => s.id === server.id)) {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        `Server with id ${server.id} already exists`,
      );
    }

    // Add server to config
    this.config.servers.push(server);

    // Save config
    await this.saveConfig();

    logger.info(`MCP server ${server.name} added successfully`);
  }

  /**
   * Update an existing MCP server
   */
  public async updateServer(
    serverId: string,
    updates: Partial<MCPServerConfig>,
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info(`Updating MCP server: ${serverId}`);

    const serverIndex = this.config.servers.findIndex(
      (s) => s.id === serverId,
    );

    if (serverIndex === -1) {
      throw new MCPError(
        MCPErrorCode.TOOL_NOT_FOUND,
        `Server with id ${serverId} not found`,
      );
    }

    // Merge updates
    const updatedServer = {
      ...this.config.servers[serverIndex],
      ...updates,
    };

    // Validate updated server
    this.validateServerConfig(updatedServer);

    // Update in config
    this.config.servers[serverIndex] = updatedServer;

    // Save config
    await this.saveConfig();

    logger.info(`MCP server ${serverId} updated successfully`);
  }

  /**
   * Remove an MCP server
   */
  public async removeServer(serverId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info(`Removing MCP server: ${serverId}`);

    const serverIndex = this.config.servers.findIndex(
      (s) => s.id === serverId,
    );

    if (serverIndex === -1) {
      throw new MCPError(
        MCPErrorCode.TOOL_NOT_FOUND,
        `Server with id ${serverId} not found`,
      );
    }

    // Remove from config
    this.config.servers.splice(serverIndex, 1);

    // Save config
    await this.saveConfig();

    logger.info(`MCP server ${serverId} removed successfully`);
  }

  /**
   * Get a specific server configuration
   */
  public async getServer(serverId: string): Promise<MCPServerConfig | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.config.servers.find((s) => s.id === serverId) || null;
  }

  /**
   * Get all servers
   */
  public async getServers(): Promise<MCPServerConfig[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return [...this.config.servers];
  }

  /**
   * Enable/disable MCP
   */
  public async setEnabled(enabled: boolean): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info(`${enabled ? 'Enabling' : 'Disabling'} MCP`);

    this.config.enabled = enabled;
    await this.saveConfig();

    logger.info(`MCP ${enabled ? 'enabled' : 'disabled'} successfully`);
  }

  /**
   * Load configuration from file
   */
  private async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const loaded = JSON.parse(data);

      // Validate loaded config
      this.validateConfig(loaded);

      this.config = loaded;
      logger.info('MCP configuration loaded from file');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.info('No existing MCP config found, using defaults');
        await this.saveConfig();
      } else {
        throw error;
      }
    }
  }

  /**
   * Save configuration to file
   */
  private async saveConfig(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });

      // Write config
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8',
      );

      logger.info('MCP configuration saved to file');
    } catch (error: any) {
      logger.error(`Failed to save MCP config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: MCPConfiguration): void {
    if (typeof config.enabled !== 'boolean') {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        'Invalid config: enabled must be a boolean',
      );
    }

    if (!Array.isArray(config.servers)) {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        'Invalid config: servers must be an array',
      );
    }

    if (
      typeof config.defaultTimeout !== 'number' ||
      config.defaultTimeout <= 0
    ) {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        'Invalid config: defaultTimeout must be a positive number',
      );
    }

    if (
      typeof config.maxConcurrentExecutions !== 'number' ||
      config.maxConcurrentExecutions <= 0
    ) {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        'Invalid config: maxConcurrentExecutions must be a positive number',
      );
    }

    // Validate each server
    for (const server of config.servers) {
      this.validateServerConfig(server);
    }
  }

  /**
   * Validate server configuration
   */
  private validateServerConfig(server: MCPServerConfig): void {
    if (!server.id || typeof server.id !== 'string') {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        'Invalid server config: id is required and must be a string',
      );
    }

    if (!server.name || typeof server.name !== 'string') {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        'Invalid server config: name is required and must be a string',
      );
    }

    if (!server.url || typeof server.url !== 'string') {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        'Invalid server config: url is required and must be a string',
      );
    }

    if (!['stdio', 'http', 'websocket'].includes(server.protocol)) {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        `Invalid server config: protocol must be one of: stdio, http, websocket`,
      );
    }

    if (typeof server.enabled !== 'boolean') {
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        'Invalid server config: enabled must be a boolean',
      );
    }
  }

  /**
   * Reset configuration to defaults
   */
  public async resetToDefaults(): Promise<void> {
    logger.info('Resetting MCP configuration to defaults');

    this.config = { ...DEFAULT_CONFIG };
    await this.saveConfig();

    logger.info('MCP configuration reset to defaults');
  }

  /**
   * Export configuration
   */
  public async exportConfig(): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration
   */
  public async importConfig(configJson: string): Promise<void> {
    try {
      const imported = JSON.parse(configJson);
      this.validateConfig(imported);

      this.config = imported;
      await this.saveConfig();

      logger.info('MCP configuration imported successfully');
    } catch (error: any) {
      logger.error(`Failed to import MCP config: ${error.message}`);
      throw new MCPError(
        MCPErrorCode.VALIDATION_ERROR,
        `Invalid configuration: ${error.message}`,
      );
    }
  }
}

export default MCPConfigManager;
