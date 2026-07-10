import express from 'express';
const app = express();
app.get('/api/products/:codigo', (req, res) => res.send('OK ' + req.params.codigo));
app.listen(3002, () => console.log('started'));
