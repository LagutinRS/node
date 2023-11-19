const knexConfig = require('./knexfile');
const { nanoid } = require('nanoid');
const knex = require('knex')(knexConfig);

// Поиск пользователя по имени
const findUserByUsername = async (username) =>
  knex('users')
    .select()
    .where({ username: username })
    .first();

// Поиск пользователя по Id сессии
const findUserBySessionId = async (sessionId) => {
  const session = await knex('sessions')
    .select('userId')
    .where({ sessionId: sessionId })
    .first();

  if (!session) {
    return;
  }

  return knex('users')
    .select()
    .where({ id: session.userId })
    .first();
}

// Поиск пользователя по Id сессии
const findSessionByUserId = async (userId) => {
  const session = await knex('sessions')
    .select('sessionId')
    .where({ userId: userId })
    // .first();
    .then((result) => {
      if (result.length > 0) {
        return result[0].sessionId;
      }
    });

  if (!session) {
    return;
  }

  return session;
}

async function createSession(userId) {
  const sessionId = nanoid();

  return await knex('sessions')
    .insert({ userId: userId, sessionId: sessionId })
    .returning('sessionId')
    .then((result) => {
      return result[0].sessionId;
    });
}

// Middleware Авторизации
const auth = () => async (req, res, next) => {

  let authPrefix = 'Bearer ';
  if (!req.headers?.authorization || !req.headers?.authorization.startsWith(authPrefix)) {
    return next();
  }
  const token = (req.headers.authorization
      .substring(authPrefix.length)
  );
  // console.log(token);

  req.user = await findUserBySessionId(token);

  if (!req.user) {
    return next();
  }

  req.sessionId = token;
  next();
};

module.exports = {
  findUserByUsername,
  findUserBySessionId,
  findSessionByUserId,
  createSession,
  auth
}
