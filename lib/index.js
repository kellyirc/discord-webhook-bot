import 'dotenv/config';

import { ok } from 'assert';
import { Client, GatewayIntentBits } from 'discord.js';
import { ChannelType } from 'discord-api-types/v10';
import { Keyv } from 'keyv';
import { KeyvFile } from 'keyv-file';
import got from 'got';
import _ from 'lodash';
const { keys, isString, isArray, get, snakeCase } = _;

import stringArgv from 'string-argv';
import minimist from 'minimist';

import { parseCommandFromMessage } from './command-parser.js';
import { splitMessage } from './util.js';
import esMain from 'es-main';

async function error(err) {
    console.error(err.stack);

    await new Promise(resolve => setTimeout(resolve, 1001));

    process.exit(1);
}

export async function runInternalCommand(client, store, msg, data) {
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

        const msgs = splitMessage(
            keys(cmdData)
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

    if (isString(messageObj.imageUrl)) {
        options.files = [messageObj.imageUrl];
    }
    else if (isArray(messageObj.imageUrl)) {
        options.files = messageObj.imageUrl;
    }

    return await msg.channel.send(messageObj.message, options);
}

export async function runUserCommand(post, client, store, msg, data) {
    const cmdData = (await store.get('commands')) || {};
    const url = cmdData[data.command];

    if (url == null) {
        return;
    }

    console.log(`POSTing to ${url} with arguments '${data.arguments}'`);

    const res = await post(url, {
        body: {
            author: {
                id: msg.author.id,
                username: msg.author.username,
                name: get(msg, 'member.nickname') || msg.author.username
            },
            channel: {
                id: msg.channel.id,
                name: msg.channel.name,
                type: snakeCase(ChannelType[msg.channel.type]).toUpperCase()
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

    if (isArray(res.body)) {
        for (const resMsg of res.body) {
            await sendMessage(client, store, msg, resMsg);
        }
    }
    else {
        await sendMessage(client, store, msg, res.body);
    }
}

async function main() {
    ok(process.env.DISCORD_TOKEN, "Expected env var 'DISCORD_TOKEN' to exist");

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });
    await client.login(process.env.DISCORD_TOKEN);

    const userId = client.user.id;

    const keyv = new Keyv({
        store: new KeyvFile({
            filename: './local-store.json'
        })
    });

    client.on('error', error);
    keyv.on('error', error);

    const post = (url, opts) => got.post(url, { ...opts, json: true });

    client.on('messageCreate', async msg => {
        try {
            const result = parseCommandFromMessage(userId, msg);
            if (result == null) {
                return;
            }

            result.internal ?
                (await runInternalCommand(client, keyv, msg, result)) :
                (await runUserCommand(post, client, keyv, msg, result));
        }
        catch (err) {
            msg.reply(`Oops, an error occured! ${err}`);
            console.error(err);
        }
    });
}

if (esMain(import.meta)) {
    main().catch(error);
}
