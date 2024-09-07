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
        headers: new Headers({
            'Next-Fetch-Date': '2024-05-09T01:02:03.000Z'
        }),
        body: {
            commands: [
                { name: 'some-command', url: '/some-command' },
                { name: 'another-command', url: '/another-command' },
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
                { name: 'some-command', url: '/some-command' },
                { name: 'another-command', url: '/another-command' },
            ]
        }
    });
});

test('throws error on malformed GET response', async t => {
    const { get, store } = t.context;

    get.resolves({
        headers: new Headers({
            'Next-Fetch-Date': '2024-05-09T01:02:03.000Z'
        }),
        body: {
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

test('throws error on malformed date in Next-Fetch-Date header', async t => {
    const { get, store } = t.context;

    get.resolves({
        headers: new Headers({
            'Next-Fetch-Date': 'something random'
        }),
        body: {
            commands: [
                { name: 'some-command', url: '/some-command' },
                { name: 'another-command', url: '/another-command' },
            ]
        }
    });

    await store.set('command-groups', {
        [groupId]: {
            url: 'https://example.com/.commands',
            commands: []
        }
    });

    const err = await t.throwsAsync(() => fetchAndAddCommandsFromGroup({ get, store }, groupId));
    t.is(err.message, `When running fetchAndAddCommandsFromGroup for group ${groupId}: Unable to parse date from header Next-Fetch-Date`);
});
