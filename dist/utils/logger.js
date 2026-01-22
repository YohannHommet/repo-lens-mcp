const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
class Logger {
    level = 'info';
    setLevel(level) {
        this.level = level;
    }
    shouldLog(level) {
        return LEVELS[level] >= LEVELS[this.level];
    }
    format(level, message, data) {
        const timestamp = new Date().toISOString();
        const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        if (data !== undefined) {
            return `${base} ${JSON.stringify(data)}`;
        }
        return base;
    }
    debug(message, data) {
        if (this.shouldLog('debug')) {
            console.error(this.format('debug', message, data));
        }
    }
    info(message, data) {
        if (this.shouldLog('info')) {
            console.error(this.format('info', message, data));
        }
    }
    warn(message, data) {
        if (this.shouldLog('warn')) {
            console.error(this.format('warn', message, data));
        }
    }
    error(message, data) {
        if (this.shouldLog('error')) {
            console.error(this.format('error', message, data));
        }
    }
}
export const logger = new Logger();
//# sourceMappingURL=logger.js.map