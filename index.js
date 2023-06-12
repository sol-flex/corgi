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


const app = express();
app.use(cors());

require('dotenv').config();


mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
.then(() => {
    console.log('Connected to MongoDB');
})
.catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});

app.use(express.json());

app.use(express.static(path.join(__dirname, '/public'), { 
    setHeaders: (res, filePath) => {
      const mimeType = mime.getType(filePath);
      console.log("Filepath: ", filePath)
      console.log("Mimetype: ", mimeType)
      if (mimeType === 'text/css') {
        res.type('text/css');
      } else if (mimeType === 'application/javascript') {
        res.type('application/javascript');
      }
    },
  }));

app.post('/conversations', async (req, res) => {
    try {
        console.log(req.body)
      const { role, content, newChat } = req.body;


      const conversation = new Conversation({
        // Set any initial properties for the conversation
        // (e.g., participants, topic, etc.)
        conversationCounter: 0,
        messages: [{role, content}],
      });
  
      // Save the new conversation
      await conversation.save();

      console.log(conversation._id)

      if(newChat) {
        return res.status(200).json({conversationId: conversation._id})
      }

      const apiUrl = 'https://api.openai.com/v1/chat/completions';
      const API_KEY = process.env.OPENAI_API

      console.log()

      let requestData = {
          model: "gpt-3.5-turbo",
          messages: conversation.messages.slice(-4).map(({ role, content }) => ({ role, content })),
          max_tokens: 1000,
          temperature: 0.5,
          n: 1
      };

      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`, 
        },
        body: JSON.stringify(requestData),
      })
        .then(response => response.json())
        .then(async responseData => {

          console.log("response data: ", responseData);

          if(responseData.error) {
            console.log("Error: ", responseData.error.message)
            return res.status(500).json({ error: responseData.error });

          } else {
            conversation.messages.push({ role: "assistant", content: responseData.choices[0].message.content });
            await conversation.save();
            return res.status(200).json({conversationId: conversation._id, chatGPTResponse: responseData})
          }

        })
        .catch(error => {
          console.error("This is the error: ", error);
        });

    } catch {
        console.error('Error saving message:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }

  });

app.post('/conversations/:conversationId', async (req, res) => {
    const { conversationId } = req.params;
    const { role, content } = req.body;

    console.log(conversationId)

    try {
        const conversation = await Conversation.findOne({ _id: conversationId });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        conversation.messages.push({ role, content });
        await conversation.save();

        const apiUrl = 'https://api.openai.com/v1/chat/completions';
        const API_KEY = process.env.OPENAI_API 
  
        let requestData = {
            model: "gpt-3.5-turbo",
            messages: conversation.messages.slice(-4).map(({ role, content }) => ({ role, content })),
            max_tokens: 1000,
            temperature: 0.5,
            n: 1
        };
  
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`, 
          },
          body: JSON.stringify(requestData),
        })
          .then(response => response.json())
          .then(async responseData => {
  
            console.log("response data: ", responseData);
  
            if(responseData.error) {
              console.log("Error: ", responseData.error.message)
              return res.status(500).json({ error: responseData.error });
  
            } else {

              conversation.messages.push({ role: "assistant", content: responseData.choices[0].message.content });
              await conversation.save();
              return res.status(200).json({chatGPTResponse: responseData})
              
            }
  
          })
          .catch(error => {
            console.error("This is the error: ", error);
          });
  
    } catch (error) {
        console.error('Error saving message:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/conversations/:conversationId', async (req, res) => {
    const { conversationId } = req.params;
    const { role, content } = req.body;

    console.log(conversationId)

    try {
        const conversation = await Conversation.findOne({ _id: conversationId });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        return res.status(200).sendFile(path.join(__dirname, "public", "conversation.html"));
    } catch (error) {
        console.error('Error saving message:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/conversations/:conversationId/data', async (req, res) => {
    const { conversationId } = req.params;
    const { role, content } = req.body;

    console.log(conversationId)

    try {
        const conversation = await Conversation.findOne({ _id: conversationId });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        return res.status(200).json(conversation);
    } catch (error) {
        console.error('Error saving message:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/query', async (req, res) => {
  try {
  } catch (error) {
  }
});

// helper function

app.listen(process.env.PORT || 5001, () => {
  console.log(`Listening on ${process.env.BASE_URL}`);
});
