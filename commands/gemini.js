const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'gemini',
  description: 'Chat with Gemini or generate an image',
  author: 'vex_kshitiz',

  async execute(senderId, args, pageAccessToken, sendMessage, event = null) {
    const prompt = args.join(' ').trim();

    // Check if an image is directly attached in the message
    if (event?.attachments?.length > 0) {
      try {
        // If an image is attached, describe it automatically
        const photoUrl = event.attachments[0].url;
        const description = await describeImage(prompt || "Describe this image", photoUrl);
        const formattedResponse = `👩‍💻 | 𝙶𝚎𝚖𝚒𝚗𝚒 |\n━━━━━━━━━━━━━━━━\nDescription: ${description}\n━━━━━━━━━━━━━━━━`;
        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
      } catch (error) {
        console.error('Error while describing the image:', error);
        await sendMessage(senderId, { text: 'Sorry, an error occurred while describing the image.' }, pageAccessToken);
      }
      return;
    }

    if (!prompt) {
      return sendMessage(senderId, { text: "👩‍💻 | 𝙶𝚎𝚖𝚒𝚗𝚒 |\n━━━━━━━━━━━━━━━━\nPlease provide a prompt or send an image.\n━━━━━━━━━━━━━━━━" }, pageAccessToken);
    }

    try {
      if (args[0]?.toLowerCase() === "draw") {
        // Generate an image
        await sendMessage(senderId, { text: '💬 *Gemini is generating an image* ⏳...\n\n─────★─────' }, pageAccessToken);

        const imageUrl = await generateImage(prompt);

        // Download the generated image
        const imagePath = path.join(__dirname, 'cache', `image_${Date.now()}.png`);
        const writer = fs.createWriteStream(imagePath);
        const { data } = await axios({ url: imageUrl, method: 'GET', responseType: 'stream' });
        data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        // Send the generated image
        await sendMessage(senderId, {
          text: '👩‍💻 | 𝙶𝚎𝚖𝚒𝚗𝚒 |\n━━━━━━━━━━━━━━━━\nGenerated image:',
          attachment: fs.createReadStream(imagePath)
        }, pageAccessToken);
      } else {
        // Get a text response
        await sendMessage(senderId, { text: '💬 *Gemini is preparing a response* ⏳...\n\n─────★─────' }, pageAccessToken);
        const response = await getTextResponse(prompt, senderId);
        const formattedResponse = `─────★─────\n✨ Gemini 🤖\n\n${response}\n─────★─────`;

        // Handle long responses
        const maxMessageLength = 2000;
        if (formattedResponse.length > maxMessageLength) {
          const messages = splitMessageIntoChunks(formattedResponse, maxMessageLength);
          for (const message of messages) {
            await sendMessage(senderId, { text: message }, pageAccessToken);
          }
        } else {
          await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
        }
      }
    } catch (error) {
      console.error('Error during Gemini API call:', error);
      await sendMessage(senderId, { text: 'Sorry, an error occurred. Please try again later.' }, pageAccessToken);
    }
  }
};

// Function to describe an image using the API
async function describeImage(prompt, photoUrl) {
  try {
    const { data } = await axios.get(`https://joshweb.click/gemini?prompt=${encodeURIComponent(prompt)}&url=${encodeURIComponent(photoUrl)}`);
    return data.answer;
  } catch (error) {
    throw new Error('Error while describing the image');
  }
}

// Function to get a textual response via the API
async function getTextResponse(prompt, senderId) {
  try {
    const { data } = await axios.get(`https://joshweb.click/new/gemini?prompt=${encodeURIComponent(prompt)}&uid=${senderId}&apikey=kshitiz`);
    return data.answer;
  } catch (error) {
    throw new Error('Error during Gemini API text response call');
  }
}

// Function to split long messages into chunks
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}

// Function to generate an image
async function generateImage(prompt) {
  try {
    const { data } = await axios.get(`https://joshweb.click/api/flux?prompt=${encodeURIComponent(prompt)}&style=3`);
    return data.url;
  } catch (error) {
    throw new Error('Error while generating the image');
  }
}
