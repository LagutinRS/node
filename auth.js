const { findUserByUsername, findSessionByUserId, createSession, auth} = require('./helpers');

const knexConfig = require('./knexfile');
const knex = require('knex')(knexConfig);

const express = require('express');
const routerAuth = express.Router();
const md5hash = require('md5');

routerAuth.post('/signup', async (req, res) => {

  //Если имя пользователя или пароль пустые или не переданы
  const { username, password } = req.query;
  if (username === '' || password === '') {
    return res.status(400).json({ error: 'Username and password cannot be empty.' });
  } else if (!username || !password) {
    return res.status(400).json({ error: 'Username and password must be set.' });
  }

  try {
    //Если пользователь с таким именем уже есть
    let user = await findUserByUsername(username);
    if (user) {
      return res.status(403).json({ error: 'User with this name already exists.' });
    }

    //Создаём пользователя
    user = await knex('users')
      .insert({ username: username, password: md5hash(password) })
      .returning('id')
      .then((result) => {
        return result[0];
      });

    //Создаём сессию
    const sessionId = await createSession(user.id)

    //Возвращаем ID сессии
    res.json({ sessionId });
  } catch (err) {
    res.status(500).json({ error: `${err.message}` });
  }
});

routerAuth.post('/login', async (req, res) => {

  //Если имя пользователя или пароль пустые или не переданы
  const { username, password } = req.query;
  if (username === '' || password === '') {
    return res.status(401).json({ error: 'Wrong username or password.' });
  } else if (!username || !password) {
    return res.status(400).json({ error: 'Username and password must be set.' });
  }

  try {

    //Если нет такого пользователя или пароль не подходит
    const user = await findUserByUsername(username);
    if (!user || user.password !== md5hash(password)) {
      return res.status(401).json({ error: 'Wrong username or password.' });
    }

    //Если у пользователя есть активная сессия, вернём её
    const sessionExist = await findSessionByUserId(user.id);
    if (sessionExist) {
      return res.json(sessionExist);
    }

    //Создаём новую сессию и возвращаем её ID
    const sessionId = await createSession(user.id);
    res.json({ sessionId });

  } catch (err) {
    res.status(500).json({ error: `${err.message}` });
  }
});

routerAuth.get('/logout', auth(), async (req, res) => {

  //Если пользователь не авторизован
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {

    //Удаляем сессию, возвращаем пустой объект
    await knex('sessions')
      .where({ sessionId: req.sessionId })
      .delete();
    res.json({});//.status(204)

  } catch (err) {
    res.status(500).json({ error: `${err.message}` });
  }
});

module.exports = routerAuth;
