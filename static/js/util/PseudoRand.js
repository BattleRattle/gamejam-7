'use strict';

/**
 * @constructor
 */
var PseudoRand = function() {};

/**
 * @param seed
 */
PseudoRand.prototype.setSeed = function(seed) {
	this._w = Math.abs(seed & 0xffff);
	this._z = Math.abs(seed >> 16);

	console.log(this)
	if (this._w == 0) this._w = 1;
	if (this._z == 0) this._z = 1;
};

/**
 * @returns {int}
 */
PseudoRand.prototype.getRandom = function() {
	this._z = Math.abs((36969 * (this._z & 65535) + (this._z >> 16))&0xfffffff);
	this._w = Math.abs((18000 * (this._w & 65535) + (this._w >> 16))&0xfffffff);
	return Math.abs(((this._z << 16) + this._w) & 0xfffffff); // exclude last bit
};

module.exports = PseudoRand;
