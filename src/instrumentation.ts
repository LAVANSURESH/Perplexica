export const register = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      console.log('Running database migrations...');
      await import('./lib/db/migrate');
      console.log('Database migrations completed successfully');
    } catch (error) {
      console.error('Failed to run database migrations:', error);
    }

    await import('./lib/config/index');

    // Initialize MCP system
    try {
      console.log('Initializing MCP system...');
      const { initializeMCP } = await import('./lib/mcp');
      await initializeMCP();
      console.log('MCP system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MCP system:', error);
      // Don't fail the app if MCP initialization fails
    }
  }
};
