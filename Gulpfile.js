var rimraf = require('gulp-rimraf'),
    npm = require('./package'),
    browserify = require('gulp-browserify'),
    htmlreplace = require('gulp-html-replace'),
    gulp = require('gulp'),
    deploy = require('gulp-gh-pages'),
    fs = require('fs'),
    path = require('path');

gulp.task('clean', function(cb) {
    return rimraf('./build', cb);
});

gulp.task('assetfile', function() {
    var read = function(dir) {
        var list = [];

        if (!fs.existsSync(dir)) {
            return list;
        }

        var files = fs.readdirSync(dir);
        for(var i in files){
            if (!files.hasOwnProperty(i)) continue;
            var name = dir+'/'+files[i];
            if (fs.statSync(name).isDirectory()){
                read(name, list);
            } else if (name.indexOf('.DS_Store') === -1) {
                list.push({
                    id: path.basename(name, path.extname(name)),
                    src: name.replace('static/', '')
                });
            }
        }

        return list;
    };

    var files = read('./static/img').concat(read('./static/sounds'));

    fs.writeFile('./static/js/assets.json', JSON.stringify(files, null, 4, function(err) {
        if(err) {
            console.log(err);
        } else {
            console.log("JSON saved to " + outputFilename);
        }
    }));
});

gulp.task('copy', function() {
    gulp.src('static/img/*')
        .pipe(gulp.dest('build/img'));

    gulp.src('./static/css/*')
        .pipe(gulp.dest('build/css'));

    gulp.src('./static/sounds/*')
        .pipe(gulp.dest('build/sounds'));

    gulp.src('static/js/libs/*')
        .pipe(gulp.dest('build/js/libs'));

});

gulp.task('browserify', function() {
    gulp.src('static/js/index.js')
        .pipe(browserify({
            insertGlobals : true,
            debug : true
        }))
        .pipe(gulp.dest('build/js'))

    gulp.src('index.html')
        .pipe(htmlreplace({
            'js': 'js/index.js'
        }))
        .pipe(gulp.dest('build/'));
});

gulp.task('deploy', ['copy', 'browserify'], function () {
    return gulp.src(['build/*', 'build/**/*'])
        .pipe(deploy({
            remoteUrl: npm.repository.url
        }));
});
