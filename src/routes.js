import { Router } from 'express';
import UserController from './app/controllers/UserController';

const routes = new Router();

routes.get('/', (req, res) => {
  return res.json({ message: 'ok' });
});

routes.post('/users', UserController.store);
// routes.put('/users', UserController.update);

export default routes;
