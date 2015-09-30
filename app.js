var http = require('http');
var fs = require('fs');
var handlebars = require('handlebars');

// setup the database functions based on which database is being used
var database = 'mongoDB'; // change to postgreSQL to use postgres instead
var MongoClient = null;
var pg = null;
var updateCoins = null;
var displayCharacters = null;
if (database === 'mongoDB') {
    MongoClient = require('mongodb').MongoClient;
    updateCoins = updateCoinsMongo;
    displayCharacters = displayCharactersMongo;
}
else if (database === 'postgreSQL') {
    pg = require('pg');
    updateCoins = updateCoinsPostgres;
    displayCharacters = displayCharactersPostgres;
}
else {
    console.error('Unrecognized database ' + database);
    process.exit(1);
}


// Define functions for interacting with the databases
function sendToMongoDB(res, callback) {
    MongoClient.connect('mongodb://localhost/test', function(err, db) {
        if(err) {
            res.writeHead(500, {'Content-Type': 'text/html'});
            res.end('coin update failed: database connection error');
            return console.error('could not connect to mongo', err);
        }
        callback(db);
    });
}

function updateCoinsMongo(name, coins, res) {
    sendToMongoDB(res, function(db) {
        var collection = db.collection('characters');
        collection.update(
            {name: name},
            {$set: {coins: coins}},
            function(err, statusObj) {
                if(err) {
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end('coin update failed: database error');
                    return console.error('error running query', err);
                }
                if (statusObj.result.nModified != 1) {
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end('coin update failed: ' + statusObj.result.nModified + ' documents updated');
                    return console.error('Expected 1 document updated, but ' +
                                           statusObj.result.nModified + ' were: ' + statusObj);
                }
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
            if(err) {
                return console.error('error running query', err);
            }
            var context = {'characters': docs};
            var html = template(context);
            db.close();
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(html);
        });
    });
}

function sendToPostgresDB(res, callback) {
    pg.connect('postgres://localhost/mario_example', function(err, client) {
        if(err) {
            res.writeHead(500, {'Content-Type': 'text/html'});
            res.end('coin update failed: database connection error');
            return console.error('could not connect to postgres', err);
        }   
        callback(client);
    }); 
}

function updateCoinsPostgres(name, coins, res) {
    sendToPostgresDB(res, function(client) {
        // https://github.com/brianc/node-postgres/wiki/Example
        client.query(
            'UPDATE characters SET coins=$1 WHERE name=$2',
            [coins, name],
            function(err, result) {
                if(err) {
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end('coin update failed: database error');
                    return console.error('error running query', err);
                }
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end('coin update received');
            }
        );
    });
}

function displayCharactersPostgres(res) {
    sendToPostgresDB(res, function(client) {
        client.query('SELECT * FROM characters', function(err, result) {
            if(err) {
                return console.error('error running query', err);
            }
            var context = {'characters': result.rows};
            var html = template(context);
            client.end();
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(html);
        });
    });
}



var rawTemplate = fs.readFileSync('app.html', 'utf8');
var template = handlebars.compile(rawTemplate);

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
    else if (req.url === '/setcoin') {
        // this should contain the new coin data, so ignore a request to this URL that isn't a POST
        if (req.method == 'POST') {
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
                var post = JSON.parse(body);
                var coins = post['coins'];
                var name = post['name'];

                updateCoins(name, coins, res);
            });
        }
    }
    else {
        // for any other URLs, just display all characters currently in the database
        displayCharacters(res);
    }

});

server.listen(3000);
