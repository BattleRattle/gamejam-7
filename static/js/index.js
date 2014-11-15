'use strict';

var Game = require('./game'),
	Preloader = require('./Preloader'),
	assets = require('./assets');

var preloader = new Preloader();

preloader.onComplete(function() {
	var game = new Game('game_canvas');
});

preloader.load(assets);