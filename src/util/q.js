const createDebug = require("debug");

const debug = createDebug("chess:query");

let _pg = null;

// Query the database. Use as a tagged template literal.
// Column names are transformed to camel-case.
//
// const { rows } = await q(pg)`
//   -- optional name of prepared statement
//   select * from "widgets" where "id" = ${widgetId}
// `
//
// (The prepared statement name *cannot* be dynamic.)
const q = pg => {
  _pg = pg;
  return _q;
};

const _q = async (strings, ...values) => {
  const pg = _pg;
  _pg = null;

  // Build the statement text.
  const { length } = values;
  let text = strings[0];
  for (let idx = 1; idx <= length; idx++) {
    text += `$${idx}`;
    text += strings[idx];
  }
  text = text.trim();

  // Extract the prepared statement name.
  let name;
  if (text.slice(0, 2) === "--") {
    const idx = text.indexOf("\n");
    name = text.slice(2, idx).trim();
    text = text.slice(idx + 1);
  }

  debug(name || "!UNNAMED!", values);
  const res = await pg.query({ name, text, values });

  // Rewrite fields and rows using camel-case.
  for (const field of res.fields) {
    field.rawName = field.name;
    field.name = fromUnderscored(field.rawName);
  }
  res.rows = res.rows.map(raw => {
    const out = {};
    for (const rawField in raw) {
      const outField = fromUnderscored(rawField);
      out[outField] = raw[rawField];
    }
    return out;
  });

  return res;
};

// Convert an underscored identifier to camel-case.
const fromUnderscored = input => {
  const parts = input.split("_");
  let out = parts.shift();
  for (const part of parts) {
    out += part[0].toUpperCase() + part.slice(1);
  }
  return out;
};

// Run the code block with a single connection.
q.withClient = async (pg, fn) => {
  if (pg.constructor.name === "Pool") {
    const client = await pg.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  } else {
    return fn(pg);
  }
};

// Run the code block within a transaction.
// Throw or return `false` to roll back the transaction.
q.transact = (pg, fn) => {
  return q.withClient(pg, async pg => {
    let res;
    await pg.query(`begin`);
    try {
      res = await fn(pg);
    } catch (err) {
      await pg.query("rollback");
      throw err;
    }
    await pg.query(res === false ? "rollback" : "commit");
  });
};

module.exports = q;
