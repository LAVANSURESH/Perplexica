/**
 * MCP Search Agent
 * 
 * Extends the MetaSearchAgent to integrate MCP tools into search workflows.
 * Enables AI agents to leverage external tools via MCP protocol.
 */

import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import {
  RunnableLambda,
  RunnableSequence,
} from '@langchain/core/runnables';
import { BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import eventEmitter from 'events';
import MetaSearchAgent from '../search/metaSearchAgent';
import {
  MCPToolRegistry,
  MCPToolExecutor,
  MCPTool,
  ToolExecutionResult,
  ToolSelectionCriteria,
} from '../mcp';
import logger from '../utils/logger';

/**
 * MCP Search Agent
 * Enhances search with MCP tool capabilities
 */
class MCPSearchAgent extends MetaSearchAgent {
  private toolRegistry: MCPToolRegistry;
  private toolExecutor: MCPToolExecutor;

  constructor(config: any) {
    super(config);
    this.toolRegistry = MCPToolRegistry.getInstance();
    this.toolExecutor = MCPToolExecutor.getInstance();
  }

  /**
   * Enhanced search and answer with MCP tools
   */
  public async searchAndAnswer(
    message: string,
    history: BaseMessage[],
    llm: BaseChatModel,
    embeddings: Embeddings,
    optimizationMode: 'speed' | 'balanced' | 'quality',
    fileIds: string[],
    systemInstructions: string,
  ): Promise<eventEmitter> {
    const emitter = new eventEmitter();

    (async () => {
      try {
        // Discover available tools
        const availableTools = await this.getAvailableTools();

        if (availableTools.length === 0) {
          // No tools available, fall back to regular search
          logger.info('No MCP tools available, using standard search');
          const baseEmitter = await super.searchAndAnswer(
            message,
            history,
            llm,
            embeddings,
            optimizationMode,
            fileIds,
            systemInstructions,
          );

          // Forward events
          baseEmitter.on('data', (data) => emitter.emit('data', data));
          baseEmitter.on('end', () => emitter.emit('end'));
          baseEmitter.on('error', (error) => emitter.emit('error', error));
          return;
        }

        // Emit available tools to the client
        emitter.emit(
          'data',
          JSON.stringify({
            type: 'mcpTools',
            data: availableTools.map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              category: t.category,
            })),
          }),
        );

        // Determine if we should use tools for this query
        const shouldUseTools = await this.shouldUseToolsForQuery(
          message,
          history,
          llm,
        );

        if (!shouldUseTools) {
          logger.info('Query does not require MCP tools, using standard search');
          const baseEmitter = await super.searchAndAnswer(
            message,
            history,
            llm,
            embeddings,
            optimizationMode,
            fileIds,
            systemInstructions,
          );

          // Forward events
          baseEmitter.on('data', (data) => emitter.emit('data', data));
          baseEmitter.on('end', () => emitter.emit('end'));
          baseEmitter.on('error', (error) => emitter.emit('error', error));
          return;
        }

        // Select appropriate tools
        const selectedTools = await this.selectToolsForQuery(
          message,
          availableTools,
          llm,
        );

        if (selectedTools.length === 0) {
          logger.info('No suitable tools found for query');
          const baseEmitter = await super.searchAndAnswer(
            message,
            history,
            llm,
            embeddings,
            optimizationMode,
            fileIds,
            systemInstructions,
          );

          // Forward events
          baseEmitter.on('data', (data) => emitter.emit('data', data));
          baseEmitter.on('end', () => emitter.emit('end'));
          baseEmitter.on('error', (error) => emitter.emit('error', error));
          return;
        }

        // Emit selected tools
        emitter.emit(
          'data',
          JSON.stringify({
            type: 'mcpToolsSelected',
            data: selectedTools.map((t) => ({
              id: t.id,
              name: t.name,
            })),
          }),
        );

        // Execute tools
        const toolResults = await this.executeTools(
          selectedTools,
          message,
          history,
          llm,
        );

        // Emit tool results
        emitter.emit(
          'data',
          JSON.stringify({
            type: 'mcpToolResults',
            data: toolResults,
          }),
        );

        // Combine tool results with web search if needed
        const baseEmitter = await super.searchAndAnswer(
          message,
          history,
          llm,
          embeddings,
          optimizationMode,
          fileIds,
          this.buildEnhancedSystemInstructions(
            systemInstructions,
            toolResults,
          ),
        );

        // Forward events
        baseEmitter.on('data', (data) => emitter.emit('data', data));
        baseEmitter.on('end', () => emitter.emit('end'));
        baseEmitter.on('error', (error) => emitter.emit('error', error));
      } catch (error: any) {
        logger.error(`MCP Search Agent error: ${error.message}`);
        emitter.emit('error', error);
      }
    })();

    return emitter;
  }

  /**
   * Get available MCP tools
   */
  private async getAvailableTools(): Promise<MCPTool[]> {
    try {
      return await this.toolRegistry.getAllTools();
    } catch (error: any) {
      logger.error(`Failed to get available tools: ${error.message}`);
      return [];
    }
  }

  /**
   * Determine if query should use MCP tools
   */
  private async shouldUseToolsForQuery(
    query: string,
    history: BaseMessage[],
    llm: BaseChatModel,
  ): Promise<boolean> {
    try {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are an AI assistant that determines if a query would benefit from using external tools.
          
          Analyze the query and conversation history to determine if external tools would be helpful.
          
          External tools can:
          - Perform calculations
          - Access APIs and external data sources
          - Execute specialized operations
          - Retrieve structured information
          
          Respond with ONLY "YES" or "NO".`,
        ],
        new MessagesPlaceholder('chat_history'),
        ['user', '{query}'],
      ]);

      const chain = RunnableSequence.from([
        prompt,
        llm,
        new StringOutputParser(),
      ]);

      const result = await chain.invoke({
        query,
        chat_history: history,
      });

      return result.trim().toUpperCase() === 'YES';
    } catch (error: any) {
      logger.error(`Failed to determine tool usage: ${error.message}`);
      return false;
    }
  }

  /**
   * Select appropriate tools for the query
   */
  private async selectToolsForQuery(
    query: string,
    availableTools: MCPTool[],
    llm: BaseChatModel,
  ): Promise<MCPTool[]> {
    try {
      const toolDescriptions = availableTools
        .map(
          (tool, idx) =>
            `${idx + 1}. ${tool.name} (${tool.category}): ${tool.description}`,
        )
        .join('\n');

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are an AI assistant that selects the most appropriate tools for a given query.
          
          Available tools:
          ${toolDescriptions}
          
          Select up to 3 most relevant tools for the query. Respond with the tool numbers (comma-separated).
          If no tools are suitable, respond with "NONE".
          
          Example: 1,3 or NONE`,
        ],
        ['user', '{query}'],
      ]);

      const chain = RunnableSequence.from([
        prompt,
        llm,
        new StringOutputParser(),
      ]);

      const result = await chain.invoke({ query });

      if (result.trim().toUpperCase() === 'NONE') {
        return [];
      }

      const selectedIndices = result
        .split(',')
        .map((s) => parseInt(s.trim()) - 1)
        .filter((i) => i >= 0 && i < availableTools.length);

      return selectedIndices.map((i) => availableTools[i]);
    } catch (error: any) {
      logger.error(`Failed to select tools: ${error.message}`);
      return [];
    }
  }

  /**
   * Execute selected tools
   */
  private async executeTools(
    tools: MCPTool[],
    query: string,
    history: BaseMessage[],
    llm: BaseChatModel,
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const tool of tools) {
      try {
        // Generate input for the tool based on query
        const input = await this.generateToolInput(tool, query, llm);

        // Execute the tool
        const result = await this.toolExecutor.execute(tool.id, input, {
          timeout: 30000,
          validateInput: true,
        });

        results.push(result);

        logger.info(
          `Executed tool ${tool.name}: ${result.success ? 'success' : 'failed'}`,
        );
      } catch (error: any) {
        logger.error(`Failed to execute tool ${tool.name}: ${error.message}`);
        results.push({
          toolId: tool.id,
          toolName: tool.name,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Generate tool input from query
   */
  private async generateToolInput(
    tool: MCPTool,
    query: string,
    llm: BaseChatModel,
  ): Promise<Record<string, any>> {
    try {
      const schemaDescription = JSON.stringify(tool.inputSchema, null, 2);

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are an AI assistant that generates input parameters for a tool based on a user query.
          
          Tool: ${tool.name}
          Description: ${tool.description}
          
          Input Schema:
          ${schemaDescription}
          
          Generate the input parameters as a JSON object. Respond with ONLY the JSON object, no explanation.`,
        ],
        ['user', '{query}'],
      ]);

      const chain = RunnableSequence.from([
        prompt,
        llm,
        new StringOutputParser(),
      ]);

      const result = await chain.invoke({ query });

      // Parse JSON
      const parsed = JSON.parse(result);
      return parsed;
    } catch (error: any) {
      logger.error(`Failed to generate tool input: ${error.message}`);
      return {};
    }
  }

  /**
   * Build enhanced system instructions with tool results
   */
  private buildEnhancedSystemInstructions(
    baseInstructions: string,
    toolResults: ToolExecutionResult[],
  ): string {
    const successfulResults = toolResults.filter((r) => r.success);

    if (successfulResults.length === 0) {
      return baseInstructions;
    }

    const resultsText = successfulResults
      .map(
        (r) =>
          `\n\nTool: ${r.toolName}\nResult: ${JSON.stringify(r.output, null, 2)}`,
      )
      .join('');

    return `${baseInstructions}

Additional context from external tools:${resultsText}

Use this tool-provided information along with web search results to provide a comprehensive answer.`;
  }
}

export default MCPSearchAgent;
