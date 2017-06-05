Application.prototype.renderSampleListAt = function(container) {
  var chunks, i, len, ref, row, sample, sampleStatusDisplay, self;
  chunks = [];
  self = this;
  ref = _.sortBy(_.values(this.samples), function(o) {
    return o.name;
  });
  for (i = 0, len = ref.length; i < len; i++) {
    sample = ref[i];
    row = $("<div data-name=" + sample.name + " class='list-item sample-entry clearfix' data-uuid='" + sample.uuid + "'> <span class='handle user-provided-name'>" + (sample.name.replace(/_/g, ' ')) + "</span> <small class='right' style='display:inherit'> " + sample.sample_type + " <span class='status-indicator'></span> <!-- <a class='remove-sample mdi mdi-close'></a> --> </small> </div>");
    sampleStatusDisplay = row.find(".status-indicator");
    if (!sample.completed) {
      sampleStatusDisplay.html("<small class='yellow-text'>(Incomplete)</small>");
    }
    chunks.push(row);
    row.click(function(event) {
      var handle, layer, uuid;
      handle = $(this);
      uuid = handle.attr("data-uuid");
      self.addLayer(ActionBook.viewSample, {
        "sample_id": uuid
      });
      layer = self.lastAdded;
      return self.setShowingLayer(layer);
    });
    row.find(".remove-sample").click(function(event) {
      var handle;
      handle = $(this);
      return console.log(handle);
    });
  }
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
