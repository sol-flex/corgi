const express = require('express');
const passport = require('passport');
const session = require('express-session');
const { MongoClient } = require('mongodb');
const mongoose = require("mongoose");
const path = require('path');
const Conversation = require('./conversation');
const axios = require('axios');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const mime = require('mime');
const cors = require('cors');
const { OpenAI } = require("langchain/llms/openai")
const { ConversationSummaryMemory } = require("langchain/memory");
const { LLMChain } = require("langchain/chains");
const { PromptTemplate } = require("langchain/prompts");

require('dotenv').config();

const model = new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY, temperature: 0.5 });

const memory = new ConversationSummaryMemory({
    memoryKey: "chat_history",
    llm: new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY, modelName: "gpt-3.5-turbo", temperature: 0 }),
  });

  const prompt =
    PromptTemplate.fromTemplate(`The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

  Current conversation:
  {chat_history}
  Human: {input}
  AI:`);
  const chain = new LLMChain({ llm: model, prompt, memory });

 async function call() {
    const res1 = await chain.call({ input: "Show me a javascript promise" });
    console.log({ res1, memory: await memory.loadMemoryVariables({}) });

    call2();
}

async function call2() {
    const res2 = await chain.call({ input: "how would i accomplish the same thing in python?" });
    console.log({ res2, memory: await memory.loadMemoryVariables({}) });
}

call();