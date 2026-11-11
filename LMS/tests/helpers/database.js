function syntheticDatabase(query) {
    const calls = [];
    const instance = {
        request() {
            const parameters = {};
            return {
                input(name, _type, value) { parameters[name] = value; return this; },
                async query(statement) {
                    calls.push({ statement, parameters });
                    return query(statement, parameters);
                },
            };
        },
    };
    return { calls, connect: async () => instance, getPool: () => instance, close: async () => {} };
}

module.exports = { syntheticDatabase };
