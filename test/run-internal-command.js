import test from 'ava';
import Keyv from 'keyv';
import sinon from 'sinon';
import { runInternalCommand } from '../lib/index.js';

test.beforeEach(t => {
    t.context.storeMap = new Map();
    t.context.store = new Keyv({ store: t.context.storeMap });
    t.context.msg = { reply: sinon.fake(), react: sinon.fake() };
    t.context.makeId = sinon.stub();
    t.context.now = sinon.stub().returns(new Date('2024-05-02T01:02:03.000Z'));
    t.context.get = sinon.stub();
    t.context.schedule = sinon.stub();
    t.context.cancelSchedule = sinon.stub();
});

test('$add command', async t => {
    const { makeId, now, get, schedule, cancelSchedule, storeMap, store, msg } = t.context;

    await runInternalCommand(makeId, now, get, schedule, cancelSchedule, null, store, msg, {
        command: '$add',
        arguments: 'command-to-add https://example.com',
        internal: true
    });

    t.true(msg.reply.called);
    t.snapshot(msg.reply.args);
    t.snapshot(storeMap);
});

test('$remove command', async t => {
    const { makeId, now, get, schedule, cancelSchedule, storeMap, store, msg } = t.context;

    await store.set('commands', {
        'command-to-remove': 'https://example.com'
    });

    await runInternalCommand(makeId, now, get, schedule, cancelSchedule, null, store, msg, {
        command: '$remove',
        arguments: 'command-to-remove',
        internal: true
    });

    t.true(msg.reply.called);
    t.snapshot(msg.reply.args);
    t.snapshot(storeMap);
});

test('$list command', async t => {
    const { makeId, now, get, schedule, cancelSchedule, storeMap, store, msg } = t.context;

    await store.set('commands', {
        'command-one': 'https://example.com',
        'command-two': 'https://example.com/another-url',
    });

    await runInternalCommand(makeId, now, get, schedule, cancelSchedule, null, store, msg, {
        command: '$list',
        arguments: '',
        internal: true
    });

    t.true(msg.reply.called);
    t.snapshot(msg.reply.args);
    t.snapshot(storeMap);
});

test('$list command with groups', async t => {
    const { makeId, now, get, schedule, cancelSchedule, storeMap, store, msg } = t.context;

    await store.set('commands', {
        'command-one': 'https://example.com',
        'command-two': 'https://example.com/another-url',
    });

    await store.set('command-groups', {
        '5bb81409-7cfc-471e-84b8-6788974d59f5': {
            url: 'https://example.com',
            commands: [
                { name: 'some-example', url: 'https://example.com/some-example' }
            ]
        }
    });

    await runInternalCommand(makeId, now, get, schedule, cancelSchedule, null, store, msg, {
        command: '$list',
        arguments: '',
        internal: true
    });

    t.true(msg.reply.called);
    t.snapshot(msg.reply.args);
    t.snapshot(storeMap);
});

test('$add-group command', async t => {
    const { makeId, now, get, schedule, cancelSchedule, store, msg } = t.context;

    makeId.returns('5bb81409-7cfc-471e-84b8-6788974d59f5');

    await runInternalCommand(makeId, now, get, schedule, cancelSchedule, null, store, msg, {
        command: '$add-group',
        arguments: 'https://example.com/.commands',
        internal: true
    });

    t.true(schedule.called);
    t.snapshot(schedule.args);
    t.true(msg.reply.called);
    t.snapshot(msg.reply.args);
    t.deepEqual(await store.get('command-groups'), {
        '5bb81409-7cfc-471e-84b8-6788974d59f5': {
            url: 'https://example.com/.commands',
            commands: []
        }
    });
});

test('$remove-group command', async t => {
    const { makeId, now, get, schedule, cancelSchedule, store, msg } = t.context;

    await store.set('command-groups', {
        '5bb81409-7cfc-471e-84b8-6788974d59f5': {
            url: 'https://example.com/.commands',
            commands: [
                { name: 'some-example', url: 'https://example.com/some-example' }
            ]
        }
    });

    await runInternalCommand(makeId, now, get, schedule, cancelSchedule, null, store, msg, {
        command: '$remove-group',
        arguments: '5bb81409-7cfc-471e-84b8-6788974d59f5',
        internal: true
    });

    t.true(cancelSchedule.called);
    t.snapshot(cancelSchedule.args);
    t.true(msg.reply.called);
    t.snapshot(msg.reply.args);
    t.deepEqual(await store.get('command-groups'), {});
});

test('$list-groups command', async t => {
    const { makeId, now, get, schedule, cancelSchedule, store, msg } = t.context;

    await store.set('command-groups', {
        '5bb81409-7cfc-471e-84b8-6788974d59f5': {
            url: 'https://example.com/.commands',
            commands: [
                { name: 'some-example', url: 'https://example.com/some-example' }
            ]
        }
    });

    await runInternalCommand(makeId, now, get, schedule, cancelSchedule, null, store, msg, {
        command: '$list-groups',
        arguments: '',
        internal: true
    });

    t.true(msg.reply.called);
    t.snapshot(msg.reply.args);
});

test('$ping command', async t => {
    const { makeId, now, get, schedule, cancelSchedule, storeMap, store, msg } = t.context;

    await runInternalCommand(makeId, now, get, schedule, cancelSchedule, null, store, msg, {
        command: '$ping',
        arguments: '',
        internal: true
    });

    t.true(msg.react.called);
    t.snapshot(msg.react.args);
    t.snapshot(storeMap);
});
