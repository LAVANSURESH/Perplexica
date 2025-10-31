/**
 * MCP Status API Endpoint
 * 
 * Provides status information about the MCP system.
 */

import { getMCPStatus, MCPServerManager, MCPToolExecutor } from '@/lib/mcp';
import logger from '@/lib/utils/logger';

/**
 * GET /api/mcp/status
 * Get MCP system status
 */
export async function GET() {
  try {
    const status = await getMCPStatus();

    // Get detailed health checks
    const serverManager = MCPServerManager.getInstance();
    const healthChecks = await serverManager.healthCheck();

    // Get execution metrics
    const executor = MCPToolExecutor.getInstance();
    const metrics = executor.getMetrics();

    // Calculate aggregate metrics
    const totalExecutions = metrics.length;
    const successfulExecutions = metrics.filter((m) => m.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const averageExecutionTime =
      totalExecutions > 0
        ? metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) /
          totalExecutions
        : 0;

    return Response.json(
      {
        success: true,
        status: {
          ...status,
          healthChecks: Array.from(healthChecks.values()),
          metrics: {
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            successRate:
              totalExecutions > 0
                ? (successfulExecutions / totalExecutions) * 100
                : 0,
            averageExecutionTimeMs: averageExecutionTime,
          },
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    logger.error(`Failed to get MCP status: ${error.message}`);
    return Response.json(
      {
        success: false,
        message: 'Failed to get status',
        error: error.message,
      },
      { status: 500 },
    );
  }
}
