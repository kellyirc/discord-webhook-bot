import test from 'ava';
import { parseCommandFromMessage } from '../lib/command-parser';

test("allow commands with prefix '!'", t => {
    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '!hello world banana'
        }),
        {
            command: 'hello',
            arguments: 'world banana',
            internal: false
        }
    );

    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '!pizza'
        }),
        {
            command: 'pizza',
            arguments: '',
            internal: false
        }
    );
});

test('allow commands with mention prefix', t => {
    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '<@123123123123123123> hello world banana'
        }),
        {
            command: 'hello',
            arguments: 'world banana',
            internal: false
        }
    );

    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '<@123123123123123123> pizza'
        }),
        {
            command: 'pizza',
            arguments: '',
            internal: false
        }
    );
});

test('do not allow internal commands without mention', t => {
    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '$add wow cool'
        }),
        null
    );

    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '!$add wow cool'
        }),
        null
    );
});

test('allow internal commands with mention prefix', t => {
    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '<@123123123123123123> $add wow cool'
        }),
        {
            command: '$add',
            arguments: 'wow cool',
            internal: true
        }
    );

    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '<@123123123123123123> $pizza'
        }),
        {
            command: '$pizza',
            arguments: '',
            internal: true
        }
    );
});

test('ignore commands without mention or right prefix', t => {
    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: 'extremely wow'
        }),
        null
    );

    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '%extremely wow'
        }),
        null
    );

    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '~extremely wow'
        }),
        null
    );
});

test('ignore commands targeted at anyone else using mentions', t => {
    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '<@456456456456456456> hello world banana'
        }),
        null
    );

    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '<@456456456456456456> hamburger'
        }),
        null
    );

    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '<@456456456456456456> $hello world banana'
        }),
        null
    );

    t.deepEqual(
        parseCommandFromMessage('123123123123123123', {
            content: '<@456456456456456456> $burger'
        }),
        null
    );
});
