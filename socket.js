const { findUserByUsername, findSessionByUserId, createSession } = require('./helpers');

const express = require('express');
const md5hash = require('md5');
const routerSocket = express.Router();

const knexConfig = require('./knexfile');
const knex = require('knex')(knexConfig);

const clients = new Map();

function checkAuthData(data, ws) {
  //Если имя пользователя или пароль пустые или не переданы
  const { username, password } = data;
  if (username.trim() === '' || password.trim() === '') {
    return ws.send(JSON.stringify({
      type: 'auth_error',
      error: 'Username and password cannot be empty.'
    }));
  } else if (!username || !password) {
    return ws.send(JSON.stringify({
      type: 'auth_error',
      error: 'Username and password must be set.'
    }));
  }
  return { username, password };
}

function sendError(err, ws) {
  return ws.send(JSON.stringify({
    type: 'error',
    error: err.message
  }));
}

async function checkAuth(data) {
  const { token } = data;

  if (!token) {
    return {
      type: 'error',
      error: 'Missing token.'
    };
  }

  try {
    const tokenCheck = await knex('sessions')
      .where({sessionId: token});

    if (tokenCheck.length === 0) {
      return {
        type: 'error',
        error: 'Invalid token.'
      };
    } else {
      return {
        type: 'ok',
        token,
        userId: tokenCheck[0].userId
      };
    }

  } catch (err) {
    return {
      type: 'error',
      error: err.message
    };
  }
}

async function sendTables(ws, userId) {

  try {

    const active = await knex('timers')
      .where({ userId: userId, isActive: true });

    for (let timer of active) {
      timer.progress = Math.round((new Date() - new Date(timer.start)) / 1000);
    }

    const old = await knex('timers')
      .where({ userId: userId, isActive: false });

    for (let timer of old) {
      timer.duration = Math.round((new Date(timer.end) - new Date(timer.start)) / 1000);
    }

    const timers = { active, old };

    //Возвращаем клиенту таблицу со всеми таймерами
    ws.send(JSON.stringify({
      type: 'all_timers',
      timers
    }));

  } catch(err) {
    sendError(err, ws);
  }
}

// Обновление прогресса активных таймеров
setInterval(async () => {
  try {
    for (const userId of clients.keys()) {

      const timers = await knex('timers')
        .where({ userId: userId,  isActive: true });

      for (const timer of timers) {
        timer.progress = Math.round(
          (new Date() - new Date(timer.start)) / 1000
        );
      }

      clients.get(userId).send(JSON.stringify({
        type: 'active_timers',
        timers
      }));
    }
  } catch(err) {
    console.error(err);
  }
}, 1000);

routerSocket.ws('/', (ws) => {

  // console.log('WebSocket connection established');

  ws.on('message', async (message) => {
    let data;

    try {
      data = JSON.parse(message);
    } catch (err) {
      return;
    }

    switch (data.type) {
      case 'signup':
      {
        try {
          const checkResult = checkAuthData(data, ws);

          if (checkResult !== undefined) {
            const { username, password } = checkResult;
            let user = await findUserByUsername(username);

            //Если пользователь с таким именем уже есть
            if (user) {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'User with this name already exists.'
              }));
              return;
            }

            //Создаём пользователя
            user = await knex('users')
              .insert({ username: username, password: md5hash(password) })
              .returning('id')
              .then((result) => {
                return result[0];
              });

            //Создаём сессию
            const token = await createSession(user.id)

            //Связываем ws-клиент с id пользователя
            clients.set(user.id, ws);

            //Возвращаем ID сессии
            ws.send(JSON.stringify({
              type: 'auth_success',
              token
            }));

            await sendTables(ws, user.id);
          }
        } catch (err) {
          sendError(err, ws);
        }
      }
      break;
      case 'login':
      {
        try {
          const checkResult = checkAuthData(data, ws);

          if (checkResult !== undefined) {
            const { username, password } = checkResult;
            const user = await findUserByUsername(username);

            //Если нет такого пользователя или пароль не подходит
            if (!user || user.password !== md5hash(password)) {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Wrong username or password.'
              }));
              return;
            }

            let token = await findSessionByUserId(user.id);
            //Если у пользователя есть активная сессия, вернём её
            if (token) {
              ws.send(JSON.stringify({
                type: 'auth_success',
                token
              }));
            //Если нет, создаём новую сессию и возвращаем её ID
            } else {
              token = await createSession(user.id);
              if (token) {
                ws.send(JSON.stringify({
                  type: 'auth_success',
                  token
                }));
              }
            }

            //Связываем ws-клиент с id пользователя
            clients.set(user.id, ws);

            //Отправляем таблицы с таймерами клиенту
            await sendTables(ws, user.id);
          }
        } catch (err) {
          sendError(err, ws);
        }
      }
      break;
      case 'logout':
      {
        try {
          const checkResult = await checkAuth(data);
          if (checkResult.type === 'ok') {
            //Удаляем сессию
            await knex('sessions')
              .where({ sessionId: checkResult.token })
              .delete();
            ws.send(JSON.stringify({
              type: 'logout_success',
            }));
          } else {
            ws.send(JSON.stringify(checkResult));
          }
        } catch (err) {
          sendError(err, ws);
        }
      }
      break;
      case 'start': {
        try {
          const checkResult = await checkAuth(data);

          if (checkResult.type === 'ok') {
            const { description } = data;

            if (!description) {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Wrong request.'
              }));
              return;
            }

            if (description.trim() === '') {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Description cannot be empty.'
              }));
              return;
            }

            const check = await knex('timers')
              .where({ userId: checkResult.userId, description: description, isActive: true });

            if (check.length > 0) {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Active timer with this description already exists.'
              }));
              return;
            }

            await knex('timers')
              .insert({
                userId: checkResult.userId,
                start: new Date(Date.now()),
                description: description,
                isActive: true
              })
              .then(() => {
                ws.send(JSON.stringify({
                  type: 'start_success'
                }));
              });

            await sendTables(ws, checkResult.userId);

          } else {
            ws.send(JSON.stringify(checkResult));
          }
        } catch (err) {
          sendError(err, ws);
        }
      }
      break;
      case 'stop':
      {
        try {
          const checkResult = await checkAuth(data);

          if (checkResult.type === 'ok') {
            const { id } = data;

            if (!id) {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Wrong request.'
              }));
              return;
            }

            if (id.trim() === '') {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Timer id cannot be empty.'
              }));
              return;
            }

            const end = new Date();
            const result = await knex('timers')
              .where({ userId: checkResult.userId, id: id, isActive: true })
              .update({ isActive: false, end: end})
              .returning('id')
              .then((result) => {
                if (result.length === 0) {
                  ws.send(JSON.stringify({
                    type: 'error',
                    error: 'Unknown timer ID or timer is already disabled'
                  }));
                  return false;
                }
                ws.send(JSON.stringify({
                  type: 'stop_success'
                }));
                return true;
              });

            if (result) {
              await sendTables(ws, checkResult.userId);
            }

          } else {
            ws.send(JSON.stringify(checkResult));
          }
        } catch (err) {
          sendError(err, ws);
        }
      }
      break;
      default: ws.send(JSON.stringify({
                 type: 'error',
                 error: 'Unknown command.'
               }));
    }
  });

  //При отключении клиента удалим его из clients
  ws.on('close', () => {
    for (const userId of clients.keys()) {
      if (clients.get(userId) === ws) {
        clients.delete(userId);
      }
    }
  });

});

module.exports = routerSocket;
