require('dotenv').config();

const assert = require('assert');
const Discord = require('discord.js');
const Keyv = require('keyv');
const got = require('got');
const _ = require('lodash');

const stringArgv = require('string-argv');
const minimist = require('minimist');

const { parseCommandFromMessage } = require('./command-parser');

async function error(err) {
    console.error(err.stack);

    await new Promise(resolve => setTimeout(resolve, 1000));

    process.exit(1);
}

async function runInternalCommand(client, store, msg, data) {
    if(data.command === '$add') {
        const args = minimist(stringArgv(data.arguments));
        const [cmdName, url] = args._;

        if(/^\$/.test(cmdName)) {
            throw new Error('Command names are not allowed to be prefixed with symbol `$`');
        }

        const cmdData = (await store.get('commands')) || {};

        cmdData[cmdName] = url;

        await store.set('commands', cmdData);

        msg.reply(`Added command \`${cmdName}\` pointing to URL ${url}`);

        return;
    }

    if(data.command === '$remove') {
        const args = minimist(stringArgv(data.arguments));
        const [cmdName] = args._;

        if(/^\$/.test(cmdName)) {
            throw new Error('Command names are not allowed to be prefixed with symbol `$`');
        }

        const cmdData = (await store.get('commands')) || {};

        delete cmdData[cmdName];

        await store.set('commands', cmdData);

        msg.reply(`Removed command \`${cmdName}\``);

        return;
    }

    if(data.command === '$list') {
        const cmdData = (await store.get('commands')) || {};

        msg.reply(
            '\n' + _.keys(cmdData).map(k => `* \`${k}\` pointed at ${cmdData[k]}`).join('\n')
        );

        return;
    }

    throw new Error(`Unknown internal command '${data.command}'`);
}

async function runUserCommand(client, store, msg, data) {
    const cmdData = (await store.get('commands')) || {};
    const url = cmdData[data.command];

    if(url == null) {
        return;
    }

    console.log(`POSTing to ${url} with arguments '${data.arguments}'`);
    const res = await got.post(url, {
        body: {
            author: {
                id: msg.author.id,
                username: msg.author.username,
                name: msg.member.nickname || msg.author.username
            },
            command: data.command,
            arguments: data.arguments
        },
        json: true
    });

    if(_.isArray(res.body)) {
        for(const resMsg of res.body) {
            await msg.channel.send(resMsg.message);
        }
    }
    else {
        await msg.channel.send(res.body.message);
    }
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
        try {
            const result = parseCommandFromMessage(userId, msg);
            if(result == null) {
                return;
            }

            result.internal ?
                (await runInternalCommand(client, keyv, msg, result)) :
                (await runUserCommand(client, keyv, msg, result));
        }
        catch(err) {
            msg.reply(`Oops, an error occured! ${err}`);
            console.error(err);
        }
    });
}

main().catch(error);
