// Database-free integration fixture for the actual administrator scripts.
const express = require('express');
const { createApp } = require('../app/app');
function createReviewApp() {
    const routes = express.Router();
    routes.get('/', (_req, res) => res.render('admin-layout', {
        canonicalPersonnelEnabled: true, canonicalAcademicEnabled: true,
        canonicalAuxiliaryEnabled: true, canonicalAcademicLinksEnabled: true
    }, (error, html) => {
        if (error) return res.status(500).send('Review template error');
        html = html.replace(/LYCEE BATOURI/g, 'Fictional review school')
            .replace('<script src="/js/legacy-personnel-handoff.js"></script>', '')
            .replace('<script src="/js/app.js"></script>', '<script src="/fixture-session.js"></script><script src="/js/app.js"></script>')
            .replace('<div class="admin-content">', '<div class="admin-content"><p class="card">Fictional review only. Forms cannot save records.</p>');
        res.send(html);
    }));
    routes.get('/fixture-session.js', (_req,res) => res.type('js').send("localStorage.setItem('token','fictional-ui-marker');localStorage.setItem('role','admin');"));
    routes.get('/api/v1/admin/profile', (_req,res) => res.json({ data: { name: 'Review Administrator' } }));
    routes.get('/api/v1/admin/stats', (_req,res) => res.json({ data: { teachers: 1, students: 0, subjects: 0, classes: 0 } }));
    routes.get('/api/v1/teachers', (_req,res) => res.json({ data: [{ id: 1, firstName: 'Example', lastName: 'Teacher', email: 'example@example.invalid', status: 'active', section: 'Anglophone', employmentType: 'Part-time' }] }));
    routes.get('/api/v1/academic-context', (_req,res) => res.json({ data: { academicYears: [], classes: [], subjects: [] } }));
    routes.use('/api', (req,res) => req.method === 'GET' ? res.json({ data: [] }) : res.status(422).json({ message: 'Review only: no records saved.' }));
    return createApp({ logging: false, routes: [['/', routes]] });
}
if (require.main === module) {
    const server = createReviewApp().listen(2031, '127.0.0.1', () => console.log('Fictional administrator review on http://localhost:2031/'));
    process.on('SIGINT', () => server.close(() => process.exit()));
}
module.exports = { createReviewApp };
