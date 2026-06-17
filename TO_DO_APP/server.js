const express = require('express')
const app = express()
const MongoClient = require('mongodb').MongoClient
require('dotenv').config()

const PORT = process.env.PORT || 2121

console.log('--- SERVER STARTING VERSION 3.1 ---')

const dbConnectionStr = process.env.DB_STRING || 'mongodb+srv://mariusengineer927_db_user:CkXFikrNVnLjfx7b@to-dodb.v7prb0o.mongodb.net/to-dodb?retryWrites=true&w=majority&appName=to-dodb'
const dbName = 'to-dodb'
let db

MongoClient.connect(dbConnectionStr)
    .then(client => {
        console.log(`DATABASE STATUS: CONNECTED`)
        db = client.db(dbName)
        
        app.listen(PORT, () => {
            console.log(`SERVER STATUS: RUNNING ON PORT ${PORT}`)
        })
    })
    .catch(error => {
        console.error('DATABASE STATUS: CONNECTION FAILED', error)
    })

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.get('/', async (req, res) => {
    console.log('--- HANDLING GET / ---')
    
    if (!db) {
        console.log('ERROR: Database connection not ready')
        return res.status(500).send('Database connection not ready')
    }

    try {
        const todoItems = await db.collection('todos').find().toArray()
        const itemsLeft = await db.collection('todos').countDocuments({ completed: false })
        
        console.log(`DATA FETCHED: ${todoItems.length} items found`)
        
        res.render('index.ejs', { 
            items: todoItems || [], 
            left: itemsLeft || 0 
        })
    } catch (err) {
        console.error('FETCH ERROR:', err)
        res.status(500).send('Error retrieving data from database')
    }
})

app.post('/addTodo', (req, res) => {
    console.log('--- HANDLING POST /addTodo ---')
    db.collection('todos').insertOne({ thing: req.body.todoItem, completed: false })
        .then(result => {
            console.log('TODO ADDED')
            res.redirect('/')
        })
        .catch(err => console.error(err))
})

app.put('/markComplete', (req, res) => {
    db.collection('todos').updateOne({thing: req.body.itemFromJS},{$set: {completed: true}},{sort: {_id: -1},upsert: false})
        .then(result => res.json('Marked Complete'))
        .catch(err => console.error(err))
})

app.put('/markUnComplete', (req, res) => {
    db.collection('todos').updateOne({thing: req.body.itemFromJS},{$set: {completed: false}},{sort: {_id: -1},upsert: false})
        .then(result => res.json('Marked Complete'))
        .catch(err => console.error(err))
})

app.delete('/deleteItem', (req, res) => {
    db.collection('todos').deleteOne({thing: req.body.itemFromJS})
        .then(result => res.json('Todo Deleted'))
        .catch(err => console.error(err))
})
