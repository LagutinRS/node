// const md5 = require('md5');
// const hash = (d) => md5(d);

exports.up = function(knex) {

  return createUsersTable();
    // .then(createDefaultUser);

  function createUsersTable() {
    return  knex.schema.createTableIfNotExists("users", (table) => {
      table.increments("id");
      table.string("username", 255).notNullable().unique();
      table.string("password", 255).notNullable();
    });
  }

  // function createDefaultUser() {
  //   knex("users").insert({
  //     username: "admin",
  //     password: hash("pwd007")
  //   });
  // }
};

exports.down = function(knex) {
  return  knex.schema.dropTable("users");
};
