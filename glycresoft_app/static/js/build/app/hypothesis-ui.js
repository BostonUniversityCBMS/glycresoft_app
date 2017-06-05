var hypothesisTypeDisplayMap;

hypothesisTypeDisplayMap = {
  "glycan_composition": "Glycan Hypothesis",
  "glycopeptide": "Glycopeptide Hypothesis"
};

Application.prototype.renderHypothesisListAt = function(container) {
  var chunks, hypothesis, i, j, len, ref, row, self, template;
  chunks = [];
  template = '';
  self = this;
  i = 0;
  ref = _.sortBy(_.values(this.hypotheses), function(o) {
    return o.name;
  });
  for (j = 0, len = ref.length; j < len; j++) {
    hypothesis = ref[j];
    row = $("<div data-id=" + hypothesis.id + " data-uuid=" + hypothesis.uuid + " class='list-item clearfix'> <span class='handle user-provided-name'>" + (hypothesis.name.replace(/_/g, ' ')) + "</span> <small class='right' style='display:inherit'> " + hypothesisTypeDisplayMap[hypothesis.hypothesis_type] + " <!-- <a class='remove-hypothesis mdi mdi-close'></a> --> </small> </div>");
    chunks.push(row);
    i += 1;
    row.click(function(event) {
      var handle, hypothesisId, layer, uuid;
      handle = $(this);
      hypothesisId = handle.attr("data-id");
      uuid = handle.attr("data-uuid");
      self.addLayer(ActionBook.viewHypothesis, {
        "uuid": uuid
      });
      layer = self.lastAdded;
      return self.setShowingLayer(layer);
    });
    row.find(".remove-hypothesis").click(function(event) {
      var handle;
      return handle = $(this);
    });
  }
  return $(container).html(chunks);
};

Application.initializers.push(function() {
  return this.on("render-hypotheses", (function(_this) {
    return function() {
      return _this.renderHypothesisListAt(".hypothesis-list");
    };
  })(this));
});

//# sourceMappingURL=hypothesis-ui.js.map
