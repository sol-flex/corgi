const express = require('express');
const passport = require('passport');
const session = require('express-session');
const { MongoClient } = require('mongodb');
const mongoose = require("mongoose");
const path = require('path');
const Conversation = require('./conversation');
const User = require('./user')
const axios = require('axios');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const mime = require('mime');
const cors = require('cors');
const LocalStrategy = require('passport-local');
const crypto = require('crypto');

passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  console.log("Email/password: ", email, password)
  try {
    const user = await User.findOne({ email });
    console.log("user: ", user)
    if (!user) {
      return done(null, false, { message: 'User not found. Please sign up first.' });
    }
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return done(null, false, { message: 'Incorrect password' });
    }
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    cb(null, { id: user._id, email: user.email });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

const app = express();
app.use(cors());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Initialize Passport and session
app.use(passport.initialize());
app.use(passport.session());

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


app.post('/conversations', async (req, res) => {
    try {
        console.log(req.body)
      const { role, content, newChat } = req.body;

      console.log("user: ", req.user)


      const conversation = new Conversation({
        // Set any initial properties for the conversation
        // (e.g., participants, topic, etc.)
        conversationCounter: 0,
        messages: [{role, content}],
      });
  
      // Save the new conversation
      await conversation.save();

      console.log(conversation._id)

      if(req.user) {

        const updatedUser = await User.findByIdAndUpdate(
          req.user.id,
          { $addToSet: { conversations: conversation._id } },
          { new: true }
        );
  
        console.log("Updated user: ", updatedUser)
      }

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

    } catch(error) {
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
        if (req.user && req.isAuthenticated()) {
          // Authenticated user, render the authenticated homepage
          return res.status(200).sendFile(path.join(__dirname, "public", "conversation_authenticated.html"));
        } else {
          return res.status(200).sendFile(path.join(__dirname, "public", "conversation.html"));

        }
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

app.post('/login/password', (req, res, next) => {
  console.log(req.user)
  if (req.user) {
    // User is already logged in
    return res.redirect('http://localhost:5001/index.html');
  }

  passport.authenticate('local', (err, user, info) => {

    if (err) {
      return next(err); // Forward the error to the error handler
    }

    if (!user) {
      if (info.message === 'Incorrect password') {
        // User authentication failed due to incorrect password
        return res.status(401).json({ message: info.message });
      } else {
        // User is not yet signed up
        return res.status(401).json({ message: 'User not found. Please sign up first.' });
      }
    }

    // User authentication successful, log in the user
    req.login(user, (err) => {
      if (err) {
        return next(err); // Forward the error to the error handler
      }

      return res.redirect('http://localhost:5001/index_authenticated.html');
    });
  })(req, res, next);
});


app.post('/signup', async (req, res, next) => {
  if (req.user) {
    // User is already logged in
    return res.redirect('http://localhost:5001/index.html');
  }
  const { email, password } = req.body;

  console.log("req body: ", req.body)

  try {
    // Check if the username is already taken
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(existingUser)
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Create a new user
    const newUser = new User({ email });



    // Set the password using the setPassword method
    await newUser.setPassword(password);

    // Save the user to the database
    await newUser.save();

    // Establish a session for the user
    req.login(newUser, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect('http://localhost:5001/index_authenticated.html');
    });
  } catch (error) {
    return res.status(500).json({ error: error });
  }
});

app.post('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('http://localhost:5001/index.html');
  });
});

app.get('/', (req, res) => {
  console.log("hit this endpoint")
  console.log(req.user)
  console.log(req.isAuthenticated())
  if (req.user && req.isAuthenticated()) {
    // Authenticated user, render the authenticated homepage
    res.sendFile(__dirname + '/public/index_authenticated.html');
  } else {
    // Unauthenticated user, render the unauthenticated homepage
    res.sendFile(__dirname + '/public/index.html');
  }
});

app.get('/data', (req, res) => {
  console.log("end point hit")
  User.findOne({ _id: req.user.id}, 'conversations') // Retrieve conversations from the first user found, adjust query as needed
    .then(user => {
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ conversations: user.conversations });
    })
    .catch(error => {
      console.error('Error retrieving conversations:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
});

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


// helper function

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    // User is authenticated, proceed to the next middleware or route handler
    return next();
  }

  // User is not authenticated, redirect to the login page
  res.redirect('/login');
};

app.listen(process.env.PORT || 5001, () => {
  console.log(`Listening on ${process.env.BASE_URL}`);
});
