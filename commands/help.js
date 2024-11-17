const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'help',
  description: 'Display available commands',
  author: 'System',
  execute(senderId, args, pageAccessToken, sendMessage) {
    try {
      const commandsDir = path.join(__dirname, '../commands');

      // Check if the directory exists before reading its content
      if (!fs.existsSync(commandsDir)) {
        return sendMessage(senderId, { text: 'The commands directory does not exist.' }, pageAccessToken);
      }

      const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));

      // Check if there are files in the directory
      if (commandFiles.length === 0) {
        return sendMessage(senderId, { text: 'No commands available.' }, pageAccessToken);
      }

      const commands = commandFiles.map(file => {
        try {
          const command = require(path.join(commandsDir, file));

          // Verify that the command has both a name and a description
          if (!command.name || !command.description) {
            return `❌ The command in file ${file} is invalid.`;
          }

          return `
🫣⚩  ${command.name.toUpperCase().padEnd(20, ' ')} ✬
│⇨  Description : ${command.description}
`;
        } catch (err) {
          console.error(`Error loading command ${file}:`, err);
          return `❌ Error loading command ${file}.`;
        }
      });

      const totalCommands = commandFiles.length;
      const helpMessage = `
╭──────✯──────╮
│🇲🇬 Available Commands 📜 
├───────♨──────
${commands.join('─────★─────\n')}
│ 📌 Total number of commands: ${totalCommands}  │
│ 💡 Use the command name for more details! │
╰──────✨──────╯`;

      sendMessage(senderId, { text: helpMessage }, pageAccessToken);
    } catch (error) {
      console.error('Error executing the help command:', error);
      sendMessage(senderId, { text: 'An error occurred while displaying the commands.' }, pageAccessToken);
    }
  }
};
