export function splitMessage(text, { maxLength = 2000, char = '\n', prepend = '', append = '' } = {}) {
    if (text.length <= maxLength) return [text];
    const splitText = text.split(char);
    if (splitText.some(elem => elem.length > maxLength)) throw new RangeError('SPLIT_MAX_LEN');
    const messages = [];
    let msg = '';
    for (const chunk of splitText) {
        if (msg && (msg + char + chunk + append).length > maxLength) {
            messages.push(msg + append);
            msg = prepend;
        }
        msg += (msg && msg !== prepend ? char : '') + chunk;
    }
    return messages.concat(msg).filter(m => m);
}

export function schedule(now, fn, errorCb) {
    let timeoutId;
    let done = false;
    const inner = async () => {
        try {
            const nextTime = await fn();
            if (!done) {
                const msUntilNextTime = nextTime.getTime() - now().getTime();
                timeoutId = setTimeout(() => inner(), Math.max(5_000, msUntilNextTime));
            }
        }
        catch (err) {
            errorCb(err);
        }
    };
    inner();

    return () => {
        done = true;
        clearTimeout(timeoutId);
    };
}
