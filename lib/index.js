require('dotenv').config();

const assert = require('assert');
const Discord = require('discord.js');
const Keyv = require('keyv');

const { parseCommandFromMessage } = require('./command-parser');

async function error(err) {
    console.error(err.stack);

    await Promise.resolve();

    process.exit(1);
}

async function main() {
    assert.ok(process.env.DISCORD_TOKEN, "Expected env var 'DISCORD_TOKEN' to exist");

    const client = new Discord.Client();
    await client.login(process.env.DISCORD_TOKEN);

    const userId = client.user.id;

    const keyv = new Keyv(
        process.env.DATABASE_URL ||
        process.env.REDIS_URL ||
        process.env.MONGO_URL ||
        undefined
    );

    client.on('error', error);
    keyv.on('error', error);

    client.on('message', async msg => {
        const result = parseCommandFromMessage(userId, msg);
        if(result == null) {
            return;
        }

        const { command, arguments: args, internal } = result;

        if(internal) {
            msg.reply('That was an internal command!! ' + `Command: ${command}, Arguments: ${args}`);
        }
        else {
            msg.reply(`Command: ${command}, Arguments: ${args}`);
        }
    });
}

main().catch(error);
