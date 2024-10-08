import test from 'ava';
import Keyv from 'keyv';
import sinon from 'sinon';
import { runUserCommand } from '../lib/index.js';
import { ChannelType } from 'discord.js';

test.beforeEach(t => {
    t.context.storeMap = new Map();
    t.context.store = new Keyv({ store: t.context.storeMap });
    t.context.msg = {
        author: {
            id: 'arbitrary-author-id',
            name: 'Arbitrary Author Name',
            username: 'arbitrary-author-username'
        },
        channel: {
            id: 'arbitrary-channel-id',
            name: 'arbitrary-channel-name',
            type: ChannelType.GuildText,
            send: sinon.fake.resolves()
        },
        guild: {
            id: 'arbitrary-guild-id',
            name: 'Arbitrary Guild Name'
        },
        reply: sinon.fake(),
        react: sinon.fake()
    };
    t.context.post = sinon.stub();
});

test('works when returning a single message', async t => {
    const { store, msg, post } = t.context;

    await store.set('commands', {
        'command-for-testing-purposes': 'https://example.com'
    });

    post.resolves({
        body: {
            message: 'A cool message'
        }
    });

    await runUserCommand(post, null, store, msg, {
        command: 'command-for-testing-purposes',
        arguments: 'the args here',
        internal: false
    });

    t.is(msg.channel.send.callCount, 1);
    t.snapshot(msg.channel.send.args);
    t.snapshot(post.args);
});

test('works when returning multiple messages', async t => {
    const { store, msg, post } = t.context;

    await store.set('commands', {
        'command-for-testing-purposes': 'https://example.com'
    });

    post.resolves({
        body: [
            {
                message: 'A cool message'
            },
            {
                message: 'Another cool message'
            }
        ]
    });

    await runUserCommand(post, null, store, msg, {
        command: 'command-for-testing-purposes',
        arguments: 'the args here',
        internal: false
    });

    t.is(msg.channel.send.callCount, 2);
    t.snapshot(msg.channel.send.args);
    t.snapshot(post.args);
});

test('works with command from command groups', async t => {
    const { store, msg, post } = t.context;

    await store.set('command-groups', {
        'd556f749-3eab-4039-9e68-9434ce4722c6': {
            url: 'https://example.com/.commands',
            commands: [
                { name: 'command-from-group', url: 'https://example.com/command-from-group' }
            ]
        },
        '2781cc13-a833-4ed6-ab07-c9fc8cba15fd': {
            url: 'https://example.se/.commands',
            commands: [
                { name: 'unused-command', url: 'https://example.se/unused-command' }
            ]
        },
    });

    post.resolves({
        body: {
            message: 'A cool message'
        }
    });

    await runUserCommand(post, null, store, msg, {
        command: 'command-from-group',
        arguments: 'the args here',
        internal: false
    });

    t.is(msg.channel.send.callCount, 1);
    t.snapshot(msg.channel.send.args);
    t.true(post.called);
    t.snapshot(post.args);
    t.is(post.args[0][0], 'https://example.com/command-from-group');
});
