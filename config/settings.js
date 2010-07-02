// eventually we might create new Application objects for each app we're tracking (maybe)
var Application = function(settings){
  for(key in settings){
    this[key] = settings[key];
  }
};

var defaultVisitTranslations = {id:'session_id', d:'domain', b:'brand', e:'email'},
    defaultHitTranslations = {u: 'url'},
    defaultActionTranslations = {n:'name'};

var defaultTranslations = {
  visit:  defaultVisitTranslations,
  hit:    defaultHitTranslations,
  action: defaultActionTranslations
};

var appSettings = [
  { id:           1,
    name:         'quasimodan',
    translations: defaultTranslations
  },
  { id:           2,
    name:         'bookseller',
    translations: defaultTranslations
  },

  { id:           3,
    name:         'vstdotcom',
    translations: defaultTranslations
  },
  { id:           4,
    name:         'goldenchild',
    translations: defaultTranslations
  }
];

var Settings = {
  apps: appSettings,
  database: {
    name: 'pixel-pusher-testing',
    port: 27017,
    host: 'localhost'
  },
  findAppById: function(id, callback){
    // we want this to be async
    var self = this;
    (function(){
      var result = null;
      for(var i=0; i<self.apps.length; i++){
        if(self.apps[i].id == id){
          result = self.apps[i];
          break;
        }
      }
      callback(result);
    })();
  }
};

module.exports = Settings;