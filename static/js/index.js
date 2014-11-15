'use strict';

var Game = require('./game'),
	Preloader = require('./Preloader'),
	assets = require('./assets');

var preloader = new Preloader();

preloader.onComplete(function() {
	var game = new Game('game_canvas');

	setInterval(function() {
		createjs.Sound.play('swing1')
	}, 200)
});

preloader.load(assets);