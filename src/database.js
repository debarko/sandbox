if (!process.env.production) require('dotenv').config();
let pg = require('pg');

let get = (callback) => {
    let database;

    pg.defaults.ssl = true;
    pg = require('knex')({
        client: 'pg',
        connection: process.env.DATABASE_URL,
        pool: { min: 1, max: 2 ,afterCreate: (conn, done) => {callback(conn)}}
    });
};

module.exports = {get};

