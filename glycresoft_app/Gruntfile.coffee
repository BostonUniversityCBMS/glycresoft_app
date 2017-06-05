module.exports = (grunt) -> 
    grunt.initConfig
        pkg: grunt.file.readJSON("package.json")
        copy:
            js:
                flatten: true
                expand: true
                src: 'static/js/dist/*'
                dest: "static/dist/js/"
            css:
                flatten: true
                expand: true
                src: "static/css/dist/*"
                dest: "static/dist/css/"
            icons:
                flatten: true
                expand: true
                src: "static/fonts/roboto/*"
                dest: "static/dist/fonts/roboto/"
            iconsMaterialDesign:
                flatten: true
                expand: true
                src: "static/fonts/icons/*"
                dest: "static/dist/fonts/icons/"
            fontInconsolata:
                flatten: true
                expand: true
                src: "static/fonts/Inconsolata/*"
                dest: "static/dist/fonts/Inconsolata/"
            font:
                flatten: true
                expand: true
                src: ["static/fonts/*"]
                dest: "static/dist/fonts/"
        concat:
            options:
                separator: "\n"
            app:
                src: ["static/js/build/app/**.js", "static/js/build/*.js"]
                dest: "static/js/dist/app-bundle.js"
            lib:
                src: ["static/js/build/lib/**.js"]
                dest: "static/js/dist/lib-bundle.js"
            vendor:
                src: ["static/js/vendor/**.js"]
                dest: "static/js/dist/vendor-bundle.js"
            jquery:
                src: ["static/js/vendor/_jquery.js"]
                dest: "static/js/dist/jquery.js"
            css:
                src: ["static/css/*.css"]
                dest: "static/css/dist/bundle.css"
                separator: "\n"
        coffee:
            app:
                options:
                    bare: true
                    sourceMap: true
                expand: true,
                cwd: "static/js/src/app/"
                src: ["*.coffee"]
                dest: "static/js/build/app/"
                ext: ".js"
            lib:
                options:
                    bare: true
                    sourceMap: true
                expand: true,
                cwd: "static/js/src/lib/"
                src: ["*.coffee"]
                dest: "static/js/build/lib/"
                ext: ".js"

    grunt.loadNpmTasks 'grunt-contrib-concat'
    grunt.loadNpmTasks 'grunt-contrib-coffee'
    grunt.loadNpmTasks "grunt-contrib-copy"


    grunt.registerTask "default", ["coffee", "concat", "copy"]

    return grunt
