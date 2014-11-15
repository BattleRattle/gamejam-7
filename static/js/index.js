'use strict';

var Game = require('./game'),
	Preloader = require('./Preloader');

var preloader = new Preloader();

preloader.onComplete(function() {
	var game = new Game('game_canvas');
});

// TODO: load assets.json here ;)
preloader.load({id: 'swing1', src: '/sounds/swing1.mp3'});