import test from 'ava';
import Keyv from 'keyv';
import sinon from 'sinon';
import got from 'got';
import { runUserCommand } from '../lib';
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

    t.context.gotPost = sinon.stub(got, 'post');
});

test.afterEach(t => {
    t.context.gotPost.restore();
});

test.serial('works when returning a single message', async t => {
    const { store, msg, gotPost } = t.context;

    await store.set('commands', {
        'command-for-testing-purposes': 'https://example.com'
    });

    gotPost.resolves({
        body: {
            message: 'A cool message'
        }
    });

    await runUserCommand(null, store, msg, {
        command: 'command-for-testing-purposes',
        arguments: 'the args here',
        internal: false
    });

    t.is(msg.channel.send.callCount, 1);
    t.snapshot(msg.channel.send.args);
    t.snapshot(gotPost.args);
});

test.serial('works when returning multiple messages', async t => {
    const { store, msg, gotPost } = t.context;

    await store.set('commands', {
        'command-for-testing-purposes': 'https://example.com'
    });

    gotPost.resolves({
        body: [
            {
                message: 'A cool message'
            },
            {
                message: 'Another cool message'
            }
        ]
    });

    await runUserCommand(null, store, msg, {
        command: 'command-for-testing-purposes',
        arguments: 'the args here',
        internal: false
    });

    t.is(msg.channel.send.callCount, 2);
    t.snapshot(msg.channel.send.args);
    t.snapshot(gotPost.args);
});
