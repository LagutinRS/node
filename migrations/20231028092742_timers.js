exports.up = function(knex) {
  return  knex.schema.createTableIfNotExists("timers", (table) => {
    table.increments("id");
    table.integer("userId").notNullable();
    table.foreign("userId").references("users.id");
    table.string("description", 255).notNullable();
    table.boolean("isActive").defaultTo(true);
    table.timestamp("start", { precision: 0, useTz: false });
    table.timestamp("end", { precision: 0, useTz: false });
  });
};

exports.down = function(knex) {
  return  knex.schema.dropTableIfExists("timers");
};
