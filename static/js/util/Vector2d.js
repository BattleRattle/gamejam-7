'use strict';

/**
 * @param {Number} x
 * @param {Number} y
 * @constructor
 */
var Vector2D = function (x, y) {
	this.x = x;
	this.y = y;
};

Vector2D.prototype.clone = function() {
	return new Vector2D(this.x, this.y);
};

/**
 * @param {Vector2D} another_vector
 * @return {Vector2D}
 */
Vector2D.prototype.plus = function(another_vector) {
	this.x += another_vector.x;
	this.y += another_vector.y;

	return this;
};

/**
 * @param {Vector2D} another_vector
 * @return {Vector2D}
 */
Vector2D.prototype.minus = function(another_vector) {
	return this.plus(another_vector.clone().times(-1));
};

/**
 * @param {Number} factor
 * @return {Vector2D}
 */
Vector2D.prototype.times = function(factor) {
	this.x *= factor;
	this.y *= factor;

	return this;
};

/**
 * @return {Number}
 */
Vector2D.prototype.length = function () {
	return Math.sqrt(this.x * this.x + this.y * this.y);
};

/**
 * @return {Vector2D}
 */
Vector2D.prototype.norm = function () {
	return this.times(1 / this.length());
};

module.exports = Vector2D;

/**
 * @param {Vector2D} vector_a
 * @param {Vector2D} vector_b
 * @param {Number} t
 * @return {Vector2D}
 */
module.exports.lerp = function(vector_a, vector_b, t) {
	return vector_a.clone().times(1-t).plus(vector_b.clone().times(t));
};

/**
 * @param {Vector2D} vector_a
 * @param {Vector2D} vector_b
 * @return {Vector2D}
 */
module.exports.add = function(vector_a, vector_b) {
	return vector_a.clone().plus(vector_b)
};

/**
 * @param {Vector2D} vector_a
 * @param {Vector2D} vector_b
 * @return {Vector2D}
 */
module.exports.subtract = function(vector_a, vector_b) {
	return vector_a.clone().minus(vector_b)
};

/**
 * @param {Vector2D} vector_a
 * @param {Number} factor
 * @return {Vector2D}
 */
module.exports.multiply = function(vector_a, factor) {
	return vector_a.clone().times(factor)
};
