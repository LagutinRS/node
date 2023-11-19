const md5 = require('md5');
const hash = (d) => md5(d);

exports.up = function(knex) {
  return knex("users")
    .insert({
      username: "admin",
      password: hash("pwd007")
    });
};

exports.down = function(knex) {
  return  knex("users")
          .where({ username: "admin" })
          .delete();
};
