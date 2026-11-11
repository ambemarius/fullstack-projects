const http = require('node:http');
const { loadEnvironment } = require('./config/environment');

async function startServer({ database, createApplication, port, host } = {}) {
    loadEnvironment();
    require('./config/auth').authConfiguration();
    const db = database || require('./config/database');
    const createApp = createApplication || require('./app/app').createApp;
    const listenPort = port ?? process.env.PORT ?? 2026;
    let server;
    try {
        await db.connect();
        // Schema setup is explicit maintenance, never a server-start side effect.
        const policy = require('./config/runtimePolicy.json');
        server = http.createServer(createApp({ legacyPersonnelReadOnly: policy.canonicalPersonnelWrites === true, legacyAcademicReadOnly: policy.canonicalAcademicWrites === true, legacyAuxiliaryReadOnly: policy.canonicalAuxiliaryWrites === true, legacyCredentialVersionsEnabled: policy.canonicalCredentialRecovery === true, legacyAcademicLinksReadOnly: policy.canonicalAcademicLinks === true, legacyScopedExamResultsEnabled:policy.legacyScopedExamResults===true, legacyScopedPersonnelReadsEnabled:policy.legacyScopedPersonnelReads===true, legacyScopedTimetablesEnabled:policy.legacyScopedTimetables===true, legacyScopedAllocationsEnabled:policy.legacyScopedAllocations===true, legacyScopedReferencesEnabled:policy.legacyScopedReferences===true, legacyScopedReportsEnabled:policy.legacyScopedReports===true, legacyScopedSelfEnabled:policy.legacyScopedSelf===true }));
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(listenPort, host, resolve);
        });
        server.on('error', () => console.error('HTTP server error'));
    } catch (err) {
        await db.close().catch(() => {});
        throw err;
    }
    return {
        server,
        async close() {
            try {
                await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
            } finally {
                await db.close();
            }
        },
    };
}

if (require.main === module) {
    startServer().then(runtime => {
        console.log(`Server running on PORT ${runtime.server.address().port}`);
        let stopping = false;
        for (const signal of ['SIGINT', 'SIGTERM']) {
            process.once(signal, () => {
                if (stopping) return;
                stopping = true;
                runtime.close().then(() => { process.exitCode = 0; }, () => { process.exitCode = 1; });
            });
        }
    }).catch(err => {
        console.error(err.code === 'EADDRINUSE'
            ? 'Server port is already in use; the existing process was left running.'
            : 'Server startup failed. Check configuration and database availability.');
        process.exitCode = 1;
    });
}

module.exports = { startServer };
