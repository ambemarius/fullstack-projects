const { sql, pool, poolConnect } = require('../../config/database');

/**
 * Cameroon administrative locations: Region -> Division -> Subdivision.
 * Used to feed the student "Region of Origin" / "Division" dropdowns.
 *
 * 10 regions, 58 divisions, and their subdivisions (arrondissements).
 * Subdivision lists are extensive — verify/extend against the latest
 * official decoupage if you need 100% completeness.
 */
const CAMEROON = [
    {
        region: 'Adamawa', divisions: [
            { division: 'Djérem', subs: ['Tibati', 'Ngaoundal'] },
            { division: 'Faro-et-Déo', subs: ['Tignère', 'Galim-Tignère', 'Kontcha', 'Mayo-Baléo'] },
            { division: 'Mayo-Banyo', subs: ['Banyo', 'Bankim', 'Mayo-Darlé'] },
            { division: 'Mbéré', subs: ['Meiganga', 'Dir', 'Djohong', 'Ngaoui'] },
            { division: 'Vina', subs: ['Ngaoundéré I', 'Ngaoundéré II', 'Ngaoundéré III', 'Belel', 'Mbé', 'Nganha', 'Nyambaka', 'Martap'] },
        ]
    },
    {
        region: 'Centre', divisions: [
            { division: 'Haute-Sanaga', subs: ['Nanga-Eboko', 'Bibey', 'Lembe-Yezoum', 'Mbandjock', 'Minta', 'Nkoteng', 'Nsem'] },
            { division: 'Lekié', subs: ['Monatélé', 'Batchenga', 'Ebebda', 'Elig-Mfomo', 'Evodoula', 'Lobo', 'Obala', 'Okola', "Sa'a"] },
            { division: 'Mbam-et-Inoubou', subs: ['Bafia', 'Bokito', 'Deuk', 'Kiiki', 'Kon-Yambetta', 'Makénéné', 'Ndikiniméki', 'Nitoukou', 'Ombessa'] },
            { division: 'Mbam-et-Kim', subs: ['Ntui', 'Mbangassina', 'Ngambè-Tikar', 'Ngoro', 'Yoko'] },
            { division: 'Méfou-et-Afamba', subs: ['Mfou', 'Afanloum', 'Assamba', 'Awae', 'Edzendouan', 'Esse', 'Nkolafamba', 'Olanguina', 'Soa'] },
            { division: 'Méfou-et-Akono', subs: ['Ngoumou', 'Akono', 'Bikok', 'Mbankomo'] },
            { division: 'Mfoundi', subs: ['Yaoundé I', 'Yaoundé II', 'Yaoundé III', 'Yaoundé IV', 'Yaoundé V', 'Yaoundé VI', 'Yaoundé VII'] },
            { division: 'Nyong-et-Kéllé', subs: ['Eséka', 'Biyouha', 'Bondjock', 'Bot-Makak', 'Dibang', 'Makak', 'Matomb', 'Messondo', 'Ngog-Mapubi', 'Nguibassal'] },
            { division: 'Nyong-et-Mfoumou', subs: ['Akonolinga', 'Ayos', 'Endom', 'Mengang', 'Nyakokombo'] },
            { division: "Nyong-et-So'o", subs: ['Mbalmayo', 'Akoeman', 'Dzeng', 'Mengueme', 'Ngomedzap', 'Nkolmetet'] },
        ]
    },
    {
        region: 'East', divisions: [
            { division: 'Boumba-et-Ngoko', subs: ['Yokadouma', 'Gari-Gombo', 'Moloundou', 'Salapoumbé'] },
            { division: 'Haut-Nyong', subs: ['Abong-Mbang', 'Angossas', 'Atok', 'Dimako', 'Doumé', 'Lomié', 'Mboma', 'Messamena', 'Messok', 'Mindourou', 'Ngoyla', 'Nguelemendouka', 'Somalomo'] },
            { division: 'Kadey', subs: ['Batouri', 'Kentzou', 'Kette', 'Mbang', 'Ndelele', 'Nguelebok', 'Ouli'] },
            { division: 'Lom-et-Djérem', subs: ['Bertoua I', 'Bertoua II', 'Bélabo', 'Bétaré-Oya', 'Diang', 'Garoua-Boulaï', 'Mandjou', 'Ngoura'] },
        ]
    },
    {
        region: 'Far North', divisions: [
            { division: 'Diamaré', subs: ['Maroua I', 'Maroua II', 'Maroua III', 'Bogo', 'Dargala', 'Gazawa', 'Meri', 'Ndoukoula', 'Petté'] },
            { division: 'Logone-et-Chari', subs: ['Kousséri', 'Blangoua', 'Darak', 'Fotokol', 'Goulfey', 'Hile-Alifa', 'Kala-Kafra', 'Logone-Birni', 'Makary', 'Waza', 'Zina'] },
            { division: 'Mayo-Danay', subs: ['Yagoua', 'Datcheka', 'Gobo', 'Guémé', 'Guéré', 'Kai-Kai', 'Kalfou', 'Kar-Hay', 'Maga', 'Tchatibali', 'Vélé', 'Wina'] },
            { division: 'Mayo-Kani', subs: ['Kaélé', 'Dziguilao', 'Guidiguis', 'Mindif', 'Moulvoudaye', 'Moutourwa', 'Porhi', 'Touloum'] },
            { division: 'Mayo-Sava', subs: ['Mora', 'Kolofata', 'Tokombéré'] },
            { division: 'Mayo-Tsanaga', subs: ['Mokolo', 'Bourrha', 'Hina', 'Koza', 'Mogodé', 'Mozogo', 'Soulédé-Roua'] },
        ]
    },
    {
        region: 'Littoral', divisions: [
            { division: 'Moungo', subs: ['Nkongsamba I', 'Nkongsamba II', 'Nkongsamba III', 'Bare-Bakem', 'Dibombari', 'Ebone', 'Loum', 'Manjo', 'Mbanga', 'Melong', 'Mombo', 'Nlonako', 'Njombe-Penja'] },
            { division: 'Nkam', subs: ['Yabassi', 'Nkondjock', 'Yingui', 'Nord-Makombé'] },
            { division: 'Sanaga-Maritime', subs: ['Édéa I', 'Édéa II', 'Dibamba', 'Dizangué', 'Massock-Songloulou', 'Mouanko', 'Ndom', 'Ngambè', 'Ngwei', 'Nyanon', 'Pouma'] },
            { division: 'Wouri', subs: ['Douala I', 'Douala II', 'Douala III', 'Douala IV', 'Douala V', 'Douala VI', 'Manoka'] },
        ]
    },
    {
        region: 'North', divisions: [
            { division: 'Bénoué', subs: ['Garoua I', 'Garoua II', 'Garoua III', 'Bashéo', 'Bibémi', 'Dembo', 'Demsa', 'Gashiga', 'Lagdo', 'Ngong', 'Pitoa', 'Touroua'] },
            { division: 'Faro', subs: ['Poli', 'Beka'] },
            { division: 'Mayo-Louti', subs: ['Guider', 'Figuil', 'Mayo-Oulo'] },
            { division: 'Mayo-Rey', subs: ['Tcholliré', 'Madingring', 'Rey-Bouba', 'Touboro'] },
        ]
    },
    {
        region: 'Northwest', divisions: [
            { division: 'Boyo', subs: ['Fundong', 'Belo', 'Bum', 'Njinikom'] },
            { division: 'Bui', subs: ['Kumbo', 'Jakiri', 'Mbiame', 'Nkum', 'Noni', 'Oku'] },
            { division: 'Donga-Mantung', subs: ['Nkambé', 'Ako', 'Misaje', 'Ndu', 'Nwa'] },
            { division: 'Menchum', subs: ['Wum', 'Benakuma', 'Furu-Awa', 'Zhoa'] },
            { division: 'Mezam', subs: ['Bamenda I', 'Bamenda II', 'Bamenda III', 'Bafut', 'Bali', 'Santa', 'Tubah'] },
            { division: 'Momo', subs: ['Mbengwi', 'Andek', 'Ngie', 'Njikwa', 'Widikum'] },
            { division: 'Ngo-Ketunjia', subs: ['Ndop', 'Babessi', 'Balikumbat'] },
        ]
    },
    {
        region: 'South', divisions: [
            { division: 'Dja-et-Lobo', subs: ['Sangmélima', 'Bengbis', 'Djoum', 'Meyomessala', 'Meyomessi', 'Mintom', 'Oveng', 'Zoétélé'] },
            { division: 'Mvila', subs: ['Ebolowa I', 'Ebolowa II', 'Biwong-Bané', 'Biwong-Bulu', 'Efoulan', 'Mengong', 'Mvangan', 'Ngoulemakong'] },
            { division: 'Océan', subs: ['Kribi I', 'Kribi II', 'Akom II', 'Bipindi', 'Campo', 'Lokoundjé', 'Lolodorf', 'Niété'] },
            { division: 'Vallée-du-Ntem', subs: ['Ambam', 'Kyé-Ossi', "Ma'an", 'Olamze'] },
        ]
    },
    {
        region: 'Southwest', divisions: [
            { division: 'Fako', subs: ['Limbe I', 'Limbe II', 'Limbe III', 'Buea', 'Idenau', 'Muyuka', 'Tiko', 'West Coast'] },
            { division: 'Koupé-Manengouba', subs: ['Bangem', 'Nguti', 'Tombel'] },
            { division: 'Lebialem', subs: ['Menji', 'Alou', 'Wabane'] },
            { division: 'Manyu', subs: ['Mamfe', 'Akwaya', 'Eyumojock', 'Tinto'] },
            { division: 'Meme', subs: ['Kumba I', 'Kumba II', 'Kumba III', 'Konye', 'Mbonge'] },
            { division: 'Ndian', subs: ['Mundemba', 'Bamusso', 'Dikome-Balue', 'Ekondo-Titi', 'Idabato', 'Isangele', 'Kombo-Abedimo', 'Kombo-Itindi', 'Toko'] },
        ]
    },
    {
        region: 'West', divisions: [
            { division: 'Bamboutos', subs: ['Mbouda', 'Babadjou', 'Batcham', 'Galim'] },
            { division: 'Haut-Nkam', subs: ['Bafang', 'Bakou', 'Bana', 'Bandja', 'Banka', 'Kékem'] },
            { division: 'Hauts-Plateaux', subs: ['Baham', 'Bamendjou', 'Bangou', 'Batié', 'Bahouan'] },
            { division: 'Koung-Khi', subs: ['Bandjoun', 'Bayangam', 'Djebem'] },
            { division: 'Menoua', subs: ['Dschang', 'Fokoué', 'Fongo-Tongo', 'Nkong-Zem', 'Penka-Michel', 'Santchou'] },
            { division: 'Mifi', subs: ['Bafoussam I', 'Bafoussam II', 'Bafoussam III'] },
            { division: 'Ndé', subs: ['Bangangté', 'Bazou', 'Tonga', 'Bassamba'] },
            { division: 'Noun', subs: ['Foumban', 'Bangourain', 'Foumbot', 'Kouoptamo', 'Koutaba', 'Magba', 'Malantouen', 'Massangam', 'Njimom'] },
        ]
    },
];

const LocationModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'regions')
            CREATE TABLE regions (
                id   INT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(60) NOT NULL UNIQUE
            );
        `);
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'divisions')
            CREATE TABLE divisions (
                id        INT IDENTITY(1,1) PRIMARY KEY,
                name      NVARCHAR(80) NOT NULL,
                region_id INT NOT NULL,
                CONSTRAINT UQ_division UNIQUE (name, region_id),
                CONSTRAINT FK_division_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE
            );
        `);
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'subdivisions')
            CREATE TABLE subdivisions (
                id          INT IDENTITY(1,1) PRIMARY KEY,
                name        NVARCHAR(80) NOT NULL,
                division_id INT NOT NULL,
                CONSTRAINT UQ_subdivision UNIQUE (name, division_id),
                CONSTRAINT FK_subdivision_division FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE
            );
        `);
    },

    // Populate the three tables (idempotent — skips if regions already seeded).
    async seed() {
        await poolConnect;
        const existing = await pool.request().query('SELECT COUNT(*) AS cnt FROM regions');
        if (existing.recordset[0].cnt > 0) return { skipped: true };

        let regions = 0, divisions = 0, subs = 0;
        for (const r of CAMEROON) {
            const regRes = await pool.request()
                .input('name', sql.NVarChar(60), r.region)
                .query('INSERT INTO regions (name) OUTPUT INSERTED.id VALUES (@name)');
            const regionId = regRes.recordset[0].id;
            regions++;

            for (const d of r.divisions) {
                const divRes = await pool.request()
                    .input('name', sql.NVarChar(80), d.division)
                    .input('regionId', sql.Int, regionId)
                    .query('INSERT INTO divisions (name, region_id) OUTPUT INSERTED.id VALUES (@name, @regionId)');
                const divisionId = divRes.recordset[0].id;
                divisions++;

                for (const s of d.subs) {
                    await pool.request()
                        .input('name', sql.NVarChar(80), s)
                        .input('divisionId', sql.Int, divisionId)
                        .query('INSERT INTO subdivisions (name, division_id) VALUES (@name, @divisionId)');
                    subs++;
                }
            }
        }
        return { regions, divisions, subs };
    },

    async getRegions() {
        await poolConnect;
        const result = await pool.request().query('SELECT id, name FROM regions ORDER BY name');
        return result.recordset;
    },

    async getDivisions(regionId) {
        await poolConnect;
        const result = await pool.request()
            .input('regionId', sql.Int, regionId)
            .query('SELECT id, name FROM divisions WHERE region_id = @regionId ORDER BY name');
        return result.recordset;
    },

    async getSubdivisions(divisionId) {
        await poolConnect;
        const result = await pool.request()
            .input('divisionId', sql.Int, divisionId)
            .query('SELECT id, name FROM subdivisions WHERE division_id = @divisionId ORDER BY name');
        return result.recordset;
    },
};

module.exports = LocationModel;
