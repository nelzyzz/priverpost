const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Tracking user states

// Load commands
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Main function to handle incoming messages
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await handleImage(senderId, imageUrl, pageAccessToken, sendMessage);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();
    await handleText(senderId, messageText, pageAccessToken, sendMessage);
  }
}

// Function to handle images
async function handleImage(senderId, imageUrl, pageAccessToken, sendMessage) {
  try {
    await sendMessage(senderId, { text: '' }, pageAccessToken);

    const imageAnalysis = await analyzeImageWithGemini(imageUrl);

    if (imageAnalysis) {
      await sendMessage(senderId, { text: 'What would you like me to do with this image?' }, pageAccessToken);
      userStates.set(senderId, { mode: 'image_action', imageAnalysis }); // Save analysis and switch to action mode
    } else {
      await sendMessage(senderId, { text: "I couldn't get a response about this image." }, pageAccessToken);
    }
  } catch (error) {
    console.error('Error analyzing image:', error);
    await sendMessage(senderId, { text: 'Error analyzing the image.' }, pageAccessToken);
  }
}

// Function to handle text
async function handleText(senderId, text, pageAccessToken, sendMessage) {
  const args = text.split(' ');
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);
  const userState = userStates.get(senderId);

  if (text.toLowerCase().startsWith("gemini generate")) {
    const prompt = text.replace("gemini generate", "").trim();
    await handleGeminiImageCommand(senderId, prompt, pageAccessToken);
  } else if (userState && userState.mode === 'image_action') {
    // The user has given a command about the image
    await handleImageAction(senderId, text, userState.imageAnalysis, pageAccessToken, sendMessage);
  } else if (command) {
    // Execute the command if found
    try {
      await command.execute(senderId, args, pageAccessToken, sendMessage);
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      await sendMessage(senderId, { text: `Error executing command ${commandName}.` }, pageAccessToken);
    }
  } else {
    // If no command is found and not in image mode
    const gpt4oCommand = commands.get('gpt4o');
    if (gpt4oCommand) {
      try {
        await gpt4oCommand.execute(senderId, [text], pageAccessToken, sendMessage);
      } catch (error) {
        console.error('Error with GPT-4o:', error);
        await sendMessage(senderId, { text: 'Error using GPT-4o.' }, pageAccessToken);
      }
    } else {
      await sendMessage(senderId, { text: "I couldn't process your request." }, pageAccessToken);
    }
  }
}

// Function to handle actions requested on the analyzed image
async function handleImageAction(senderId, userQuery, imageAnalysis, pageAccessToken, sendMessage) {
  try {
    // Use GPT-4o to process the image description and user request
    const gpt4oCommand = commands.get('gpt4o');
    if (gpt4oCommand) {
      const fullQuery = `Here is the image analysis: "${imageAnalysis}". The user wants: "${userQuery}".`;
      await gpt4oCommand.execute(senderId, [fullQuery], pageAccessToken, sendMessage);
    } else {
      await sendMessage(senderId, { text: "Error: GPT-4o is not available." }, pageAccessToken);
    }

    // After processing the action, switch back to general mode
    userStates.set(senderId, { mode: 'general_discussion' });
  } catch (error) {
    console.error('Error handling image action:', error);
    await sendMessage(senderId, { text: 'Error processing your request.' }, pageAccessToken);
  }
}

// Function to call Gemini API to generate an image
async function generateImage(prompt) {
  const geminiImageApiEndpoint = 'https://joshweb.click/gemini';

  try {
    const { data } = await axios.get(`${geminiImageApiEndpoint}?prompt=${encodeURIComponent(prompt)}&style=3`);
    return data.url;
  } catch (error) {
    console.error('Error generating image with Gemini:', error);
    throw new Error('Error generating the image');
  }
}

// Function to handle Gemini image generation command
async function handleGeminiImageCommand(senderId, prompt, pageAccessToken) {
  try {
    // Indicate that the image is being generated
    await sendMessage(senderId, { text: '💬 *Gemini is generating an image* ⏳...\n\n─────★─────' }, pageAccessToken);

    // Generate the image URL using the Gemini API
    const imageUrl = await generateImage(prompt);

    // Send the image directly using the URL without downloading it locally
    await sendMessage(senderId, {
      attachment: {
        type: 'image',
        payload: {
          url: imageUrl,
          is_reusable: true
        }
      }
    }, pageAccessToken);
  } catch (error) {
    console.error('Error generating the image:', error);
    await sendMessage(senderId, { text: 'Sorry, an error occurred while generating the image.' }, pageAccessToken);
  }
}

// Function to call Gemini API to analyze an image
async function analyzeImageWithGemini(imageUrl) {
  const geminiApiEndpoint = 'https://joshweb.click/gemini'; 

  try {
    const response = await axios.get(`${geminiApiEndpoint}?url=${encodeURIComponent(imageUrl)}`);
    return response.data && response.data.answer ? response.data.answer : '';
  } catch (error) {
    console.error('Error with Gemini:', error);
    throw new Error('Error analyzing with Gemini');
  }
}

module.exports = { handleMessage };
