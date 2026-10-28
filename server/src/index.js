import app from './app.js';
import { config } from './config/env.js';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 ResolveAI Backend Server running on port ${PORT}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🤖 Gemini AI: ${config.geminiApiKey ? 'Configured' : 'Disabled (Key missing - graceful fallback active)'}`);
  console.log(`⏱️  Default SLA: ${config.slaHours} hours`);
  console.log(`📁 Database: ${config.databasePath}`);
  console.log(`===============================================`);
});
