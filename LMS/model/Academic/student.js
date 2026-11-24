const { sql, pool, poolConnect } = require('../../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const FEE_TYPES = ['Registration', 'IDCard', 'Tuition', 'PTA', 'Sportware', 'Practicals', 'IT', 'Examination', 'Textbook'];

function normalizePhone(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('237')) digits = digits.slice(3);
    if (digits.length === 0) return null;
    if (digits.length !== 9) throw new Error('Phone must be exactly 9 digits after +237');
    return '+237' + digits;
}

const StudentModel = {
    _safeColumns: `s.id, s.firstName, s.middleName, s.lastName, s.matricule, s.section, s.role,
                   s.dateOfBirth, s.sex, s.yearOfEnrollment,
                   s.academicYearId, s.currentClassLevel, s.isWithdrawn, s.promoted,
                   s.address, s.placeOfBirth, s.regionOfOrigin, s.division,
                   s.parentName, s.parentPhone, s.parentPhone2, s.medicalStatus, s.createdAt, s.school_id`,

    async create({ firstName, middleName, lastName, matricule, password, section, dateOfBirth, sex, yearOfEnrollment, academicYearId, currentClassLevel, address, placeOfBirth, regionOfOrigin, division, parentName, parentPhone, parentPhone2, medicalStatus }) {
        await poolConnect;
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const result = await pool.request()
            .input('firstName', sql.NVarChar(100), firstName)
            .input('middleName', sql.NVarChar(100), middleName || null)
            .input('lastName', sql.NVarChar(100), lastName)
            .input('matricule', sql.NVarChar(50), matricule)
            .input('password', sql.NVarChar(255), hashedPassword)
            .input('section', sql.NVarChar(20), section)
            .input('dateOfBirth', sql.Date, dateOfBirth || null)
            .input('sex', sql.NVarChar(10), sex)
            .input('yearOfEnrollment', sql.Int, yearOfEnrollment || null)
            .input('academicYearId', sql.Int, academicYearId || null)
            .input('currentClassLevel', sql.Int, currentClassLevel || null)
            .input('address', sql.NVarChar(200), address || null)
            .input('placeOfBirth', sql.NVarChar(100), placeOfBirth || null)
            .input('regionOfOrigin', sql.NVarChar(100), regionOfOrigin || null)
            .input('division', sql.NVarChar(100), division || null)
            .input('parentName', sql.NVarChar(200), parentName || null)
            .input('parentPhone', sql.NVarChar(15), normalizePhone(parentPhone))
            .input('parentPhone2', sql.NVarChar(15), normalizePhone(parentPhone2))
            .input('medicalStatus', sql.NVarChar(200), medicalStatus || null)
            .query(`
                INSERT INTO students (firstName, middleName, lastName, matricule, password, section, dateOfBirth, sex, yearOfEnrollment, academicYearId, currentClassLevel, address, placeOfBirth, regionOfOrigin, division, parentName, parentPhone, parentPhone2, medicalStatus)
                OUTPUT INSERTED.id, INSERTED.firstName, INSERTED.middleName, INSERTED.lastName,
                       INSERTED.matricule, INSERTED.section, INSERTED.dateOfBirth, INSERTED.sex,
                       INSERTED.yearOfEnrollment, INSERTED.role, INSERTED.academicYearId,
                       INSERTED.currentClassLevel, INSERTED.isWithdrawn, INSERTED.promoted,
                       INSERTED.address, INSERTED.placeOfBirth, INSERTED.regionOfOrigin, INSERTED.division,
                       INSERTED.parentName, INSERTED.parentPhone, INSERTED.parentPhone2, INSERTED.medicalStatus, INSERTED.createdAt
                VALUES (@firstName, @middleName, @lastName, @matricule, @password, @section,
                        @dateOfBirth, @sex, @yearOfEnrollment, @academicYearId, @currentClassLevel,
                        @address, @placeOfBirth, @regionOfOrigin, @division,
                        @parentName, @parentPhone, @parentPhone2, @medicalStatus)
            `);
        return result.recordset[0];
    },

    async getAll() {
        await poolConnect;
        const result = await pool.request()
            .query(`SELECT ${this._safeColumns},
                          ay.name AS academicYearName
                   FROM students s
                   LEFT JOIN academic_years ay ON ay.id = s.academicYearId
                   ORDER BY s.lastName, s.firstName`);
        return result.recordset;
    },

    async getAllFull() {
        await poolConnect;
        const result = await pool.request()
            .query(`SELECT ${this._safeColumns}, c.name AS className, c.stream AS classStream, c.section AS classSection,
                           ay.name AS academicYearName
                    FROM students s
                    LEFT JOIN classes c ON c.id = s.currentClassLevel
                    LEFT JOIN academic_years ay ON ay.id = s.academicYearId
                    ORDER BY s.lastName, s.firstName`);
        return result.recordset;
    },

    async findById(id) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`SELECT ${this._safeColumns},
                           ay.name AS academicYearName
                    FROM students s
                    LEFT JOIN academic_years ay ON ay.id = s.academicYearId
                    WHERE s.id = @id`);
        return result.recordset[0] || null;
    },

    async getForTeacher(teacherId) {
        await poolConnect;
        const result = await pool.request()
            .input('teacherId', sql.Int, teacherId)
            .query(`
                SELECT ${this._safeColumns},
                       ay.name AS academicYearName
                FROM students s
                LEFT JOIN academic_years ay ON ay.id = s.academicYearId
                WHERE s.isWithdrawn = 0
                  AND s.currentClassLevel IN (
                    SELECT DISTINCT cs.class_id
                    FROM class_subject_teachers cst
                    JOIN class_subjects cs ON cs.id = cst.class_subject_id
                    WHERE cst.teacher_id = @teacherId
                )
                ORDER BY lastName, firstName
            `);
        return result.recordset;
    },

    async findByMatricule(matricule, schoolId) {
        await poolConnect;
        const result = await pool.request()
            .input('matricule', sql.NVarChar(50), matricule)
            .input('school', sql.Int, schoolId ?? null)
            .query('SELECT * FROM students WHERE matricule = @matricule AND (@school IS NULL OR school_id = @school)');
        return result.recordset[0] || null;
    },

    verifyPassword(plain, hash) {
        return bcrypt.compare(plain, hash);
    },

    async update(id, { firstName, middleName, lastName, section, dateOfBirth, sex, yearOfEnrollment, currentClassLevel, academicYearId, address, placeOfBirth, regionOfOrigin, division, parentName, parentPhone, parentPhone2, medicalStatus, isWithdrawn }) {
        await poolConnect;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('firstName', sql.NVarChar(100), firstName)
            .input('middleName', sql.NVarChar(100), middleName)
            .input('lastName', sql.NVarChar(100), lastName)
            .input('section', sql.NVarChar(20), section)
            .input('dateOfBirth', sql.Date, dateOfBirth)
            .input('sex', sql.NVarChar(10), sex)
            .input('yearOfEnrollment', sql.Int, yearOfEnrollment)
            .input('currentClassLevel', sql.Int, currentClassLevel)
            .input('academicYearId', sql.Int, academicYearId)
            .input('address', sql.NVarChar(200), address)
            .input('placeOfBirth', sql.NVarChar(100), placeOfBirth)
            .input('regionOfOrigin', sql.NVarChar(100), regionOfOrigin)
            .input('division', sql.NVarChar(100), division)
            .input('parentName', sql.NVarChar(200), parentName)
            .input('parentPhone', sql.NVarChar(15), normalizePhone(parentPhone))
            .input('parentPhone2', sql.NVarChar(15), normalizePhone(parentPhone2))
            .input('medicalStatus', sql.NVarChar(200), medicalStatus)
            .input('isWithdrawn', sql.Bit, isWithdrawn === undefined ? null : (isWithdrawn ? 1 : 0))
            .query(`
                UPDATE students
                SET firstName  = COALESCE(@firstName, firstName),
                    middleName = COALESCE(@middleName, middleName),
                    lastName   = COALESCE(@lastName, lastName),
                    section    = COALESCE(@section, section),
                    dateOfBirth = COALESCE(@dateOfBirth, dateOfBirth),
                    sex        = COALESCE(@sex, sex),
                    yearOfEnrollment = COALESCE(@yearOfEnrollment, yearOfEnrollment),
                    currentClassLevel = COALESCE(@currentClassLevel, currentClassLevel),
                    academicYearId = COALESCE(@academicYearId, academicYearId),
                    address    = COALESCE(@address, address),
                    placeOfBirth = COALESCE(@placeOfBirth, placeOfBirth),
                    regionOfOrigin = COALESCE(@regionOfOrigin, regionOfOrigin),
                    division   = COALESCE(@division, division),
                    parentName = COALESCE(@parentName, parentName),
                    parentPhone = COALESCE(@parentPhone, parentPhone),
                    parentPhone2 = COALESCE(@parentPhone2, parentPhone2),
                    medicalStatus = COALESCE(@medicalStatus, medicalStatus),
                    isWithdrawn = COALESCE(@isWithdrawn, isWithdrawn)
                WHERE id = @id;
                SELECT ${this._safeColumns},
                       ay.name AS academicYearName
                FROM students s
                LEFT JOIN academic_years ay ON ay.id = s.academicYearId
                WHERE s.id = @id;
            `);
        return result.recordset[0] || null;
    },

    async setWithdrawn(id, value = true) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .input('value', sql.Bit, value ? 1 : 0)
            .query('UPDATE students SET isWithdrawn = @value WHERE id = @id');
    },

    async setPromoted(id, value = true) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .input('value', sql.Bit, value ? 1 : 0)
            .query('UPDATE students SET promoted = @value WHERE id = @id');
    },

    async getByClass(classId) {
        await poolConnect;
        const result = await pool.request()
            .input('classId', sql.Int, classId)
            .query(`SELECT ${this._safeColumns},
                          ay.name AS academicYearName
                   FROM students s
                   LEFT JOIN academic_years ay ON ay.id = s.academicYearId
                   WHERE s.currentClassLevel = @classId AND s.isWithdrawn = 0
                   ORDER BY s.lastName, s.firstName`);
        return result.recordset;
    },

    // ---- Student Fees ----
    async saveFees(studentId, fees) {
        await poolConnect;
        for (const fee of fees) {
            await pool.request()
                .input('student_id', sql.Int, studentId)
                .input('fee_type', sql.NVarChar(50), fee.fee_type)
                .input('amount', sql.Decimal(10,2), fee.amount ?? 0)
                .input('paid', sql.Bit, fee.paid ? 1 : 0)
                .query(`
                    MERGE student_fees AS target
                    USING (SELECT @student_id AS student_id, @fee_type AS fee_type) AS source
                    ON target.student_id = source.student_id AND target.fee_type = source.fee_type
                    WHEN MATCHED THEN UPDATE SET amount = @amount, paid = @paid
                    WHEN NOT MATCHED THEN INSERT (student_id, fee_type, amount, paid) VALUES (@student_id, @fee_type, @amount, @paid);
                `);
        }
    },

    async getFees(studentId) {
        await poolConnect;
        const result = await pool.request()
            .input('student_id', sql.Int, studentId)
            .query('SELECT fee_type, amount, paid FROM student_fees WHERE student_id = @student_id');
        return result.recordset;
    },

    async promoteClass(classId, academicYearId, { minAverage, term } = {}) {
        await poolConnect;
        const students = await this.getByClass(classId);
        const currentClass = await (require('./class')).findById(classId);
        if (!currentClass) throw new Error('Class not found');

        const passMin = minAverage ?? (currentClass.section === 'Francophone' ? 10 : 50);

        let studentAverages = new Map();
        if (term && academicYearId) {
            const result = await pool.request()
                .input('classId', sql.Int, classId)
                .input('term', sql.NVarChar(10), term)
                .input('yearId', sql.Int, academicYearId)
                .query(`
                    SELECT s.id AS studentId,
                           AVG((ISNULL(ss1.score,0) + ISNULL(ss2.score,0)) /
                               (CASE WHEN ss1.score IS NOT NULL AND ss2.score IS NOT NULL THEN 2.0
                                     WHEN ss1.score IS NOT NULL OR ss2.score IS NOT NULL THEN 1.0
                                     ELSE 1.0 END)) AS avg_score
                    FROM students s
                    JOIN class_subjects cs ON cs.class_id = s.currentClassLevel
                    LEFT JOIN subject_scores ss1 ON ss1.student_id = s.id
                        AND ss1.class_subject_id = cs.id AND ss1.academic_year_id = @yearId
                        AND ss1.term = @term AND ss1.sequence = 1
                    LEFT JOIN subject_scores ss2 ON ss2.student_id = s.id
                        AND ss2.class_subject_id = cs.id AND ss2.academic_year_id = @yearId
                        AND ss2.term = @term AND ss2.sequence = 2
                    WHERE s.currentClassLevel = @classId AND s.isWithdrawn = 0
                      AND (ss1.score IS NOT NULL OR ss2.score IS NOT NULL)
                    GROUP BY s.id
                `);
            for (const r of result.recordset) {
                studentAverages.set(r.studentId, parseFloat(r.avg_score));
            }
        }

        const nextRank = currentClass.rank + 1;
        let promoted = 0, graduated = 0, retained = 0, errors = [];

        for (const student of students) {
            try {
                const avg = studentAverages.get(student.id);
                if (term && academicYearId && (avg === undefined || avg < passMin)) {
                    retained++;
                    errors.push(`${student.firstName} ${student.lastName}: average ${avg !== undefined ? avg.toFixed(2) : 'N/A'} below minimum ${passMin}`);
                    continue;
                }

                if (currentClass.rank >= 7) {
                    await this.setPromoted(student.id, true);
                    graduated++;
                } else {
                    const nextClassReq = pool.request()
                        .input('section', sql.NVarChar(20), currentClass.section)
                        .input('stream', sql.NVarChar(20), currentClass.stream)
                        .input('rank', sql.Int, nextRank);
                    const nextClassResult = await nextClassReq.query(`
                        SELECT id FROM classes
                        WHERE section = @section AND rank = @rank
                          AND ((stream IS NULL AND @stream IS NULL) OR stream = @stream)
                    `);
                    const nextClass = nextClassResult.recordset[0];
                    if (!nextClass) {
                        errors.push(`${student.firstName} ${student.lastName}: no next class found`);
                        continue;
                    }
                    await pool.request()
                        .input('studentId', sql.Int, student.id)
                        .input('nextClassId', sql.Int, nextClass.id)
                        .input('yearId', sql.Int, academicYearId)
                        .query(`
                            UPDATE students
                            SET currentClassLevel = @nextClassId,
                                academicYearId = @yearId,
                                promoted = 1
                            WHERE id = @studentId
                        `);
                    promoted++;
                }
            } catch (err) {
                errors.push(`${student.firstName} ${student.lastName}: ${err.message}`);
            }
        }
        return { promoted, graduated, retained, errors, passMinimum: passMin };
    },

    // A student's marks, fees and enrolments cascade on hard delete; withdrawal keeps the record.
    async remove(id) {
        await poolConnect;
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE students SET isWithdrawn = 1 WHERE id = @id');
    },
};

StudentModel.normalizePhone = normalizePhone;

module.exports = StudentModel;
