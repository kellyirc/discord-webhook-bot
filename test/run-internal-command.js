import test from 'ava';
import Keyv from 'keyv';
import sinon from 'sinon';
import { runInternalCommand } from '../lib';

test.beforeEach(t => {
    t.context.storeMap = new Map();
    t.context.store = new Keyv({ store: t.context.storeMap });
    t.context.msg = { reply: sinon.fake(), react: sinon.fake() };
});

test('$add command', async t => {
    const { storeMap, store, msg } = t.context;

    await runInternalCommand(null, store, msg, {
        command: '$add',
        arguments: 'command-to-add https://example.com',
        internal: true
    });

    t.true(msg.reply.called);
    t.snapshot(msg.reply.args);
    t.snapshot(storeMap);
});

test('$remove command', async t => {
    const { storeMap, store, msg } = t.context;

    await store.set('commands', {
        'command-to-remove': 'https://example.com'
    });

    await runInternalCommand(null, store, msg, {
        command: '$remove',
        arguments: 'command-to-remove',
        internal: true
    });

    t.true(msg.reply.called);
    t.snapshot(msg.reply.args);
    t.snapshot(storeMap);
});

test('$list command', async t => {
    const { storeMap, store, msg } = t.context;

    await store.set('commands', {
        'command-one': 'https://example.com',
        'command-two': 'https://example.com/another-url',
    });

    await runInternalCommand(null, store, msg, {
        command: '$list',
        arguments: '',
        internal: true
    });

    t.true(msg.reply.called);
    t.snapshot(msg.reply.args);
    t.snapshot(storeMap);
});

test('$ping command', async t => {
    const { storeMap, store, msg } = t.context;

    await runInternalCommand(null, store, msg, {
        command: '$ping',
        arguments: '',
        internal: true
    });

    t.true(msg.react.called);
    t.snapshot(msg.react.args);
    t.snapshot(storeMap);
});
