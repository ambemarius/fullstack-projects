const { pool, poolConnect } = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const PASSWORD = 'Student@123';

const firstNames = [
  'Akwi', 'Ambe', 'Awah', 'Bate', 'Besong', 'Bih', 'Che', 'Chi', 'Chia',
  'Ebot', 'Efeti', 'Ekema', 'Enow', 'Etta', 'Eyole', 'Fon', 'Fube', 'Kima',
  'Kome', 'Lum', 'Lyonga', 'Mbah', 'Mbaku', 'Mbi', 'Moki', 'Monju',
  'Motaze', 'Munteh', 'Ndum', 'Ngassa', 'Ngeh', 'Ngwa', 'Njoya', 'Nkwi', 'Ntube',
  'Nyang', 'Nyenti', 'Orock', 'Sama', 'Tabi', 'Tafem', 'Tambe', 'Tata',
  'Chioma', 'Nkechi', 'Folake', 'Amina', 'Zara', 'Kofi', 'Kwame', 'Yaa',
  'Aissatou', 'Fatima', 'Ibrahim', 'Moussa', 'Awa', 'Ngon', 'Mireille'
];

const middleNames = [
  'Ako', 'Awa', 'Buma', 'Chia', 'Efeti', 'Ekaney', 'Ekpe', 'Ewang', 'Fon',
  'Kima', 'Kome', 'Lobe', 'Lyonga', 'Mbeng', 'Mbosso', 'Mile', 'Moki',
  'Muna', 'Ndum', 'Nfor', 'Ngassa', 'Ngeh', 'Ngole', 'Ngum', 'Nkeng', 'Nkwi',
  'Ntube', 'Nwana', 'Nyang', 'Orock', 'Tabi', 'Tafem', 'Tambe', 'Tata',
  'Ngom', 'Baye', 'Sali', 'Hamadou', 'Mballa', 'Eyanga', 'Ndongo'
];

const lastNames = [
  'Achuo', 'Ako', 'Ashu', 'Asobo', 'Ayuk', 'Bate', 'Besong', 'Buma',
  'Chiabi', 'Chinda', 'Ebai', 'Efeti', 'Ekaney', 'Ekane', 'Ekema', 'Epie',
  'Epule', 'Essame', 'Etame', 'Eyong', 'Fonkem', 'Fube', 'Jumbam', 'Kima', 'Kome',
  'Leke', 'Lobe', 'Lum', 'Lyonga', 'Mbeng', 'Mbongo', 'Mbosso', 'Mile', 'Mokube', 'Monju',
  'Mukete', 'Muna', 'Munteh', 'Nchanji', 'Ndip', 'Ndumbe', 'Nfor', 'Ngassa', 'Ngeh', 'Ngoe',
  'Ngole', 'Ngonde', 'Ngono', 'Ngum', 'Niba', 'Nkeng', 'Nkembe', 'Nkwi', 'Nsoh', 'Ntoko',
  'Ntube', 'Nwana', 'Nyang', 'Nyu', 'Oben', 'Orock', 'Tabi', 'Tafem', 'Taku', 'Tambe',
  'Tanga', 'Tata', 'Tazoh', 'Tita', 'Wanki', 'Nkrumah', 'Mensah', 'Boateng',
  'Biya', 'Mvondo', 'Ondoua', 'Zanga', 'Mballa', 'Beyala', 'Mongo', 'Essonba'
];

function pick(arr) { return arr[crypto.randomInt(arr.length)]; }

function randomDate(age) {
  const now = new Date();
  const birthYear = now.getFullYear() - age;
  const month = crypto.randomInt(1, 13);
  const day = crypto.randomInt(1, 29);
  return `${birthYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function run() {
  await poolConnect;

  // Delete existing data for clean reseed
  const tablesToClear = ['exam_results', 'academic_year_students', 'students'];
  for (const t of tablesToClear) {
    await pool.request().query(`DELETE FROM ${t}`);
    console.log(`Cleared ${t}`);
  }

  const classes = await pool.request().query('SELECT id, name, section, rank FROM classes ORDER BY id');
  const classList = classes.recordset;

  let total = 0;
  for (const cls of classList) {
    const classId = cls.id;
    const age = 10 + (cls.rank * 1);
    const count = cls.section === 'Francophone' ? 3 : 4;

    for (let i = 0; i < count; i++) {
      const firstName = pick(firstNames);
      const lastName = pick(lastNames);
      const middleName = Math.random() < 0.3 ? pick(middleNames) : null;
      const sex = i % 2 === 0 ? 'Male' : 'Female';
      const dob = randomDate(age);
      const yearOfEnrollment = 2025 - Math.max(0, cls.rank - 1);
      const matricule = `STU-${String(classId).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const hash = await bcrypt.hash(PASSWORD, 10);

      await pool.request().query(`
        INSERT INTO students (firstName, middleName, lastName, matricule, password, section, role, sex, dateOfBirth, yearOfEnrollment, currentClassLevel, isWithdrawn)
        VALUES (N'${firstName.replace(/'/g, "''")}',
                ${middleName ? `N'${middleName.replace(/'/g, "''")}'` : 'NULL'},
                N'${lastName.replace(/'/g, "''")}',
                '${matricule}', '${hash}', N'${cls.section}', 'student', '${sex}', '${dob}', ${yearOfEnrollment}, ${classId}, 0)
      `);
      total++;
    }
  }

  console.log(`\nSeeded ${total} students across ${classList.length} classes`);
  console.log(`Password: ${PASSWORD}`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
