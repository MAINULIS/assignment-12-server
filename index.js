const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send('Assignment 12 is pending..')
})


app.listen(port, () => {
    console.log(`Assignment-12 is running on port: ${port}`)
});