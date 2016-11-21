Application.prototype.renderSampleListAt = function(container) {
  var chunks, row, sample, template;
  chunks = [];
  template = (function() {
    var i, len, ref, results;
    ref = _.sortBy(_.values(this.samples), function(o) {
      return o.id;
    });
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      sample = ref[i];
      row = $("<div data-name=" + sample.name + " class='list-item clearfix' data-uuid='" + sample.uuid + "'> <span class='handle user-provided-name'>" + (sample.name.replace(/_/g, ' ')) + "</span> <small class='right' style='display:inherit'> " + sample.sample_type + " <a class='remove-sample mdi mdi-close'></a> </small> </div>");
      chunks.push(row);
      results.push(row.find(".remove-sample").click(function(event) {
        var handle;
        handle = $(this);
        return console.log(handle);
      }));
    }
    return results;
  }).call(this);
  return $(container).html(chunks);
};

Application.initializers.push(function() {
  return this.on("render-samples", (function(_this) {
    return function() {
      return _this.renderSampleListAt(".sample-list");
    };
  })(this));
});

//# sourceMappingURL=sample-ui.js.map
