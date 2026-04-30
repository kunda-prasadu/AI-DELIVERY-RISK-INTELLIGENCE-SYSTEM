const { v4: uuidv4 } = require('uuid');

module.exports = (_req, _res, next) => {
  _req.id = uuidv4();
  next();
};
