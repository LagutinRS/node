const knexConfig = require('./knexfile');
const { auth } = require('./helpers');

const knex = require('knex')(knexConfig);
const express = require('express');
const routerApi = express.Router();

// Получаем выборку активных/неактивных таймеров
routerApi.get('/', auth(), async (req, res) => {
  if (!req.user) {
    return res.sendStatus(401);
  }

  const isActive = req.query.isActive;

  if (!isActive) {
    return res.sendStatus(400);
  }

  try {
    if (isActive === 'true') {

      res.json(await knex('timers')
        .where({ userId: req.user.id, isActive: true }));

    } else if (isActive === 'false') {

      res.json(await knex('timers')
        .where({ userId: req.user.id, isActive: false }));

    } else {
      res.sendStatus(400);
    }
  } catch (err) {
    res.status(500).json({ error: `${err.message}` });
  }
});

// Возвращаем информацию о таймере по id
routerApi.get('/:id', auth(), async (req, res) => {
  if (!req.user) {
    return res.sendStatus(401);
  }

  try {

    res.json(await knex('timers')
      .where({ userId: req.user.id, id: req.params.id }));

  } catch (err) {
    res.status(500).json({ error: `${err.message}` });
  }
});

// Запускаем новый таймер
routerApi.post('/', auth(), async (req, res) => {
  if (!req.user) {
    return res.sendStatus(401);
  }

  const { description } = req.body;

  if (!description) {
    return res.sendStatus(400);
  }

  try {

    const check = await knex('timers')
      .where({ userId: req.user.id, description: description, isActive: true });

    if (check.length > 0) {
      return res.status(403).json({ error: 'Active timer with this description already exists.' })
    }

    const result = await knex('timers')
      .insert({ userId: req.user.id, start: new Date(Date.now()), description: description, isActive: true })
      .returning('id');

    res.json({ id: result[0].id });

  } catch (err) {
    res.status(500).json({ error: `${err.message}` });
  }
});

// Останавливаем активный таймер
routerApi.post('/:id/stop', auth(), async (req, res) => {
  if (!req.user) {
    return res.sendStatus(401);
  }

  const end = new Date();

  try {

    const result = await knex('timers')
      .where({ userId: req.user.id, id: req.params.id, isActive: true })
      .update({ isActive: false, end: end})
      .returning('id');

    if (result.length === 0) {
      return res.status(404).json({ error: 'Unknown timer ID or timer is already disabled' });
    }

    res.json({ id: result[0].id });

  } catch (err) {
    res.status(500).json({ error: `${err.message}` });
  }
});

module.exports = routerApi;
