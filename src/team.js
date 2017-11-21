const user = require('./user');
const btoa = require('btoa');
const atob = require('atob');

let getUser = (token, callback) => {
    let query = 'SELECT * from users where token = $1 ORDER BY id DESC LIMIT 1';
    db.query(query, [token], (err, result) => {
        if (err) throw err;
        let user = result.rows[0];
        callback(user);
    });
};
//user.get(token, (user) => callback(user));

/* Get team for user */
let getTeam = (user, callback) => {
    if (!user) {
      callback(null);
      return;
    }
    let username = user.username;
    let query = `SELECT teams.id, teams.name, teams.track from teams join team_members on teams.id = team_members.team_id WHERE team_members.username = $1 LIMIT 1`;
    db.query(query, [username], (err, result) => {
        if (err) throw err;
        let team = result.rows[0];
        callback(team);
    });
};

let getMembers = (team, callback) => {
    let query = `SELECT * from team_members JOIN users on team_members.username = users.username where team_id = $1`;
    db.query(query, [team.id], (err, results) => {
        if (err) throw err;
        let members = results.rows;
        callback(members);
    });
};

let getInviteLink = (team, req) => {
    let host = req.get('host');
    let salt = process.env.SALT;
    let hash = btoa(`${salt}${team.id}${salt}`);
    return `${host}/join?team=${hash}`;
};

let render = (req, res) => {

    /*
     * Clear team intent cookie
     * Get user
     * Get team for the user
     * Get members for that team
     */
    res.clearCookie('teamintent');

    getUser(req.cookies.token, (user) => {
        if (!user) {
            res.clearCookie('token');
            res.redirect('/');
        } else getTeam(user, (team) => {
            if (!team) {
                team = {};
                res.render('team', {team, user});
            } else {
                getMembers(team, (members) => {
                    team.members = members;
                    team.inviteLink = getInviteLink(team, req);
                    res.render('team', {team, user});
                });
            }
        });
    });

};

let addMember = (team_id, user, callback) => {
    let username = user.username;
    let query = `INSERT INTO team_members (team_id, username) VALUES ($1, $2)`;
    db.query(query, [team_id, username], (err, results) => {
        if (err) throw err;
        callback();
    });
};

let create = (name, user, res) => {
    let query = `INSERT INTO teams (name) VALUES ($1) RETURNING id`;
    db.query(query, [name], (err, results) => {
        if (err) throw err;
        let id = results.rows[0].id;
        addMember(id, user, () => res.end('Created'));
    });
};

let update = (name, track, team, res) => {
    name = name.replace(/\'/g, '\'\''); // Handling single quotes
    let query = `UPDATE teams SET name = $1, track = $2 WHERE id = $3`;
    db.query(query, [name, track, team.id], (err, result) => {
        if (err) throw err;
        res.end('Saved');
    });
};

let save = (req, res) => {
    let name = req.body.name;
    let track = req.body.track || '';
    getUser(req.cookies.token, (user) => {
        getTeam(user, (team) => {
            if (!team) create(name, user, res);
            else update(name, track, team, res);
        });
    });
};

let leave = (req, res) => {
    getUser(req.cookies.token, (user) => {
        let query = `DELETE from team_members WHERE username = $1`;
        db.query(query, [user.username], (err, result) => {
            if (err) throw err;
            if (req.callback) req.callback();
            else res.redirect('/team');
        });
    });
};

let getTeamFromHash = (hash, callback) => {
    let salt = process.env.SALT;
    let teamId = atob(hash).replace(salt, '').replace(salt, '');
    let query = `SELECT teams.id, teams.name from teams WHERE id = $1`;
    db.query(query, [teamId], (err, result) => {
        if (err) throw err;
        callback(result.rows[0]);
    })
};

let join = (req, res) => {
    let teamHash = req.query.team || req.cookies.teamintent;
    let confirmed = req.query.confirmed || false;
    if (!req.cookies.token) {
        let month = 30 * 24 * 60 * 60 * 1000; //milliseconds
        res.cookie('teamintent', teamHash, {maxAge: month});
        res.redirect(`/`);
    } else {
        getUser(req.cookies.token, (user) => {
            getTeam(user, (oldTeam) => {
                getTeamFromHash(teamHash, newTeam => {
                    if (!oldTeam) addMember(newTeam.id, user, () => res.redirect('/team'));
                    else if (oldTeam.id === newTeam.id) res.redirect('/team');
                    else if (confirmed) {
                        // leave all teams
                        req.callback = () => {
                            addMember(newTeam.id, user, () => res.redirect('/team'));
                        };
                        leave(req, res);
                    } else res.render('decision', {teamHash, oldTeam, newTeam});
                });
            });
        });
    }
};

module.exports = {render, save, leave, join};
