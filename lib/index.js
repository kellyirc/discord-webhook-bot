import 'dotenv/config';

import esMain from 'es-main';
import { ok } from 'assert';
import { Client, GatewayIntentBits } from 'discord.js';
import { ChannelType } from 'discord-api-types/v10';
import { Keyv } from 'keyv';
import { KeyvFile } from 'keyv-file';
import _ from 'lodash';
const { keys, isString, isArray, get, snakeCase } = _;
import { validate } from 'jsonschema';
import { randomUUID } from 'crypto';

import stringArgv from 'string-argv';
import minimist from 'minimist';

import { parseCommandFromMessage } from './command-parser.js';
import { schedule, splitMessage } from './util.js';

async function error(err) {
    console.error(err.stack);

    await new Promise(resolve => setTimeout(resolve, 1001));

    process.exit(1);
}

export async function runInternalCommand(makeId, now, get, schedule, cancelSchedule, client, store, msg, data) {
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
        const groups = (await store.get('command-groups')) || {};

        const msgs = splitMessage(
            keys(cmdData)
                .map(k => `- \`${k}\` pointed at ${cmdData[k]}`)
                .join('\n')
        );

        for (const str of msgs) {
            await msg.reply(str);
        }

        for (const groupId of keys(groups)) {
            const { url, commands } = groups[groupId];

            const message = [
                `From group \`${groupId}\` at URL \`${url}\`:`,
                ...commands.map(c => `- \`${c.name}\` at \`${c.url}\``)
            ].join('\n');

            for (const str of splitMessage(message)) {
                await msg.reply(str);
            }
        }

        return;
    }

    if (data.command === '$add-group') {
        const args = minimist(stringArgv(data.arguments));
        const [url] = args._;

        const groups = (await store.get('command-groups')) || {};

        const groupId = makeId();

        groups[groupId] = { url, commands: [] };

        await store.set('command-groups', groups);

        schedule(groupId);

        msg.reply(`Added group with ID \`${groupId}\` and URL \`${url}\``);

        return;
    }

    if (data.command === '$remove-group') {
        const args = minimist(stringArgv(data.arguments));
        const [groupId] = args._;

        const groups = (await store.get('command-groups')) || {};
        if (!(groupId in groups)) {
            msg.reply(`No such group with ID \`${groupId}\``);
            return;
        }

        cancelSchedule(groupId);

        const { url } = groups[groupId];
        delete groups[groupId];
        await store.set('command-groups', groups);

        msg.reply(`Removed group with ID \`${groupId}\` and URL \`${url}\``);

        return;
    }

    if (data.command === '$list-groups') {
        const groups = (await store.get('command-groups')) || {};

        const msgs = splitMessage(
            keys(groups)
                .map(k => `* \`${k}\` pointed at \`${groups[k].url}\``)
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
    else if (isArray(messageObj.imageUrl) && messageObj.imageUrl.every(u => isString(u))) {
        options.files = messageObj.imageUrl;
    }

    return await msg.channel.send(messageObj.message, options);
}

async function getCommand(store, command) {
    const cmdData = (await store.get('commands')) || {};
    const url = cmdData[command];

    if (url != null) {
        return url;
    }

    const groups = (await store.get('command-groups')) || {};

    const commandFromGroups = Object.values(groups)
        .flatMap(group => group.commands)
        .find(c => c.name === command);

    return commandFromGroups?.url;
}

export async function runUserCommand(post, client, store, msg, data) {
    const url = await getCommand(store, data.command);

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

const commandGroupFetchBodySchema = {
    type: 'object',
    properties: {
        nextFetchDate: { type: 'string', format: 'date-time' },
        commands: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    url: { type: 'string' }
                },
                required: ['name', 'url']
            }
        }
    },
    required: ['commands', 'nextFetchDate']
};

export async function fetchAndAddCommandsFromGroup({ get, store }, groupId) {
    try {
        const groups = (await store.get('command-groups')) || {};
        const { url } = groups[groupId];

        console.log(`Fetching commands from group ${groupId} with URL ${url}`);

        const { body } = await get(url);

        const { instance: { nextFetchDate: nextFetchDateStr, commands } } = validate(body, commandGroupFetchBodySchema, { required: true, throwAll: true });

        const nextFetchDate = new Date(nextFetchDateStr);

        await store.set('command-groups', {
            ...groups,
            [groupId]: {
                url,
                commands: commands.map(c => ({
                    ...c,
                    url: new URL(c.url, url).toString()
                }))
            }
        });

        console.log(`Added ${commands.length} commands for group ${groupId}`);

        return nextFetchDate;
    }
    catch (err) {
        throw new Error(`When running fetchAndAddCommandsFromGroup for group ${groupId}: ${err.message}`, { cause: err });
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

    const get = async (url) => {
        const res = await fetch(url, {
            headers: {
                Accept: 'application/json'
            }
        });

        const resBody = await res.json();

        return {
            headers: res.headers,
            body: resBody
        };
    };

    const post = async (url, opts) => {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(opts.body)
        });

        const resBody = await res.json();

        return { body: resBody };
    };

    const now = () => new Date();

    const schedules = {};

    const scheduleFn = (id) => {
        const fn = fetchAndAddCommandsFromGroup.bind(null, { get, store: keyv }, id);
        schedules[id] = schedule(now, fn, error);
    };
    const cancelScheduleFn = (id) => {
        schedules[id]?.();
        delete schedules[id];
    };

    // schedule existing groups saved in store
    const groups = (await keyv.get('command-groups')) || {};
    for (const groupId of keys(groups)) {
        schedule(groupId);
    }

    client.on('messageCreate', async msg => {
        try {
            const result = parseCommandFromMessage(userId, msg);
            if (result == null) {
                return;
            }

            result.internal ?
                (await runInternalCommand(randomUUID, now, get, scheduleFn, cancelScheduleFn, client, keyv, msg, result)) :
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
