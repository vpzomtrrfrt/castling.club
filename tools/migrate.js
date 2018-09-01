#!/usr/bin/env node

// A simple PostgreSQL migration runner.

const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

dotenv.config();

const noop = () => {};
const baseDir = path.resolve(__dirname, "../migrations");

class Runner {
  constructor(pg = null) {
    this.pg = pg;
  }

  async init() {
    if (!this.pg) {
      this.pg = new Client();
      await this.pg.connect();
    }

    await this.pg.query(`
      create table if not exists "migrations" (
        "name" text primary key,
        "stamp" timestamp not null
      )
    `);
  }

  async destroy() {
    if (this.pg) {
      this.pg.end();
      this.pg = null;
    }
  }

  async list() {
    const allFiles = await new Promise((resolve, reject) => {
      fs.readdir(baseDir, (err, list) => {
        err ? reject(err) : resolve(list);
      });
    });

    const files = allFiles.filter(name => /^\d{3}_.+\.js$/.test(name)).sort();

    const { rows } = await this.pg.query({
      text: 'select "name", "stamp" from "migrations" order by "stamp" asc'
    });

    return files.map(name => {
      const row = rows.find(row => row.name === name);
      return row || { name, stamp: null };
    });
  }

  async run(dir, rows, opts = {}) {
    for (const row of rows) {
      await this.pg.query("begin");
      try {
        await (opts.before || noop)(dir, row);
        const file = path.join(baseDir, row.name);
        const mod = require(file);
        await mod[dir]({ pg: this.pg });
        await (opts.after || noop)(dir, row);
      } catch (err) {
        await this.pg.query("rollback");
        throw err;
      }
      await this.pg.query("commit");
    }
  }

  async up(opts = {}) {
    const rows = await this.list();
    const stamp = new Date();
    const todo = rows.filter(row => !row.stamp);
    await this.run(
      "up",
      todo,
      Object.assign({}, opts, {
        after: async (dir, row) => {
          await this.pg.query({
            text: 'insert into "migrations" ("name", "stamp") values ($1, $2)',
            values: [row.name, stamp]
          });
          return (opts.after || noop)();
        }
      })
    );
    return todo;
  }

  async down(opts = {}) {
    const rows = await this.list();
    const stamp = Math.max(...rows.map(row => row.stamp.getTime()));
    const todo = rows.filter(row => row.stamp.getTime() === stamp);
    await this.run(
      "down",
      todo,
      Object.assign({}, opts, {
        after: async (dir, row) => {
          await this.pg.query({
            text: 'delete from "migrations" where "name" = $1',
            values: [row.name]
          });
          return (opts.after || noop)();
        }
      })
    );
    return todo;
  }
}

module.exports = Runner;

if (require.main === module) {
  const main = async () => {
    require("dotenv").config();

    const runner = new Runner();
    try {
      await runner.init();

      const cmd = process.argv[2];
      if (cmd === "up" || cmd === "down") {
        const rows = await runner[cmd]({
          before: (dir, row) => {
            console.log(`${row.name} ${dir}...`);
          }
        });
        console.log(`Ran ${rows.length} migration(s)`);
      } else if (cmd === "list") {
        const rows = await runner.list();
        console.log("Migration listing:");
        for (const row of rows) {
          if (row.stamp) {
            console.log(` - ${row.name},  ${row.stamp || "-"}`);
          } else {
            console.log(` - ${row.name}`);
          }
        }
      } else {
        console.log(`Usage: ${process.argv[1]} [list|up|down]`);
        process.exit(64);
      }
    } finally {
      runner.destroy();
    }
  };

  main().catch(err => {
    console.error(err.stack);
  });
}
