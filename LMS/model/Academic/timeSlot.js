const { sql, pool, poolConnect } = require('../../config/database');

const DEFAULT_SLOTS = [
    { slot: 1, start: '07:30', end: '08:30', break: false, order: 1 },
    { slot: 2, start: '08:30', end: '09:30', break: false, order: 2 },
    { slot: 3, start: '09:30', end: '10:15', break: false, order: 3 },
    { slot: 0, start: '10:15', end: '10:30', break: true, order: 4 },
    { slot: 4, start: '10:30', end: '11:30', break: false, order: 5 },
    { slot: 5, start: '11:30', end: '12:30', break: false, order: 6 },
    { slot: 6, start: '12:30', end: '13:15', break: false, order: 7 },
    { slot: 0, start: '13:15', end: '13:30', break: true, order: 8 },
    { slot: 7, start: '13:30', end: '14:30', break: false, order: 9 },
    { slot: 8, start: '14:30', end: '15:30', break: false, order: 10 },
];

const TimeSlotModel = {
    async createTable() {
        await poolConnect;
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'time_slots')
            CREATE TABLE time_slots (
                id          INT IDENTITY(1,1) PRIMARY KEY,
                slot_number INT NOT NULL,
                start_time  NVARCHAR(5) NOT NULL,
                end_time    NVARCHAR(5) NOT NULL,
                is_break    BIT NOT NULL DEFAULT 0,
                sort_order  INT NOT NULL
            );
        `);
    },

    async seed() {
        await poolConnect;
        const existing = await pool.request().query('SELECT COUNT(*) AS cnt FROM time_slots');
        if (existing.recordset[0].cnt > 0) return;

        for (const s of DEFAULT_SLOTS) {
            await pool.request()
                .input('slot', sql.Int, s.slot)
                .input('start', sql.NVarChar(5), s.start)
                .input('end', sql.NVarChar(5), s.end)
                .input('break', sql.Bit, s.break ? 1 : 0)
                .input('order', sql.Int, s.order)
                .query(`
                    INSERT INTO time_slots (slot_number, start_time, end_time, is_break, sort_order)
                    VALUES (@slot, @start, @end, @break, @order)
                `);
        }
    },

    async getAll() {
        await poolConnect;
        const result = await pool.request()
            .query('SELECT * FROM time_slots ORDER BY sort_order');
        return result.recordset;
    },

    async getTeaching() {
        await poolConnect;
        const result = await pool.request()
            .query("SELECT * FROM time_slots WHERE is_break = 0 ORDER BY sort_order");
        return result.recordset;
    },
};

module.exports = TimeSlotModel;
