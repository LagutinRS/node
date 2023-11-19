require('dotenv').config();
const express = require('express');
const app = express();
require('express-ws')(app);

app.use(express.json());

//http
app.use('/', require('./auth'));
app.use('/api/timers', require('./api'));

//socket
app.use('/socket', require('./socket'));

//errors
app.use((err, req, res, next) => {
  res.status(500).send(err.message);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`  Listening on http://localhost:${port}`);
});
