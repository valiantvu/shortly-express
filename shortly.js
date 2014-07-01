var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();
app.use(express.bodyParser());
app.use(express.cookieParser("andrew and michelle's app"));
app.use(express.cookieSession());

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.bodyParser())
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res) {
  console.log(req.session);
  if (req.session.user) {
    res.render('index');
  } else {
    res.redirect(301, '/login');
  }
});

app.get('/create', function(req, res) {
  if (req.session.user) {
    res.render('index');
  } else {
    res.redirect(301, '/login');
  }
});

// Accessed through Backbone collection
app.get('/links', function(req, res) {
  if (req.session.user) {
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
    });
  } else {
    res.redirect(301, '/login');
  }

});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/login', function(req, res) {
  //if authenticated, redirect to index page
  res.render('login');
});

app.get('/signup', function(req, res) {
  //if authenticated, redirect to index page
  res.render('signup');
});

app.get('/logout', function(req, res){
  req.session = null;
  console.log(req.session);
  res.redirect('/login');
});

app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  //user request should include username and password
  //hash the password and compare against database
  //should generate and send token in response (on successful login) and redirect to index page, otherwise throw error
  new User({username: username, password: password}).fetch().then(function(found) {
    if (found) {
      req.session.user = username;
      res.redirect('/');
    } else {
      res.redirect('/login');
    }
  });
});


app.post('/signup', function(req, res) {
  //ADD PASSWORD HASHING W/SALT

  new User({username: req.body.username}).fetch().then(function(found) {
    if (found) {
      res.send(400, 'Sorry, that username already exists');
    } else {
      var user = new User({username: req.body.username, password: req.body.password});

      user.save().then(function(newUser) {
        Users.add(newUser);
        res.redirect('/');
      });
    }
  });
  //user request should include username and password
  //build new User object and store in database
  //generate new token
  //send token in response (on successful login) and redirect to index page, otherwise throw error
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
