var http = require('http');
var fs = require('fs');
var handlebars = require('handlebars');
var MongoClient = require('mongodb').MongoClient;

var rawTemplate = fs.readFileSync('app.html', 'utf8');
var template = handlebars.compile(rawTemplate);

var server = http.createServer(function (req, res) {
    MongoClient.connect('mongodb://localhost/test', function(err, db) {
        if(err) {
            return console.error('could not connect to postgres', err);
        }
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

});

server.listen(3000);
