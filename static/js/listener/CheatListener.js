var cheats = [
    {
        keys: [102, 117, 110], //fun
        event: "force-fun"
    },
    {
        keys: [ 119, 105, 110], // win
        event: 'monster-dead'
    },
    {
        keys: [ 104, 108, 112], // hlp
        event: 'heal-me'
    },
    {
        keys: [ 112, 108, 122], // plz
        event: 'player-weapon-lifetime'
    }
];

function CheatListener() {
    this.lastKeys = [0, 0, 0];
}

CheatListener.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;
    document.onkeypress = this.onKeyUp.bind(this);

};

CheatListener.prototype.onKeyUp = function(event) {
    this.lastKeys.shift();
    this.lastKeys.push(event.keyCode);

    for (var i = 0; i < cheats.length; i++) {
        if (cheats[i].keys.join(',') == this.lastKeys.join(',')) {
            this.emitter.emit('cheater');
            this.emitter.emit(cheats[i].event);
        }
    }
};

module.exports = CheatListener;
