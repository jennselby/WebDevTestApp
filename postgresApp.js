var http = require('http');
var fs = require('fs');
var handlebars = require('handlebars');
var pg = require('pg');

var rawTemplate = fs.readFileSync('app.html', 'utf8');
var template = handlebars.compile(rawTemplate);

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
            });
        }
    }
    else {
        // for any other URLs, just display all characters currently in the database
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

});

server.listen(3000);
