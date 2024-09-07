import test from 'ava';
import { schedule } from '../lib/util.js';
import sinon from 'sinon';

test.before(t => {
    t.context.clock = sinon.useFakeTimers();
});

test.beforeEach(t => {
    const now = sinon.stub();
    now.onCall(0).returns(new Date('2024-05-02T01:02:03.000Z'));
    now.onCall(1).returns(new Date('2024-05-02T01:03:03.000Z'));
    now.onCall(2).returns(new Date('2024-05-02T01:04:03.000Z'));
    now.onCall(3).returns(new Date('2024-05-02T01:05:03.000Z'));
    now.onCall(4).returns(new Date('2024-05-02T01:06:03.000Z'));
    now.throws();
    t.context.now = now;

    const fn = sinon.stub();
    fn.onCall(0).resolves(new Date('2024-05-02T01:03:03.000Z'));
    fn.onCall(1).resolves(new Date('2024-05-02T01:04:03.000Z'));
    fn.onCall(2).resolves(new Date('2024-05-02T01:05:03.000Z'));
    fn.onCall(3).resolves(new Date('2024-05-02T01:06:03.000Z'));
    fn.onCall(4).resolves(new Date('2024-05-02T01:07:03.000Z'));
    fn.rejects();
    t.context.fn = fn;
});

test.after(t => {
    t.context.clock.restore();
});

test.serial('returns cancel function', async t => {
    const { now, fn } = t.context;
    const errorCb = sinon.stub();

    const cancel = schedule(now, fn, errorCb);
    t.is(typeof cancel, 'function');
});

test.serial('works', async t => {
    const { now, fn, clock } = t.context;

    const errorCb = sinon.stub();

    t.is(fn.callCount, 0);

    schedule(now, fn, errorCb);

    t.is(fn.callCount, 1);

    await clock.tickAsync(59_000);

    t.is(fn.callCount, 1);

    await clock.tickAsync(1_000);

    t.is(fn.callCount, 2);

    t.false(errorCb.called);
});

test.serial('works multiple times', async t => {
    const { now, fn, clock } = t.context;

    const errorCb = sinon.stub();

    t.is(fn.callCount, 0);

    schedule(now, fn, errorCb);

    t.is(fn.callCount, 1);

    await clock.tickAsync(59_000);

    t.is(fn.callCount, 1);

    await clock.tickAsync(1_000);

    t.is(fn.callCount, 2);

    await clock.tickAsync(59_000);

    t.is(fn.callCount, 2);

    await clock.tickAsync(1_000);

    t.is(fn.callCount, 3);

    t.false(errorCb.called);
});

test.serial('can be canceled', async t => {
    const { now, fn, clock } = t.context;

    const errorCb = sinon.stub();

    t.is(fn.callCount, 0);

    const cancel = schedule(now, fn, errorCb);

    t.is(fn.callCount, 1);

    await clock.tickAsync(59_000);

    t.is(fn.callCount, 1);

    cancel();

    await clock.tickAsync(1_000);

    t.is(fn.callCount, 1);

    t.false(errorCb.called);
});

test.serial('calls error callback if fn rejects', async t => {
    const { now, clock } = t.context;

    const errorCb = sinon.stub();

    const theError = new Error('Arbitrary error that happened in fn');

    const fn = sinon.stub();
    fn.onCall(0).resolves(new Date('2024-05-02T01:03:03.000Z'));
    fn.rejects(theError);

    schedule(now, fn, errorCb);

    await clock.tickAsync(60_000);

    t.true(errorCb.called);
    t.is(errorCb.args[0][0], theError);
});
