const app = require('express')();
const bodyParser = require('body-parser');
const PORT = process.env.PORT || 5001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).send('Hello from Express!');
});

// Receive DLR from Vonage DLR
app.post('/from-dlr', (req, res) => {
  console.log('from-dlr:', req.body);
  res.status(200).send('OK');
});

app.post('/from-inbound', (req, res) => {
  console.log('from-inbound:', req.body);
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Express listening on port ${PORT}`);
});
