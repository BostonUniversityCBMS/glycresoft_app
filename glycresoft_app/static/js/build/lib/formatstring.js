(function() {

  /*
  Implements {named} replacements similar to the simple format() method of strings from Python
   */
  String.prototype.format = function() {
    var data, i, keys, res;
    data = arguments;
    i = 0;
    keys = Object.keys(arguments);
    if (arguments.length === 1 && typeof arguments[0] === 'object') {
      data = arguments[0];
      keys = Object.keys(arguments);
    }
    res = this.replace(/\{([^\}]*)\}/g, function(placeholder, name, position) {
      var v;
      if (name === '') {
        name = keys[i];
        i++;
      }
      v = JSON.stringify(data[name]);
      if (v.startsWith('"') && v.endsWith('"')) {
        v = v.slice(1, -1);
      }
      return v;
    });
    return res;
  };
})();

//# sourceMappingURL=formatstring.js.map
