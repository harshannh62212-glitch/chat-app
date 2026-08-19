const path = require('path');
let app;
try {
  app = require('../server');
} catch (e) {
  app = require('../../server');
}

module.exports = (req, res) => {
  return app(req, res);
};
