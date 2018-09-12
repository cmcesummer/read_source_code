module.exports = function(content, map, meta) {
    console.log(content, map, meta);
    this.async()(null, content, map, meta);
};
