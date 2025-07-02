
// agent.js
const { ChatOpenAI } = require("@langchain/openai");
const { initializeAgentExecutorWithOptions } = require("langchain/agents");

let executor; // Cache the executor so we don't re-create it every call

async function setupAgent() {
  if (executor) return executor;

  const model = new ChatOpenAI({
    temperature: 0.7,
    modelName: "gpt-3.5-turbo",
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  executor = await initializeAgentExecutorWithOptions([], model, {
    agentType: "chat-zero-shot-react-description",
    verbose: true,
  });

  return executor;
}

module.exports = setupAgent;
