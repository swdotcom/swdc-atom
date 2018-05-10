'use strict';

var Formatter = module.exports = function (options) {
  options = options || {};
  this._complete = options.complete || '#';
  this._incomplete = options.incomplete || '·';
  this._length = options.length || 24;
};

Formatter.prototype.format = function (progress) {
  var bar = '';
  var complete = Math.round(this._length * progress);
  for (var i = 0; i < complete; i++) {
    bar += this._complete;
  }
  for (var j = 0, jj = this._length - complete; j < jj; j++) {
    bar += this._incomplete;
  }
  return bar;
};