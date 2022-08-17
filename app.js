const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => res.send('Hello World!'))
app.get('/foo/:bar', (req, res) => {
    // #1
    eval('console.log("something", ' + req.params.bar + ')');
    res.send(`Hello ${req.params.bar}`)
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
