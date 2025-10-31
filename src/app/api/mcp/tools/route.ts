/**
 * MCP Tools API Endpoints
 * 
 * Provides REST API for discovering and executing MCP tools.
 */

import { NextRequest } from 'next/server';
import {
  MCPToolRegistry,
  MCPToolExecutor,
  ToolFilters,
} from '@/lib/mcp';
import logger from '@/lib/utils/logger';

/**
 * GET /api/mcp/tools
 * List and search MCP tools
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const query = searchParams.get('query') || '';
    const serverId = searchParams.get('serverId') || undefined;
    const category = searchParams.get('category') || undefined;
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || undefined;

    const filters: ToolFilters = {
      serverId,
      category: category as any,
      tags,
      searchQuery: query,
    };

    const registry = MCPToolRegistry.getInstance();
    const tools = await registry.searchTools(query, filters);

    return Response.json(
      {
        success: true,
        tools,
        count: tools.length,
      },
      { status: 200 },
    );
  } catch (error: any) {
    logger.error(`Failed to list MCP tools: ${error.message}`);
    return Response.json(
      {
        success: false,
        message: 'Failed to list tools',
        error: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/mcp/tools/execute
 * Execute an MCP tool
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.toolId) {
      return Response.json(
        {
          success: false,
          message: 'Missing required field: toolId',
        },
        { status: 400 },
      );
    }

    const executor = MCPToolExecutor.getInstance();
    const result = await executor.execute(
      body.toolId,
      body.input || {},
      {
        timeout: body.timeout,
        retries: body.retries,
        validateInput: body.validateInput,
        validateOutput: body.validateOutput,
        context: body.context,
      },
    );

    if (!result.success) {
      return Response.json(
        {
          success: false,
          message: 'Tool execution failed',
          error: result.error,
          result,
        },
        { status: 500 },
      );
    }

    return Response.json(
      {
        success: true,
        result,
      },
      { status: 200 },
    );
  } catch (error: any) {
    logger.error(`Failed to execute MCP tool: ${error.message}`);
    return Response.json(
      {
        success: false,
        message: 'Failed to execute tool',
        error: error.message,
      },
      { status: 500 },
    );
  }
}
