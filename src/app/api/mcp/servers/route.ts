/**
 * MCP Servers API Endpoints
 * 
 * Provides REST API for managing MCP servers.
 */

import { NextRequest } from 'next/server';
import {
  MCPServerManager,
  MCPConfigManager,
  MCPServerConfig,
} from '@/lib/mcp';
import logger from '@/lib/utils/logger';

/**
 * GET /api/mcp/servers
 * List all MCP servers
 */
export async function GET() {
  try {
    const configManager = MCPConfigManager.getInstance();
    const servers = await configManager.getServers();

    const serverManager = MCPServerManager.getInstance();
    const connections = await serverManager.getConnections();

    // Enrich server configs with connection status
    const enrichedServers = servers.map((server) => {
      const connection = connections.find((c) => c.config.id === server.id);
      return {
        ...server,
        status: connection?.status || 'disconnected',
        connectedAt: connection?.connectedAt,
        lastError: connection?.lastError,
        toolCount: connection?.tools?.length || 0,
      };
    });

    return Response.json(
      {
        success: true,
        servers: enrichedServers,
      },
      { status: 200 },
    );
  } catch (error: any) {
    logger.error(`Failed to list MCP servers: ${error.message}`);
    return Response.json(
      {
        success: false,
        message: 'Failed to list servers',
        error: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/mcp/servers
 * Add a new MCP server
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.id || !body.name || !body.url || !body.protocol) {
      return Response.json(
        {
          success: false,
          message: 'Missing required fields: id, name, url, protocol',
        },
        { status: 400 },
      );
    }

    const serverConfig: MCPServerConfig = {
      id: body.id,
      name: body.name,
      description: body.description,
      url: body.url,
      protocol: body.protocol,
      enabled: body.enabled !== undefined ? body.enabled : true,
      authConfig: body.authConfig,
      timeout: body.timeout,
      retries: body.retries,
      metadata: body.metadata,
    };

    // Add to config
    const configManager = MCPConfigManager.getInstance();
    await configManager.addServer(serverConfig);

    // Add to server manager if enabled
    if (serverConfig.enabled) {
      const serverManager = MCPServerManager.getInstance();
      await serverManager.addServer(serverConfig);
    }

    return Response.json(
      {
        success: true,
        message: 'Server added successfully',
        server: serverConfig,
      },
      { status: 201 },
    );
  } catch (error: any) {
    logger.error(`Failed to add MCP server: ${error.message}`);
    return Response.json(
      {
        success: false,
        message: 'Failed to add server',
        error: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/mcp/servers
 * Update an existing MCP server
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.id) {
      return Response.json(
        {
          success: false,
          message: 'Missing required field: id',
        },
        { status: 400 },
      );
    }

    const configManager = MCPConfigManager.getInstance();
    const serverManager = MCPServerManager.getInstance();

    // Update in config
    await configManager.updateServer(body.id, body);

    // Reload server if it exists in manager
    try {
      await serverManager.removeServer(body.id);
    } catch {
      // Server might not be loaded, that's ok
    }

    const updatedServer = await configManager.getServer(body.id);
    if (updatedServer && updatedServer.enabled) {
      await serverManager.addServer(updatedServer);
    }

    return Response.json(
      {
        success: true,
        message: 'Server updated successfully',
      },
      { status: 200 },
    );
  } catch (error: any) {
    logger.error(`Failed to update MCP server: ${error.message}`);
    return Response.json(
      {
        success: false,
        message: 'Failed to update server',
        error: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/mcp/servers
 * Remove an MCP server
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get('id');

    if (!serverId) {
      return Response.json(
        {
          success: false,
          message: 'Missing required parameter: id',
        },
        { status: 400 },
      );
    }

    const configManager = MCPConfigManager.getInstance();
    const serverManager = MCPServerManager.getInstance();

    // Remove from server manager
    try {
      await serverManager.removeServer(serverId);
    } catch {
      // Server might not be loaded, continue anyway
    }

    // Remove from config
    await configManager.removeServer(serverId);

    return Response.json(
      {
        success: true,
        message: 'Server removed successfully',
      },
      { status: 200 },
    );
  } catch (error: any) {
    logger.error(`Failed to remove MCP server: ${error.message}`);
    return Response.json(
      {
        success: false,
        message: 'Failed to remove server',
        error: error.message,
      },
      { status: 500 },
    );
  }
}
