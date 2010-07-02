var SuperModel = require('./supermodel');

// so simple now that we've figured out proper inheritance
var Hit = SuperModel.defineClass();

Hit.collectionName = 'hits';
Hit.indexes = [['session_id', 1]];

module.exports = Hit;