function StoryScreen() {
    this.element = new createjs.Container();
}

StoryScreen.prototype.start = function() {

};

StoryScreen.prototype.reset = function() {
    this.element.removeAllChildren();
};

module.exports = StoryScreen;
