const prefixRegex = /^!([^\s]+?)(?:\s+((?:.|\s)+))?$/;
const mentionRegex = /^<@!?(\d{18})>\s*([^\s]+?)(?:\s+((?:.|\s)+))?$/;
const internalCmdRegex = /^\$/;

export function parseCommandFromMessage(userId, msg) {
    const prefixMatch = prefixRegex.exec(msg.content);

    if(prefixMatch != null && !internalCmdRegex.test(prefixMatch[1])) {
        return {
            command: prefixMatch[1],
            arguments: prefixMatch[2] || '',
            internal: false
        };
    }

    const mentionMatch = mentionRegex.exec(msg.content);

    if(mentionMatch != null && mentionMatch[1] === userId) {
        return {
            command: mentionMatch[2],
            arguments: mentionMatch[3] || '',
            internal: internalCmdRegex.test(mentionMatch[2])
        };
    }

    return null;
}
