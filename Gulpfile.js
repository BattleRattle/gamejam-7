var rimraf = require('gulp-rimraf'),
    npm = require('./package'),
    browserify = require('gulp-browserify'),
    htmlreplace = require('gulp-html-replace'),
    gulp = require('gulp'),
    deploy = require('gulp-gh-pages');

gulp.task('clean', function(cb) {
    return rimraf('./build', cb);
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
