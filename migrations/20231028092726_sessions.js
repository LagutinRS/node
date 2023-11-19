exports.up = function(knex) {
  return  knex.schema.createTableIfNotExists("sessions", (table) => {
    table.increments("id");
    table.string("sessionId").notNullable().unique();
    table.integer("userId").notNullable();
    table.foreign("userId").references("users.id");
  });
};

exports.down = function(knex) {
  return  knex.schema.dropTableIfExists("sessions");
};
