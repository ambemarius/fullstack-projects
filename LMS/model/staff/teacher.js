const { sql, pool, poolConnect } = require('../../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

function buildFullName(firstName, middleName, lastName) {
    return [firstName, middleName, lastName].filter(Boolean).join(' ');
}

const TeacherModel = {
    _safeColumns: `id, name, firstName, middleName, lastName, email, phone, secondaryContactName, secondaryContactPhone, employmentType, section, status, role, createdAt, address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone, matriculeFile, school_id`,

    async create({ firstName, middleName, lastName, email, password, phone, secondaryContactName, secondaryContactPhone, employmentType, section, status, address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone, matriculeFile }) {
        await poolConnect;
        const name = buildFullName(firstName, middleName, lastName);
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
        if (employmentType === 'Government' && !matriculeFile) {
            const err = new Error('Matricule file is required for Government teachers');
            err.statusCode = 400;
            throw err;
        }

        const result = await pool.request()
            .input('name', sql.NVarChar(255), name)
            .input('firstName', sql.NVarChar(100), firstName)
            .input('middleName', sql.NVarChar(100), middleName || null)
            .input('lastName', sql.NVarChar(100), lastName)
            .input('email', sql.NVarChar(255), email)
            .input('password', sql.NVarChar(255), hashedPassword)
            .input('phone', sql.NVarChar(30), phone || null)
            .input('secondaryContactName', sql.NVarChar(200), secondaryContactName || null)
            .input('secondaryContactPhone', sql.NVarChar(30), secondaryContactPhone || null)
            .input('employmentType', sql.NVarChar(20), employmentType)
            .input('section', sql.NVarChar(20), section)
            .input('status', sql.NVarChar(20), status || 'active')
            .input('address', sql.NVarChar(300), address || null)
            .input('idCardNo', sql.NVarChar(50), idCardNo || null)
            .input('dateOfIssue', sql.Date, dateOfIssue || null)
            .input('gender', sql.NVarChar(10), gender || null)
            .input('civilStatus', sql.NVarChar(20), civilStatus || null)
            .input('noOfChildren', sql.Int, noOfChildren || null)
            .input('telephone', sql.NVarChar(30), telephone || null)
            .input('matricule', sql.NVarChar(255), matriculeFile || null)
            .query(`
                INSERT INTO teachers (name, firstName, middleName, lastName, email, password, phone, secondaryContactName, secondaryContactPhone, employmentType, section, status, address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone, matriculeFile)
                OUTPUT INSERTED.id, INSERTED.name, INSERTED.firstName, INSERTED.middleName, INSERTED.lastName,
                       INSERTED.email, INSERTED.phone, INSERTED.secondaryContactName, INSERTED.secondaryContactPhone,
                       INSERTED.employmentType, INSERTED.section, INSERTED.status, INSERTED.role, INSERTED.createdAt,
                       INSERTED.address, INSERTED.idCardNo, INSERTED.dateOfIssue, INSERTED.gender, INSERTED.civilStatus, INSERTED.noOfChildren, INSERTED.telephone, INSERTED.matriculeFile
                VALUES (@name, @firstName, @middleName, @lastName, @email, @password, @phone, @secondaryContactName, @secondaryContactPhone, @employmentType, @section, @status, @address, @idCardNo, @dateOfIssue, @gender, @civilStatus, @noOfChildren, @telephone, @matricule)
            `);
        return result.recordset[0];
    },

    async getAll() {
        await poolConnect;
        const result = await pool.request()
            .query(`SELECT ${this._safeColumns} FROM teachers ORDER BY lastName, firstName`);
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT ${this._safeColumns} FROM teachers WHERE id = @id`);
        return result.recordset[0] || null;
    },

    // Sign-in: every account with this email in an active school (optionally one school), with its password hash.
    async findAllForLogin(email, schoolId) {
        await poolConnect;
        const result = await pool.request()
            .input('email', sql.NVarChar(255), email)
            .input('school', sql.Int, schoolId ?? null)
            .query(`SELECT * FROM teachers WHERE email = @email AND school_id IN (SELECT id FROM schools WHERE status = 'active') AND (@school IS NULL OR school_id = @school)`);
        return result.recordset;
    },

    async findByEmail(email, schoolId) {
        await poolConnect;
        const result = await pool.request()
            .input('email', sql.NVarChar(255), email)
            .input('school', sql.Int, schoolId ?? null)
            .query('SELECT * FROM teachers WHERE email = @email AND (@school IS NULL OR school_id = @school)');
        return result.recordset[0] || null;
    },

    // True when the teacher has an active class subject whose subject is marked "Requires practicals".
    async teachesPracticals(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT CASE WHEN EXISTS (
                SELECT 1 FROM class_subject_teachers cst
                JOIN class_subjects cs ON cs.id = cst.class_subject_id
                JOIN subjects s ON s.id = cs.subject_id
                WHERE cst.teacher_id = @id AND cst.assignment_status = 'active' AND s.has_lab = 1) THEN 1 ELSE 0 END AS yes`);
        return result.recordset[0].yes === 1;
    },

    verifyPassword(plain, hash) {
        return bcrypt.compare(plain, hash);
    },

    async update(id, { firstName, middleName, lastName, phone, secondaryContactName, secondaryContactPhone, employmentType, section, status, address, idCardNo, dateOfIssue, gender, civilStatus, noOfChildren, telephone, matriculeFile }) {
        await poolConnect;
        const name = (firstName || middleName || lastName)
            ? buildFullName(
                firstName || undefined,
                middleName || undefined,
                lastName || undefined
              )
            : undefined;

        if (employmentType === 'Government' && !matriculeFile) {
            const existing = await this.findById(id);
            if (existing && !existing.matriculeFile) {
                const err = new Error('Matricule file is required for Government teachers');
                err.statusCode = 400;
                throw err;
            }
        }

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar(255), name)
            .input('firstName', sql.NVarChar(100), firstName)
            .input('middleName', sql.NVarChar(100), middleName)
            .input('lastName', sql.NVarChar(100), lastName)
            .input('phone', sql.NVarChar(30), phone)
            .input('secondaryContactName', sql.NVarChar(200), secondaryContactName)
            .input('secondaryContactPhone', sql.NVarChar(30), secondaryContactPhone)
            .input('employmentType', sql.NVarChar(20), employmentType)
            .input('section', sql.NVarChar(20), section)
            .input('status', sql.NVarChar(20), status)
            .input('address', sql.NVarChar(300), address)
            .input('idCardNo', sql.NVarChar(50), idCardNo)
            .input('dateOfIssue', sql.Date, dateOfIssue)
            .input('gender', sql.NVarChar(10), gender)
            .input('civilStatus', sql.NVarChar(20), civilStatus)
            .input('noOfChildren', sql.Int, noOfChildren)
            .input('telephone', sql.NVarChar(30), telephone)
            .input('matriculeFile', sql.NVarChar(255), matriculeFile)
            .query(`
                UPDATE teachers
                SET name                 = COALESCE(@name, name),
                    firstName            = COALESCE(@firstName, firstName),
                    middleName           = COALESCE(@middleName, middleName),
                    lastName             = COALESCE(@lastName, lastName),
                    phone                = COALESCE(@phone, phone),
                    secondaryContactName = COALESCE(@secondaryContactName, secondaryContactName),
                    secondaryContactPhone = COALESCE(@secondaryContactPhone, secondaryContactPhone),
                    employmentType       = COALESCE(@employmentType, employmentType),
                    section              = COALESCE(@section, section),
                    status               = COALESCE(@status, status),
                    address              = COALESCE(@address, address),
                    idCardNo             = COALESCE(@idCardNo, idCardNo),
                    dateOfIssue          = COALESCE(@dateOfIssue, dateOfIssue),
                    gender               = COALESCE(@gender, gender),
                    civilStatus          = COALESCE(@civilStatus, civilStatus),
                    noOfChildren         = COALESCE(@noOfChildren, noOfChildren),
                    telephone            = COALESCE(@telephone, telephone),
                    matriculeFile        = COALESCE(@matriculeFile, matriculeFile)
                WHERE id = @id;
                SELECT ${this._safeColumns} FROM teachers WHERE id = @id;
            `);
        return result.recordset[0] || null;
    },

    async setStatus(id, status) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar(20), status)
            .query("UPDATE teachers SET status = @status WHERE id = @id; SELECT @@ROWCOUNT AS changed");
    },

    // Teachers are referenced by classes, exams and timetables; withdrawing keeps that history intact
    // and both login and role middleware already refuse non-active accounts.
    async remove(id) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar(20), 'withdrawn')
            .query('UPDATE teachers SET status = @status WHERE id = @id');
    },
};

module.exports = TeacherModel;
