const express = require('express');
const app = express();

app.get(/^\/api\/layers\/(.*)/, (req, res) => {
    console.log('Param 0:', req.params[0]);
    res.json({ param: req.params[0] });
});

console.log('Testing regex matching against: /api/layers/dir/file.shp');
// simulate express match
const regex = /^\/api\/layers\/(.*)/;
const match = '/api/layers/dir/file.shp'.match(regex);
console.log('Match result:', match[1]);
