var sys = require('sys'),
    kiwi = require('kiwi');

kiwi.require('express');

var mongo = kiwi.require('mongodb-native');

var Visit = require('./models/visit'),
    Hit = require('./models/hit'),
    Action = require('./models/action'),
    Settings = require('./config/settings'),
    PixelPusher = require('./lib/pixelpusher');

var db = new mongo.Db(Settings.database.name, new mongo.Server(Settings.database.host, Settings.database.port, {auto_reconnect: true}), {});
db.addListener('error', function(err){ sys.puts("!! Error connecting to mongo; make sure it's running !!"); });

db.open(function(pdb){
  configure(function(){
    set('root', __dirname);
    use(MethodOverride);
    use(Logger);
    use(Static);
    use(Cookie);
    use(Session);
    use(Flash);
    use(ContentLength);
    this.server.port = 4001;
  });
  
  
  // Currently, we don't need the Visit, Hit or Action models. We'll bring them back in when we do
  // 
  // Visit.configure({database:db}, function(err){
  //   Hit.configure({database:db}, function(err){
  //     Action.configure({database: db}, function(err){
        var pp = new PixelPusher();
        // this will be the dashboard of sorts
        get('/', function(){
          var self = this;
          // requireLogin(self);
          // self.render('index.html.ejs');
          self.render('canvas.html.ejs');
        });
        
        get('/canvas', function(){
          var self = this;
          self.render('canvas.html.ejs');
        });

        // app-specific page -- more detail
        get('/show/:app', function(){
          requireLogin(this);
          this.respond(200, "coming soon, " + this.session.user);
        });

        // login & logout stuffs
        get('/login', function(){
          this.render('login.html.ejs', {locals : {title:'login'}});
        });
      
        post('/login', function(){
          login(this);
          this.redirect(this.session.back || '/');
        });
      
        get('/logout', function(){
          logout(this, '/');
        });

        run(); 
  //     });
  //   });
  // });
});

var requireLogin = function(req, message){
  if(!req.session.user){
    req.session.back = req.url.href;
    req.flash('error', (message || "Please log in"));
    req.redirect('/login');
  }
};

var login = function(req){
  if(req.params.post.username == 'peburrows' && req.params.post.password == 'testing'){
    req.flash('info', "Welcome!");
    req.session.user = 'phil';
  }else{
    req.flash('error', "We're sorry, the username and password you provided were not accepted");
    req.redirect('/login');
  }
};

var logout = function(req, url){
  req.session.user = null;
  req.flash('notice', "you have been successfully logged out");
  req.redirect(url || '/login');
};