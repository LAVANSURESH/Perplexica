/**
 * MCP (Model Context Protocol) Integration
 * 
 * Main entry point for MCP functionality.
 * Exports all MCP components and provides initialization.
 */

import MCPServerManager from './manager';
import MCPToolRegistry from './registry';
import MCPToolExecutor from './executor';
import MCPConfigManager from './config';
import logger from '../utils/logger';

export * from './types';
export { MCPServerManager, MCPToolRegistry, MCPToolExecutor, MCPConfigManager };

/**
 * Initialize the entire MCP system
 */
export async function initializeMCP(): Promise<void> {
  try {
    logger.info('Initializing MCP system');

    // Initialize config first
    const configManager = MCPConfigManager.getInstance();
    await configManager.initialize();

    const config = await configManager.getConfig();

    if (!config.enabled) {
      logger.info('MCP is disabled in configuration');
      return;
    }

    // Initialize managers in order
    const serverManager = MCPServerManager.getInstance();
    await serverManager.initialize();

    const toolRegistry = MCPToolRegistry.getInstance();
    await toolRegistry.initialize();

    // Add configured servers
    for (const serverConfig of config.servers) {
      if (serverConfig.enabled) {
        try {
          await serverManager.addServer(serverConfig);
        } catch (error: any) {
          logger.error(
            `Failed to add server ${serverConfig.name}: ${error.message}`,
          );
        }
      }
    }

    logger.info('MCP system initialized successfully');
  } catch (error: any) {
    logger.error(`Failed to initialize MCP system: ${error.message}`);
    throw error;
  }
}

/**
 * Shutdown the MCP system
 */
export async function shutdownMCP(): Promise<void> {
  try {
    logger.info('Shutting down MCP system');

    const serverManager = MCPServerManager.getInstance();
    await serverManager.shutdown();

    const toolRegistry = MCPToolRegistry.getInstance();
    await toolRegistry.clear();

    logger.info('MCP system shutdown complete');
  } catch (error: any) {
    logger.error(`Failed to shutdown MCP system: ${error.message}`);
    throw error;
  }
}

/**
 * Get MCP system status
 */
export async function getMCPStatus(): Promise<{
  enabled: boolean;
  servers: number;
  tools: number;
  healthy: boolean;
}> {
  const configManager = MCPConfigManager.getInstance();
  const config = await configManager.getConfig();

  if (!config.enabled) {
    return {
      enabled: false,
      servers: 0,
      tools: 0,
      healthy: false,
    };
  }

  const serverManager = MCPServerManager.getInstance();
  const connections = await serverManager.getConnections();

  const toolRegistry = MCPToolRegistry.getInstance();
  const tools = await toolRegistry.getAllTools();

  const healthChecks = await serverManager.healthCheck();
  const healthy = Array.from(healthChecks.values()).every((h) => h.healthy);

  return {
    enabled: true,
    servers: connections.length,
    tools: tools.length,
    healthy,
  };
}

export default {
  initializeMCP,
  shutdownMCP,
  getMCPStatus,
  MCPServerManager,
  MCPToolRegistry,
  MCPToolExecutor,
  MCPConfigManager,
};
