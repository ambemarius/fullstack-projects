require('dotenv').config()
const http = require('http')
const app = require('./app/app')
const { poolConnect } = require('./config/database')
const Admin = require('./model/staff/admin')

const PORT = process.env.PORT || 2026
const server = http.createServer(app)

// Fail clearly if the port is already taken (instead of an ugly stack trace)
server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\nPort ${PORT} is already in use — another server is still running.`)
        console.error(`Stop it first, e.g. (PowerShell):`)
        console.error(`  Get-NetTCPConnection -LocalPort ${PORT} -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }\n`)
    } else {
        console.error('Server error:', err)
    }
    process.exit(1)
})

poolConnect
    .then(async () => {
        await Admin.createTable()
        server.listen(PORT, () => {
            console.log(`Server running on PORT ${PORT}`)
        })
    })
    .catch(err => {
        console.error('Database connection failed:', err)
        process.exit(1)
    })
