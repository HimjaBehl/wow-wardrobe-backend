// agent.js

const { ChatOpenAI } = require("@langchain/openai");
const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const { Tool } = require("langchain/tools");
const { collection, query, where, getDocs } = require("firebase-admin/firestore");
const { db } = require("./firebase");
require("dotenv").config();

// Tool 1: Fetch user wardrobe
const getUserWardrobeTool = new Tool({
  name: "get_user_wardrobe",
  description: "Fetch wardrobe items from a user's closet by UID",
  func: async (uid) => {
    const q = query(collection(db, "wardrobe"), where("uid", "==", uid));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => doc.data());
    return JSON.stringify(items);
  }
});

// Tool 2: Fetch user preferences
const getUserPrefsTool = new Tool({
  name: "get_user_preferences",
  description: "Fetch style preferences like dislikes or favorite colors",
  func: async (uid) => {
    const docRef = db.collection("user_preferences").doc(uid);
    const docSnap = await docRef.get();
    return docSnap.exists ? JSON.stringify(docSnap.data()) : "{}";
  }
});

// OpenAI model setup
const model = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7
});

// Create and export the agent
const setupAgent = async () => {
  const agent = await initializeAgentExecutorWithOptions(
    [getUserWardrobeTool, getUserPrefsTool],
    model,
    {
      agentType: "openai-functions",
      verbose: true,
    }
  );
  return agent;
};

module.exports = setupAgent;
