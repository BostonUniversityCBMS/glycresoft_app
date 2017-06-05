var GlycanCompositionHypothesisController, GlycanCompositionHypothesisPaginator,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

GlycanCompositionHypothesisPaginator = (function(superClass) {
  extend(GlycanCompositionHypothesisPaginator, superClass);

  GlycanCompositionHypothesisPaginator.prototype.tableSelector = "#composition-table-container";

  GlycanCompositionHypothesisPaginator.prototype.tableContainerSelector = "#composition-table-container";

  GlycanCompositionHypothesisPaginator.prototype.rowSelector = "#composition-table-container tbody tr";

  GlycanCompositionHypothesisPaginator.prototype.pageUrl = "/view_glycan_composition_hypothesis/{hypothesisId}/{page}";

  function GlycanCompositionHypothesisPaginator(hypothesisId, handle, controller) {
    this.hypothesisId = hypothesisId;
    this.handle = handle;
    this.controller = controller;
    this.rowClickHandler = bind(this.rowClickHandler, this);
    GlycanCompositionHypothesisPaginator.__super__.constructor.call(this, 1);
  }

  GlycanCompositionHypothesisPaginator.prototype.getPageUrl = function(page) {
    if (page == null) {
      page = 1;
    }
    return this.pageUrl.format({
      "page": page,
      "hypothesisId": this.hypothesisId
    });
  };

  GlycanCompositionHypothesisPaginator.prototype.rowClickHandler = function(row) {
    return console.log(row);
  };

  return GlycanCompositionHypothesisPaginator;

})(PaginationBase);

GlycanCompositionHypothesisController = (function() {
  GlycanCompositionHypothesisController.prototype.containerSelector = '#glycan-composition-hypothesis-container';

  GlycanCompositionHypothesisController.prototype.saveTxtURL = "/view_glycan_composition_hypothesis/{hypothesisId}/download-text";

  function GlycanCompositionHypothesisController(hypothesisId) {
    this.hypothesisId = hypothesisId;
    this.handle = $(this.containerSelector);
    this.paginator = new GlycanCompositionHypothesisPaginator(this.hypothesisId, this.handle, this);
    this.setup();
  }

  GlycanCompositionHypothesisController.prototype.setup = function() {
    var self;
    self = this;
    this.paginator.setupTable();
    return this.handle.find("#save-text-btn").click(function() {
      return self.downloadTxt();
    });
  };

  GlycanCompositionHypothesisController.prototype.downloadTxt = function() {
    var url;
    url = this.saveTxtURL.format({
      "hypothesisId": this.hypothesisId
    });
    return $.get(url).then(function(payload) {
      return GlycReSoft.downloadFile(payload.filenames[0]);
    });
  };

  return GlycanCompositionHypothesisController;

})();

//# sourceMappingURL=view-glycan-composition-hypothesis.js.map
