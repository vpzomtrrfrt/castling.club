const createDebug = require("debug");

const debug = createDebug("chess:cache");

module.exports = ({ pg }) => {
  // Creates a Keyv compatible store.
  //
  // We don't use `@keyv/postgres`, because some of our caching uses the store
  // directly to store a different value type, and we get to reuse our pool.
  const createStore = name => ({
    async get(id) {
      const { rows } = await pg.query({
        name: `get ${name}`,
        text: `
          select data from ${name}
          where id = $1
        `,
        values: [id]
      });
      if (rows.length !== 0) {
        debug(`HIT ${name}: ${id}`);
        return rows[0].data;
      } else {
        debug(`MISS ${name}: ${id}`);
        return undefined;
      }
    },

    async set(id, data) {
      debug(`SET ${name}: ${id}`);
      await pg.query({
        name: `set ${name}`,
        text: `
          insert into ${name} (id, data)
            values ($1, $2)
          on conflict (id) do update
            set data = $2
        `,
        values: [id, data]
      });
      return this;
    },

    async delete(id) {
      debug(`DEL ${name}: ${id}`);
      const { rowCount } = await pg.query({
        name: `delete ${name}`,
        text: `
          delete from ${name}
          where id = $1
        `,
        values: [id]
      });
      return rowCount !== 0;
    },

    async clear() {
      debug(`CLEAR ${name}`);
      await pg.query({
        name: `clear ${name}`,
        text: `
          truncate table ${name}
        `
      });
    }
  });

  // Create default stores.
  return {
    draw: createStore("draw_cache"),
    http: createStore("http_cache")
  };
};
