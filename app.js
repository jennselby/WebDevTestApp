var http = require('http');
var fs = require('fs');
var handlebars = require('handlebars');
var qs = require('querystring');

// setup the database functions based on which database is being used
var database = 'mongoDB'; // change to postgreSQL or MySQL to use these databases instead
var MongoClient = null;
var sanitize = null;
var pg = null;
var mysql = null;
var sendToSQLDB = null;
var extractSQLResults = null;
var replaceSQLParameters = null;
var updateCoins = null;
var displayCharacters = null;
var displayOneCharacter = null;
var insertCharacter = null;
if (database === 'mongoDB') {
    MongoClient = require('mongodb').MongoClient;
    sanitize = require('mongo-sanitize');
    updateCoins = updateCoinsMongo;
    displayCharacters = displayCharactersMongo;
    displayOneCharacter = displayOneCharacterMongo;
    insertCharacter = insertCharacterMongo;
}
else if (database === 'postgreSQL') {
    pg = require('pg');
    extractSQLResults = extractPostgresResults;
    replaceSQLParameters = replacePostgresParameters;
    sendToSQLDB = sendToPostgresDB;
    updateCoins = updateCoinsSQL;
    displayCharacters = displayCharactersSQL;
    displayOneCharacter = displayOneCharacterSQL;
    insertCharacter = insertCharacterSQL;
}
else if (database === 'MySQL') {
    mysql = require('mysql');
    extractSQLResults = extractMySQLResults;
    replaceSQLParameters = replaceMySQLParameters;
    sendToSQLDB = sendToMySQLDB;
    updateCoins = updateCoinsSQL;
    displayCharacters = displayCharactersSQL;
    displayOneCharacter = displayOneCharacterSQL;
    insertCharacter = insertCharacterSQL;
}
else {
    console.error('Unrecognized database ' + database);
    process.exit(1);
}

var rawTemplate = fs.readFileSync('templates/characters.html', 'utf8');
var charactersTemplate = handlebars.compile(rawTemplate);

var rawTemplate = fs.readFileSync('templates/oneChar.html', 'utf8');
var oneCharTemplate = handlebars.compile(rawTemplate);

// Define functions for interacting with the databases
function sendToMongoDB(res, callback) {
    MongoClient.connect('mongodb://localhost/test', function(err, db) {
        if(err) {
            db.close();
            res.writeHead(500, {'Content-Type': 'text/html'});
            res.end('coin update failed: database connection error');
            return console.error('could not connect to mongo', err);
        }
        callback(db);
    });
}

function updateCoinsMongo(res, name, coins) {
    sendToMongoDB(res, function(db) {
        var collection = db.collection('characters');
        collection.update(
            {name: name},
            {$set: {coins: coins}},
            function(err, statusObj) {
                if (err) {
                    db.close();
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end('coin update failed: database error');
                    return console.error('error running query', err);
                }
                if (statusObj.result.nModified != 1) {
                    db.close();
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end('coin update failed: ' + statusObj.result.nModified + ' documents updated');
                    return console.error('Expected 1 document updated, but ' +
                                           statusObj.result.nModified + ' were: ' + statusObj);
                }
                db.close();
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end('coin update received');
            }
        );
    });
}

function displayCharactersMongo(res) {
    sendToMongoDB(res, function (db) {
        var collection = db.collection('characters');
        collection.find({}).toArray(function(err, docs) {
            if (err) {
                db.close();
                res.writeHead(500, {'Content-Type': 'text/html'});
                res.end('cannot display characters: database error');
                return console.error('error running query', err);
            }
            var context = {'characters': docs};
            var html = charactersTemplate(context);
            db.close();
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(html);
        });
    });
}

function displayOneCharacterMongo(res, name) {
    sendToMongoDB(res, function(db) {
        var collection = db.collection('characters');
        collection.find({name: name}).toArray(function (err, docs) {
            if (err) {
                db.close();
                res.writeHead(500, {'Content-Type': 'text/html'});
                res.end('cannot display characters: database error');
                return console.error('error running query', err);
            }
            if (docs.length != 1) {
                db.close();
                res.writeHead(500, {'Content-Type': 'text/html'});
                res.end('Expected 1 result but got ' + docs.length);
                return console.error('Expected 1 result but got ' + docs.length);
            }
            var context = docs[0];
            var html = oneCharTemplate(context);
            db.close();
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(html);
        });
    });
}

function insertCharacterMongo(res, name, street_address, kingdom) {
    sendToMongoDB(res, function (db) {
        var collection = db.collection('characters');
        collection.insert({
             _id: sanitize(name),
             name: sanitize(name),
             location: { street_address: sanitize(street_address), kingdom: sanitize(kingdom) },
             coins: 0,
             lives: 0,
             friends: [],
             enemies: [],
        });
        db.close();
        // dislay the characters page
        res.writeHead(301, {Location: '/'});
        res.end();
    });
}

function extractPostgresResults(result) {
    return result.rows;
}

function replacePostgresParameters(query) {
    return query;
}

function sendToPostgresDB(res, callback) {
    pg.connect('postgres://localhost/mario_example', function(err, client) {
        if (err) {
            client.end();
            res.writeHead(500, {'Content-Type': 'text/html'});
            res.end('coin update failed: database connection error');
            return console.error('could not connect to postgres', err);
        }   
        callback(client);
    }); 
}

function extractMySQLResults(result) {
    return result;
}

function replaceMySQLParameters(query) {
    // MySQL node library uses ? instead of $N for parameters
    return query.replace(new RegExp('\\$[0-9]', 'g'), '?');
}

function sendToMySQLDB(res, callback) {
    var connection = mysql.createConnection({
        host     : 'localhost',
        user     : 'root',
        database : 'mario_example'
    });
    connection.connect();
    callback(connection);
}

function updateCoinsSQL(res, name, coins) {
    sendToSQLDB(res, function(client) {
        // https://github.com/brianc/node-postgres/wiki/Example
        client.query(
            replaceSQLParameters('UPDATE characters SET coins=$1 WHERE name=$2'),
            [coins, name],
            function(err, result) {
                if (err) {
                    client.end();
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end('coin update failed: database error');
                    return console.error('error running query', err);
                }
                client.end();
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end('coin update received');
            }
        );
    });
}

function displayCharactersSQL(res) {
    sendToSQLDB(res, function(client) {
        client.query('SELECT * FROM characters', function(err, result) {
            if (err) {
                client.end();
                res.writeHead(500, {'Content-Type': 'text/html'});
                res.end('database error');
                return console.error('error running query', err);
            }
            client.end();
            var context = {'characters': extractSQLResults(result)};
            var html = charactersTemplate(context);
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(html);
        });
    });
}

function displayOneCharacterSQL(res, name) {
    sendToSQLDB(res, function (client) {
        client.query(
            replaceSQLParameters('SELECT * FROM characters WHERE name=$1'),
            [name],
            function(err, result) {
                if (err) {
                    client.end();
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end('database error');
                    return console.error('error running query', err);
                }
                var rows = extractSQLResults(result);
                if (rows.length != 1) {
                    client.end();
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end('Expected 1 result but got ' + rows.length);
                    return console.error('Expected 1 result but got ' + rows.length);
                }
                client.end();
                var context = rows[0];
                var html = oneCharTemplate(context);
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end(html);
            }
        );
    });
}

function insertCharacterSQL(res, name, street_address, kingdom) {
    sendToSQLDB(res, function (client) {
        client.query(
            replaceSQLParameters(
                'INSERT INTO characters (name, street_address, kingdom, coins, lives) VALUES ($1, $2, $3, 0, 0)'),
            [name, street_address, kingdom],
            function (err, result) {
                if (err) {
                    client.end();
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end('database error');
                    return console.error('error running query', err);
                }
                client.end();
                // dislay the characters page
                res.writeHead(301, {Location: '/'});
                res.end();
            }
        );
    });
}

function handlePostData(req, res, callback) {
    var body = '';
    // http://stackoverflow.com/questions/4295782/how-do-you-extract-post-data-in-node-js
    // collect all of the POST data
    req.on('data', function (data) {
        body += data;
        // Too much POST data, kill the connection!
        if (body.length > 1e6) {
            request.connection.destroy();
            res.writeHead(413, {'Content-Type': 'text/html'});
            res.end('coin update failed: POST data too large');
            return console.error('POST data too large');
        }
    });
    // when the data collection is done, update the database with the new information
    req.on('end', function () {
        callback(res, body);
    });
}

handlebars.registerHelper('replaceSpaces', function(name) {
    var newName = name.replace(/ /g, '_');
    return new handlebars.SafeString(newName);
});

var server = http.createServer(function (req, res) {
    // first handle the CSS and JavaScript files
    if (req.url === '/static/appStyle.css') {
        res.writeHead(200, {'Content-Type': 'text/css'});
        res.end(fs.readFileSync('static/appStyle.css', 'utf8'));
    }
    else if (req.url === '/static/appUtils.js') {
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.end(fs.readFileSync('static/appUtils.js', 'utf8'));
    }
    // this should contain the new coin data, so ignore a request to this URL that isn't a POST
    else if (req.url === '/setcoin'  && req.method === 'POST') {
        handlePostData(req, res, function (res, body) {
            var post = JSON.parse(body);
            var name = post['name'];
            var coins = post['coins'];
            updateCoins(res, name, coins);
        });
    }
    else if (req.url.startsWith('/show')) {
        var name = req.url.substring(5, req.url.length).replace(/_/g, ' ');
        displayOneCharacter(res, name);
    }
    // this should contain the new coin data, so ignore a request to this URL that isn't a POST
    else if (req.url.startsWith('/addNewCharacter') && req.method === 'POST') {
        handlePostData(req, res, function (res, body) {
            var post = qs.parse(body);
            var name = post['charName'];
            var street_address = post['street_address'];
            var kingdom = post['kingdom'];
            insertCharacter(res, name, street_address, kingdom);
        });
    }
    else {
        // for any other URLs, just display all characters currently in the database
        displayCharacters(res);
    }

});

server.listen(3000);
