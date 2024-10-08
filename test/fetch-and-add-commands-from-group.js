import test from 'ava';
import sinon from 'sinon';
import { fetchAndAddCommandsFromGroup } from '../lib/index.js';
import Keyv from 'keyv';

const groupId = '5f66f818-bed8-4c0e-90ac-f57df2b0d918';

test.beforeEach(t => {
    t.context.store = new Keyv();
    t.context.get = sinon.stub();
});

test('works', async t => {
    const { get, store } = t.context;

    get.resolves({
        headers: new Headers(),
        body: {
            nextFetchDate: '2024-05-09T01:02:03.000Z',
            commands: [
                { name: 'some-command', url: '/some-command' },
                { name: 'another-command', url: '/another-command' },
                { name: 'different-host', url: 'https://example.se' },
            ]
        }
    });

    await store.set('command-groups', {
        [groupId]: {
            url: 'https://example.com/.commands',
            commands: []
        }
    });

    const nextFetchDate = await fetchAndAddCommandsFromGroup({ get, store }, groupId);

    t.deepEqual(nextFetchDate, new Date('2024-05-09T01:02:03.000Z'));
    t.deepEqual(await store.get('command-groups'), {
        [groupId]: {
            url: 'https://example.com/.commands',
            commands: [
                { name: 'some-command', url: 'https://example.com/some-command' },
                { name: 'another-command', url: 'https://example.com/another-command' },
                { name: 'different-host', url: 'https://example.se/' },
            ]
        }
    });
});

test('throws error on malformed GET response', async t => {
    const { get, store } = t.context;

    get.resolves({
        headers: new Headers(),
        body: {
            nextFetchDate: 'wowie',
            someRandomStuff: 'cool'
        }
    });

    await store.set('command-groups', {
        [groupId]: {
            url: 'https://example.com/.commands',
            commands: []
        }
    });

    const err = await t.throwsAsync(() => fetchAndAddCommandsFromGroup({ get, store }, groupId), { any: true });
    t.true(err.message.startsWith(`When running fetchAndAddCommandsFromGroup for group ${groupId}:`));
    t.snapshot(err.cause.errors);
});
