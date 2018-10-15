class FontPlugin {
    constructor(options) {}

    apply(compiler) {
        compiler.plugin("emit", function(compilation, callback) {
            compilation.chunks.forEach(chunk => {
                chunk.files.forEach(function(filename) {
                    let source = compilation.assets[filename].source();
                    console.log(filename);
                    compilation.assets[filename].source = _ => source.replace("2323", "23232323");
                });
            });
            callback();
        });
    }
}

module.exports = FontPlugin;
