var messages = [
    'Trying to fight the impossible?',
    '#cheatergate',
    'Y U n00b?',
    'This wont help you!',
    'Ever heard of #fairplay?',
    'Are we trying to be god?'
];

var Rand = require('../util/PseudoRand'),
    constants = require('../GameConsts');

function CheaterBar() {
    this.element = new createjs.Container();
    this.element.x = constants.GAME_WIDTH / 2 - 95;
    this.element.y = 200;

    this.rand = new Rand();
    this.rand.setSeed(new Date().getTime());
}

CheaterBar.prototype.registerEvents = function(emitter) {
    emitter.on('cheater', this.onCheater.bind(this));
};

CheaterBar.prototype.onCheater = function() {
    var text = messages[this.rand.getRandom() % messages.length];
    var message = new createjs.Text(text, '30px Komika', "#fff");
    message.x = 95 - message.getMeasuredWidth() / 2;
    message.y = 150;
    this.element.addChild(message);

createjs.Tween.get(message)
        .to({y: 0, alpha: 0}, 2500, createjs.Ease.linear)
        .call(function() {
        this.element.removeChild(message);
        }.bind(this));
};

module.exports = CheaterBar;
