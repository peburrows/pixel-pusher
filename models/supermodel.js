var sys = require('sys');

var SuperModel = function(options){
  for(key in options){
    this[key] = options[key];
  }
};

SuperModel.validations = {
  // these will be things like validatesUniquenessOf()
};


SuperModel.instanceMethods = {
  save: function(callback){
    var self = this;
    self._klass.getCollection(function(err, coll){
      if(err){ callback(err); }
      else{
        self.created_at = self.created_at || new Date();
        self.updated_at = new Date();
        // call save here instead of insert to update OR insert
        coll.save(self.toHash(), function(err, object){
          if(err){ sys.log('error: ' + err.message); callback(err); }
          else{
            var newObj = new self._klass(object);
            callback(null, newObj);
          }
        });
      }
    })
  },
  
  update: function(options, callback){
    var self = this;
    for(key in options){ self[key] = options[key]; }
    self.save(function(err, updated){ callback(err, updated); });
  },
  
  toHash: function(){
    var self = this;
    var obj = {}
    for(prop in self){
      if(typeof(self[prop]) != 'function'){ obj[prop] = self[prop] }
    }
    return obj;
  }
};

SuperModel.classMethods = {
  configure: function(options, callback){
    var self = this;
    self.db = options.db || options.database;
    self.collectionName = options.collection || self.collectionName;
    self.indexes = options.indexes || self.indexes;
    self.db.createCollection(self.collectionName, function(err, coll){
      sys.log("created DB collection: " + self.collectionName);
      self.collection = coll;
      if(self.indexes != undefined){
        coll.createIndex(self.indexes, function(err, indexName){
          if(err){ sys.log("error creating indexes: " + err.message); }
          else{
            sys.log("created index: " + indexName + ' on ' + self.collectionName);
            if(callback){ callback(); } 
          }
        });
      }else{
        if(callback){ callback(); }
      }
    });
  },
  
  all: function(callback){
    this.getCollection(function(err, coll){
      if(err){ callback(err); }
      else{
        coll.find({}, function(err, cursor){
          if(err){ callback(err); }
          else{
            cursor.toArray(function(err, results){
              if(err){ callback(err); }
              else{ callback(null, results); }
            });
          }
        });
      }
    });
  },
  
  find: function(options, callback){
    this.getCollection(function(err, coll){
      if(err){ callback(err); }
      else{
        coll.find(options, function(err, cursor){
          if(err){ callback(err); }
          else{
            cursor.toArray(function(err, results){
              if(err){ callback(err); }
              else{ callback(null, results); }
            });
          }
        });
      }
    });
  },

  findById: function(id, callback){
    var self = this;
    this.getCollection(function(err, coll){
      if(err){ callback(err); }
      else{
        coll.findOne({_id: mongo.ObjectID.createFromHexString(id)}, function(err, result){
          if(err){ callback(err); }
          else{
            if(result){ callback(null, new self(result)); }
            else{ callback(null, null); }
          }
        });
      }
    });
  },

  getCollection: function(callback){
    var self = this;
    this.db.collection(self.collectionName, function(err, coll){
      if(err) { callback(err); }
      else    { callback(null, coll); }
    });
  },
  
  create: function(options, callback){
    new this(options).save(callback);
  }
};

// // here's where all the magic happens...
SuperModel.defineClass = function(parent){
  if(parent = parent || this);
  var F = function(){ parent.apply(this, arguments); };
  F.prototype._klass = F;
  F._parent = parent;
  F.extend = extendModule;
  F.include = includeModule;
  F.extend.apply(F, [this.classMethods]);
  F.include.apply(F, [this.instanceMethods]);
  return F;
};

var extendModule = function(mod){
  for(var key in mod){
    this[key] = (function(fn){
      return function(){
        return fn.apply(this, arguments);
      }
    })(mod[key]);
  }
};

var includeModule = function(mod){
  for(var key in mod){
    this.prototype[key] = (function(fn){
      return function(){
        return fn.apply(this, arguments);
      }
    })(mod[key]);
  }
};


module.exports = SuperModel;