var http = require('http');
var fs = require('fs');
var handlebars = require('handlebars');
var pg = require('pg');

var rawTemplate = fs.readFileSync('app.html', 'utf8');
var template = handlebars.compile(rawTemplate);

var server = http.createServer(function (req, res) {
    pg.connect('postgres://localhost/mario_example', function(err, client) {
        if(err) {
            return console.error('could not connect to postgres', err);
        }
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

});

server.listen(3000);
