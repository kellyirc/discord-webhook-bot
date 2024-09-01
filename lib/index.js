require('dotenv').config();

const assert = require('assert');
const Discord = require('discord.js');
const Keyv = require('keyv');
const KeyvFile = require('keyv-file');
const got = require('got');
const _ = require('lodash');

const stringArgv = require('string-argv');
const minimist = require('minimist');

const { parseCommandFromMessage } = require('./command-parser');

async function error(err) {
    console.error(err.stack);

    await new Promise(resolve => setTimeout(resolve, 1001));

    process.exit(1);
}

async function runInternalCommand(client, store, msg, data) {
    if (data.command === '$add') {
        const args = minimist(stringArgv(data.arguments));
        const [cmdName, url] = args._;

        if (/^\$/.test(cmdName)) {
            throw new Error('Command names are not allowed to be prefixed with symbol `$`');
        }

        if (/\s/g.test(cmdName)) {
            throw new Error('Command names are not allowed to contain whitespace');
        }

        const cmdData = (await store.get('commands')) || {};

        cmdData[cmdName] = url;

        await store.set('commands', cmdData);

        msg.reply(`Added command \`${cmdName}\` pointing to URL ${url}`);

        return;
    }

    if (data.command === '$remove') {
        const args = minimist(stringArgv(data.arguments));
        const [cmdName] = args._;

        if (/^\$/.test(cmdName)) {
            throw new Error('Command names are not allowed to be prefixed with symbol `$`');
        }

        const cmdData = (await store.get('commands')) || {};

        delete cmdData[cmdName];

        await store.set('commands', cmdData);

        msg.reply(`Removed command \`${cmdName}\``);

        return;
    }

    if (data.command === '$list') {
        const cmdData = (await store.get('commands')) || {};

        const msgs = Discord.Util.splitMessage(
            _.keys(cmdData)
                .map(k => `* \`${k}\` pointed at ${cmdData[k]}`)
                .join('\n')
        );

        for (const str of msgs) {
            await msg.reply(str);
        }

        return;
    }

    if (data.command === '$ping') {
        await msg.react('👌');
        return;
    }

    throw new Error(`Unknown internal command '${data.command}'`);
}

async function sendMessage(client, store, msg, messageObj) {
    const options = {};

    if (_.isString(messageObj.imageUrl)) {
        options.files = [messageObj.imageUrl];
    }
    else if (_.isArray(messageObj.imageUrl)) {
        options.files = messageObj.imageUrl;
    }

    return await msg.channel.send(messageObj.message, options);
}

async function runUserCommand(client, store, msg, data) {
    const cmdData = (await store.get('commands')) || {};
    const url = cmdData[data.command];

    if (url == null) {
        return;
    }

    console.log(`POSTing to ${url} with arguments '${data.arguments}'`);

    const res = await got.post(url, {
        body: {
            author: {
                id: msg.author.id,
                username: msg.author.username,
                name: _.get(msg, 'member.nickname') || msg.author.username
            },
            channel: {
                id: msg.channel.id,
                name: msg.channel.name,
                type: msg.channel.type
            },
            guild: (msg.guild == null) ? null : {
                id: msg.guild.id,
                name: msg.guild.name
            },
            command: data.command,
            arguments: data.arguments
        },
        json: true
    });

    if (_.isArray(res.body)) {
        for (const resMsg of res.body) {
            await sendMessage(client, store, msg, resMsg);
        }
    }
    else {
        await sendMessage(client, store, msg, res.body);
    }
}

async function main() {
    assert.ok(process.env.DISCORD_TOKEN, "Expected env var 'DISCORD_TOKEN' to exist");

    const client = new Discord.Client({
        intents: [
            Discord.Intents.FLAGS.GUILDS,
            Discord.Intents.FLAGS.GUILD_MESSAGES,
            Discord.Intents.FLAGS.MESSAGE_CONTENT
        ]
    });
    await client.login(process.env.DISCORD_TOKEN);

    const userId = client.user.id;

    const databaseUrl = process.env.DATABASE_URL ||
        process.env.REDIS_URL ||
        process.env.MONGO_URL ||
        undefined;

    const keyv = new Keyv({
        uri: databaseUrl,
        store: (databaseUrl == null) ?
            new KeyvFile({
                filename: './local-store.msgpack'
            }) :
            undefined
    });

    client.on('error', error);
    keyv.on('error', error);

    client.on('messageCreate', async msg => {
        try {
            const result = parseCommandFromMessage(userId, msg);
            if (result == null) {
                return;
            }

            result.internal ?
                (await runInternalCommand(client, keyv, msg, result)) :
                (await runUserCommand(client, keyv, msg, result));
        }
        catch (err) {
            msg.reply(`Oops, an error occured! ${err}`);
            console.error(err);
        }
    });
}

main().catch(error);
