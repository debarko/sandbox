if (!process.env.production) require('dotenv').config();
const github = require('./github');

let get = (token, callback) => {
    github.user(token, (user) => {
        callback(JSON.parse(user));
    });
};

let save = () => {

};

let auth = (req, res) => {
    let code = req.query.code;
    return github.token(code, (token) => {
        let month = 30 * 24 * 60 * 60 * 1000; //milliseconds
        res.cookie('token', token, {maxAge: month});
        return github.user(token, (user) => {
            user = JSON.parse(user);
            let github_id = user.id;
            let username = user.login;
            let name = user.name;
            let email = user.email;
            let values = [github_id, username, token, name, email, token];
            if (1) { //Turn on Registration END Mode
                let searchQuery = `SELECT * from users where username = $1`;
                db.query(searchQuery, [username], (err, result) => {
                    if (err) throw err;
                    if (result.rows.length) {
                        continue_auth(values);
                    } else {
                        res.redirect('/');
                    }
                })
            }
        });
    });
};

let continue_auth = (values) => {
    let query = `INSERT INTO users (github_id, username, token, name, email) `;
    query += `VALUES($1, $2, $3, $4, $5) `;
    query += `ON CONFLICT (github_id) DO UPDATE SET token = $6`;
    db.query(query, values, (err, result) => {
        if (err) throw err;
        if (req.cookies.teamintent) res.redirect('/join');
        else res.redirect('/team');

    });
}

let tshirt = (req, res) => {
    let size = req.body.size;
    get(req.cookies.token, (user) => {
        let query = `UPDATE users SET tshirt = $1 WHERE username = $2`;
        db.query(query, [size, user.login], (err, result) => {
            if (err) throw err;
            res.end('Saved');
        });
    });
};

let linkedin = (req, res) => {
    let linkedinurl = req.body.linkedinurl;
    get(req.cookies.token, (user) => {
        let query = `UPDATE users SET linkedinurl = $1 WHERE username = $2`;
        db.query(query, [linkedinurl, user.login], (err, result) => {
            if (err) throw err;
            res.end('Saved');
        });
    });
};

module.exports = {get, save, auth, tshirt, linkedin};
