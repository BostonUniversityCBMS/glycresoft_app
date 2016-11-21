var Application, renderTask,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Application = (function(superClass) {
  extend(Application, superClass);

  function Application(options) {
    var self;
    if (options == null) {
      options = {};
    }
    this._upkeepIntervalCallback = bind(this._upkeepIntervalCallback, this);
    Application.__super__.constructor.call(this, options.actionContainer, options);
    this.version = [0, 0, 1];
    this.context = {};
    this.settings = {};
    this.tasks = {};
    this.sideNav = $('.side-nav');
    this.colors = new ColorManager();
    self = this;
    self.monosaccharideFilterState = new MonosaccharideFilterState(self, null);
    this.messageHandlers = {};
    this.connectEventSource();
    this.handleMessage('update', (function(_this) {
      return function(data) {
        Materialize.toast(data.replace(/"/g, ''), 4000);
      };
    })(this));
    this.handleMessage('task-queued', (function(_this) {
      return function(data) {
        self.tasks[data.id] = {
          'id': data.id,
          'name': data.name,
          'status': 'queued'
        };
        self.updateTaskList();
      };
    })(this));
    this.handleMessage('task-start', (function(_this) {
      return function(data) {
        self.tasks[data.id] = {
          'id': data.id,
          'name': data.name,
          'status': 'running'
        };
        self.updateTaskList();
      };
    })(this));
    this.handleMessage('task-error', (function(_this) {
      return function(data) {
        var task;
        task = self.tasks[data.id];
        task.status = 'error';
        self.updateTaskList();
      };
    })(this));
    this.handleMessage('task-complete', (function(_this) {
      return function(data) {
        var err;
        try {
          self.tasks[data.id].status = 'finished';
        } catch (_error) {
          err = _error;
          self.tasks[data.id] = {
            'id': data.id,
            'name': data.name,
            'status': 'finished'
          };
        }
        self.updateTaskList();
      };
    })(this));
    this.handleMessage('new-sample-run', (function(_this) {
      return function(data) {
        _this.samples[data.name] = data;
        return _this.emit("render-samples");
      };
    })(this));
    this.handleMessage('new-hypothesis', (function(_this) {
      return function(data) {
        _this.hypotheses[data.uuid] = data;
        return _this.emit("render-hypotheses");
      };
    })(this));
    this.handleMessage('new-analysis', (function(_this) {
      return function(data) {
        _this.analyses[data.id] = data;
        return _this.emit("render-analyses");
      };
    })(this));
    this.on("layer-change", (function(_this) {
      return function(data) {
        return _this.colors.update();
      };
    })(this));
  }

  Application.prototype.connectEventSource = function() {
    return this.eventStream = new EventSource('/stream');
  };

  Application.prototype.runInitializers = function() {
    var initializer, j, len, ref, results;
    ref = Application.initializers;
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      initializer = ref[j];
      results.push(initializer.apply(this, null));
    }
    return results;
  };

  Application.prototype.updateSettings = function(payload) {
    if (payload == null) {
      payload = {};
    }
    return $.post('/preferences', payload).success((function(_this) {
      return function(data) {
        var k, v;
        for (k in data) {
          v = data[k];
          _this.settings[k] = v;
        }
        return _this.emit("update_settings");
      };
    })(this)).error(function(err) {
      return console.log("error in updateSettings", err, arguments);
    });
  };

  Application.prototype.updateTaskList = function() {
    var clickTask, doubleClickTask, self, taskListContainer;
    taskListContainer = this.sideNav.find('.task-list-container ul');
    clickTask = function(event) {
      var handle, id, state;
      handle = $(this);
      state = handle.attr('data-status');
      id = handle.attr('data-id');
      if (state === 'finished') {
        delete self.tasks[id];
        handle.fadeOut();
        handle.remove();
      }
    };
    self = this;
    doubleClickTask = function(event) {
      var handle, id;
      handle = $(this);
      id = handle.attr('data-id');
      return $.get("/internal/log/" + id, (function(_this) {
        return function(message) {
          return self.displayMessageModal(message);
        };
      })(this));
    };
    taskListContainer.html(_.map(this.tasks, renderTask).join(''));
    taskListContainer.find('li').map(function(i, li) {
      return contextMenu(li, {
        "View Log": doubleClickTask
      });
    });
    taskListContainer.find('li').click(clickTask);
    return taskListContainer.find("li").dblclick(doubleClickTask);
  };

  Application.prototype.handleMessage = function(messageType, handler) {
    this.messageHandlers[messageType] = handler;
    return this.eventStream.addEventListener(messageType, function(event) {
      var data;
      data = JSON.parse(event.data);
      return handler(data);
    });
  };

  Application.initializers = [
    function() {
      var self;
      self = this;
      return $(function() {
        self.container = $(self.options.actionContainer);
        self.sideNav = $('.side-nav');
        self.addLayer(ActionBook.home);
        $("#search-glycan-composition").click(function(event) {
          self.addLayer(ActionBook.glycanCompositionSearch);
          return self.setShowingLayer(self.lastAdded);
        });
        $("#search-glycopeptide-database").click(function(event) {
          self.addLayer(ActionBook.glycopeptideSequenceSearch);
          return self.setShowingLayer(self.lastAdded);
        });
        $("#add-sample").click(function(event) {
          self.addLayer(ActionBook.addSample);
          return self.setShowingLayer(self.lastAdded);
        });
        $("#build-glycan-search-space").click(function(event) {
          self.addLayer(ActionBook.naiveGlycanSearchSpace);
          return self.setShowingLayer(self.lastAdded);
        });
        return $("#build-glycopeptide-search-space").click(function(event) {
          self.addLayer(ActionBook.naiveGlycopeptideSearchSpace);
          return self.setShowingLayer(self.lastAdded);
        });
      });
    }, function() {
      return this.loadData();
    }, function() {
      return this.handleMessage("files-to-download", (function(_this) {
        return function(data) {
          var file, j, len, ref, results;
          ref = data.files;
          results = [];
          for (j = 0, len = ref.length; j < len; j++) {
            file = ref[j];
            results.push(_this.downloadFile(file));
          }
          return results;
        };
      })(this));
    }, function() {
      return this.on("update_settings", (function(_this) {
        return function() {
          var layer;
          layer = _this.getShowingLayer();
          if (layer.name !== ActionBook.home.name) {
            console.log("Updated Settings, Current Layer:", layer.name);
            return layer.setup();
          }
        };
      })(this));
    }, function() {
      return setInterval(this._upkeepIntervalCallback, 10000);
    }
  ];

  Application.prototype.loadData = function() {
    Hypothesis.all((function(_this) {
      return function(d) {
        _this.hypotheses = d;
        return _this.emit("render-hypotheses");
      };
    })(this));
    Sample.all((function(_this) {
      return function(d) {
        _this.samples = d;
        return _this.emit("render-samples");
      };
    })(this));
    Analysis.all((function(_this) {
      return function(d) {
        _this.analyses = d;
        return _this.emit("render-analyses");
      };
    })(this));
    Task.all((function(_this) {
      return function(d) {
        _this.tasks = d;
        return _this.updateTaskList();
      };
    })(this));
    return this.colors.update();
  };

  Application.prototype.downloadFile = function(filePath) {
    return window.location = "/internal/file_download/" + btoa(filePath);
  };

  Application.prototype.displayMessageModal = function(message) {
    var container;
    container = $("#message-modal");
    container.find('.modal-content').html(message);
    return container.openModal();
  };

  Application.prototype.ajaxWithContext = function(url, options) {
    var data;
    if (options == null) {
      options = {
        data: {}
      };
    }
    data = options.data;
    data['settings'] = this.settings;
    data['context'] = this.context;
    options.method = "POST";
    options.data = JSON.stringify(data);
    options.contentType = "application/json";
    return $.ajax(url, options);
  };

  Application.prototype._upkeepIntervalCallback = function() {
    var handler, msgType, ref;
    if (this.eventStream.readyState === 2) {
      this.connectEventSource();
      ref = this.messageHandlers;
      for (msgType in ref) {
        handler = ref[msgType];
        this.handleMessage(msgType, handler);
      }
    }
    return true;
  };

  Application.prototype.setHypothesisContext = function(hypothseisUUID) {
    return this.context.hypothseisUUID = hypothseisUUID;
  };

  return Application;

})(ActionLayerManager);

renderTask = function(task) {
  return '<li data-id=\'{id}\' data-status=\'{status}\'><b>{name}</b> ({status})</li>'.format(task);
};

$(function() {
  var options;
  window.GlycReSoft = new Application(options = {
    actionContainer: ".action-layer-container"
  });
  GlycReSoft.runInitializers();
  GlycReSoft.updateSettings();
  return GlycReSoft.updateTaskList();
});

//# sourceMappingURL=Application-common.js.map

var ActionBook, Analysis, Hypothesis, Sample, Task, makeAPIGet, makeParameterizedAPIGet;

ActionBook = {
  home: {
    container: '#home-layer',
    name: 'home-layer',
    closeable: false
  },
  addSample: {
    contentURL: '/add_sample',
    name: 'add-sample'
  },
  glycanCompositionSearch: {
    contentURL: '/search_glycan_composition/run_search',
    name: 'search-glycan-composition'
  },
  glycopeptideSequenceSearch: {
    contentURL: '/search_glycopeptide_sequences/run_search',
    name: "search-glycopeptide-sequences"
  },
  naiveGlycopeptideSearchSpace: {
    contentURL: "/glycopeptide_search_space",
    name: "glycopeptide-search-space"
  },
  naiveGlycanSearchSpace: {
    contentURL: "/glycan_search_space",
    name: "glycan-search-space"
  },
  viewAnalysis: {
    contentURLTemplate: "/view_analysis/{analysis_id}",
    name: "view-analysis",
    method: "post"
  },
  viewHypothesis: {
    contentURLTemplate: "/view_hypothesis/{uuid}",
    method: "post"
  }
};

makeAPIGet = function(url) {
  return function(callback) {
    return $.get(url).success(callback);
  };
};

makeParameterizedAPIGet = function(url) {
  return function(params, callback) {
    return $.get(url.format(params)).success(callback);
  };
};

Hypothesis = {
  all: makeAPIGet("/api/hypotheses"),
  get: makeParameterizedAPIGet("/api/hypotheses/{}")
};

Sample = {
  all: makeAPIGet("/api/samples")
};

Analysis = {
  all: makeAPIGet("/api/analyses")
};

Task = {
  all: makeAPIGet("/api/tasks")
};

//# sourceMappingURL=bind-urls.js.map

var ConstraintInputGrid, MonosaccharideInputWidgetGrid;

MonosaccharideInputWidgetGrid = (function() {
  MonosaccharideInputWidgetGrid.prototype.template = "<div class='monosaccharide-row row'>\n    <div class='input-field col s3'>\n        <label for='mass_shift_name'>Monosaccharide Name</label>\n        <input class='monosaccharide-name' type='text' name='monosaccharide_name' placeholder='Name'>\n    </div>\n    <div class='input-field col s3'>\n        <label for='monosaccharide_mass_delta'>Lower Bound</label>\n        <input class='lower-bound numeric-entry' type='number' name='monosaccharide_lower_bound' placeholder='Lower Bound'>\n    </div>\n    <div class='input-field col s3'>\n        <label for='monosaccharide_max_count'>Upper Bound</label>    \n        <input class='upper-bound numeric-entry' type='number' min='0' placeholder='Upper Bound' name='monosaccharide_upper_bound'>\n    </div>\n</div>";

  function MonosaccharideInputWidgetGrid(container) {
    this.counter = 0;
    this.container = $(container);
    this.monosaccharides = {};
  }

  MonosaccharideInputWidgetGrid.prototype.update = function() {
    var entry, i, len, monosaccharides, notif, notify, ref, row;
    monosaccharides = {};
    ref = this.container.find(".monosaccharide-row");
    for (i = 0, len = ref.length; i < len; i++) {
      row = ref[i];
      row = $(row);
      console.log(row);
      entry = {
        name: row.find(".monosaccharide-name").val(),
        lower_bound: row.find(".lower-bound").val(),
        upper_bound: row.find(".upper-bound").val()
      };
      if (entry.name === "") {
        continue;
      }
      if (entry.name in monosaccharides) {
        row.addClass("warning");
        notify = new TinyNotification(0, 0, "This monosaccharide is already present.", row);
        row.data("tinyNotification", notify);
        console.log(notify);
      } else {
        row.removeClass("warning");
        if (row.data("tinyNotification") != null) {
          notif = row.data("tinyNotification");
          notif.dismiss();
          row.data("tinyNotification", void 0);
        }
        monosaccharides[entry.name] = entry;
      }
    }
    console.log(monosaccharides);
    return this.monosaccharides = monosaccharides;
  };

  MonosaccharideInputWidgetGrid.prototype.addEmptyRowOnEdit = function(addHeader) {
    var callback, row, self;
    if (addHeader == null) {
      addHeader = false;
    }
    row = $(this.template);
    if (!addHeader) {
      row.find("label").remove();
    }
    this.container.append(row);
    row.data("counter", ++this.counter);
    self = this;
    callback = function(event) {
      if (row.data("counter") === self.counter) {
        self.addEmptyRowOnEdit(false);
      }
      return $(this).parent().find("label").removeClass("active");
    };
    row.find("input").change(callback);
    return row.find("input").change((function(_this) {
      return function() {
        return _this.update();
      };
    })(this));
  };

  MonosaccharideInputWidgetGrid.prototype.addRow = function(name, lower, upper, composition, addHeader) {
    var row;
    if (addHeader == null) {
      addHeader = false;
    }
    row = $(this.template);
    if (!addHeader) {
      row.find("label").remove();
    }
    this.counter += 1;
    row.find(".monosaccharide-name").val(name);
    row.find(".lower-bound").val(lower);
    row.find(".upper-bound").val(upper);
    this.container.append(row);
    row.find("input").change((function(_this) {
      return function() {
        return _this.update();
      };
    })(this));
    console.log(row);
    return this.update();
  };

  return MonosaccharideInputWidgetGrid;

})();

ConstraintInputGrid = (function() {
  ConstraintInputGrid.prototype.template = "<div class=\"monosaccharide-constraints-row row\">\n    <div class='input-field col s4'>\n        <label for='left_hand_side'>Name</label>\n        <input class='monosaccharide-name' type='text' name='left_hand_side' placeholder='Name'>\n    </div>\n    <div class='input-field col s1' style='padding-left: 2px;padding-right: 2px;'>\n        <select class='browser-default' name='operator'>\n            <option>=</option>\n            <option>!=</option>\n            <option>&gt;</option>\n            <option>&lt;</option>\n            <option>&gt;=</option>\n            <option>&lt;=</option>\n        </select>\n    </div>\n    <div class='input-field col s4'>\n        <label for='right_hand_side'>Name/Value</label>\n        <input class='monosaccharide-name' type='text' name='right_hand_side' placeholder='Name/Value'>\n    </div>\n</div>";

  function ConstraintInputGrid(container, monosaccharideGrid) {
    this.counter = 0;
    this.container = $(container);
    this.constraints = [];
    this.monosaccharideGrid = monosaccharideGrid;
  }

  ConstraintInputGrid.prototype.addEmptyRowOnEdit = function(addHeader) {
    var callback, row, self;
    if (addHeader == null) {
      addHeader = false;
    }
    row = $(this.template);
    if (!addHeader) {
      row.find("label").remove();
    }
    this.container.append(row);
    row.data("counter", ++this.counter);
    self = this;
    callback = function(event) {
      if (row.data("counter") === self.counter) {
        self.addEmptyRowOnEdit(false);
      }
      return $(this).parent().find("label").removeClass("active");
    };
    row.find("input").change(callback);
    return row.find("input").change((function(_this) {
      return function() {
        return _this.update();
      };
    })(this));
  };

  ConstraintInputGrid.prototype.addRow = function(lhs, op, rhs, addHeader) {
    var row;
    if (addHeader == null) {
      addHeader = false;
    }
    row = $(this.template);
    if (!addHeader) {
      row.find("label").remove();
    }
    this.counter += 1;
    row.find("input[name='left_hand_side']").val(lhs);
    row.find("select[name='operator']").val(op);
    row.find("input[name='right_hand_side']").val(rhs);
    this.container.append(row);
    row.find("input").change((function(_this) {
      return function() {
        return _this.update();
      };
    })(this));
    console.log(row);
    return this.update();
  };

  ConstraintInputGrid.prototype.update = function() {
    var constraints, entry, i, len, ref, row;
    constraints = [];
    ref = this.container.find(".monosaccharide-constraints-row");
    for (i = 0, len = ref.length; i < len; i++) {
      row = ref[i];
      row = $(row);
      console.log(row);
      entry = {
        lhs: row.find("input[name='left_hand_side']").val(),
        operator: row.find("select[name='operator']").val(),
        rhs: row.find("input[name='right_hand_side']").val()
      };
      if (entry.lhs === "" || entry.rhs === "") {
        continue;
      }
      constraints.push(entry);
    }
    console.log(constraints);
    return this.constraints = constraints;
  };

  return ConstraintInputGrid;

})();

//# sourceMappingURL=glycan-composition-builder-ui.js.map

var analysisTypeDisplayMap;

analysisTypeDisplayMap = {
  "glycan_lc_ms": "Glycan LC-MS",
  "glycopeptide_lc_msms": "Glycopeptide LC-MS/MS"
};

Application.prototype.renderAnalyses = function(container) {
  var analysis, chunks, row, self, template;
  chunks = [];
  template = (function() {
    var i, len, ref, results;
    ref = _.sortBy(_.values(this.analyses), function(o) {
      return o.id;
    });
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      analysis = ref[i];
      analysis.name = analysis.name !== '' ? analysis.name : "Analysis:" + analysis.uuid;
      row = $("<div data-id=" + analysis.id + " class='list-item clearfix' data-uuid='" + analysis.uuid + "'> <span class='handle user-provided-name'>" + analysis.id + ". " + (analysis.name.replace(/_/g, ' ')) + "</span> <small class='right' style='display:inherit'> " + analysisTypeDisplayMap[analysis.analysis_type] + " <a class='remove-analysis mdi-content-clear'></a> </small> </div>");
      chunks.push(row);
      self = this;
      row.click(function(event) {
        var handle, id;
        handle = $(this);
        id = handle.attr('data-id');
        self.addLayer(ActionBook.viewAnalysis, {
          analysis_id: id
        });
        console.log(self.layers);
        console.log(self.lastAdded);
        self.context["analysis_id"] = id;
        return self.setShowingLayer(self.lastAdded);
      });
      results.push(row.find(".remove-analysis").click(function(event) {
        var handle;
        handle = $(this);
        return console.log("Removal of Analysis is not implemented.");
      }));
    }
    return results;
  }).call(this);
  return $(container).html(chunks);
};

Application.initializers.push(function() {
  return this.on("render-analyses", (function(_this) {
    return function() {
      return _this.renderAnalyses(".analysis-list");
    };
  })(this));
});

//# sourceMappingURL=home-analysis-list-ui.js.map

Application.prototype.renderHypothesisListAt = function(container) {
  var chunks, hypothesis, i, j, len, ref, row, self, template;
  chunks = [];
  template = '';
  self = this;
  i = 0;
  ref = _.sortBy(_.values(this.hypotheses), function(o) {
    return o.id;
  });
  for (j = 0, len = ref.length; j < len; j++) {
    hypothesis = ref[j];
    row = $("<div data-id=" + hypothesis.id + " data-uuid=" + hypothesis.uuid + " class='list-item clearfix'> <span class='handle user-provided-name'>" + i + ". " + (hypothesis.name.replace(/_/g, ' ')) + "</span> <small class='right' style='display:inherit'> " + (hypothesis.hypothesis_type != null ? hypothesis.hypothesis_type : '-') + " <a class='remove-hypothesis mdi mdi-close'></a> </small> </div>");
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

var MassShiftInputWidget;

MassShiftInputWidget = (function() {
  var addEmptyRowOnEdit, counter, template;
  template = "<div class='mass-shift-row row'>\n    <div class='input-field col s3'>\n        <label for='mass_shift_name'>Name or Formula</label>\n        <input class='mass-shift-name' type='text' name='mass_shift_name' placeholder='Name/Formula'>\n    </div>\n    <div class='input-field col s2'>\n        <label for='mass_shift_max_count'>Maximum Count</label>    \n        <input class='max-count' type='number' min='0' placeholder='Maximum Count' name='mass_shift_max_count'>\n    </div>\n</div>";
  counter = 0;
  addEmptyRowOnEdit = function(container, addHeader) {
    var callback, row;
    if (addHeader == null) {
      addHeader = true;
    }
    container = $(container);
    if (addHeader) {
      row = $(template);
    } else {
      row = $(template);
      row.find("label").remove();
    }
    container.append(row);
    row.data("counter", ++counter);
    callback = function(event) {
      if (row.data("counter") === counter) {
        addEmptyRowOnEdit(container, false);
      }
      return $(this).parent().find("label").removeClass("active");
    };
    return row.find("input").change(callback);
  };
  return addEmptyRowOnEdit;
})();

//# sourceMappingURL=mass-shift-ui.js.map

var MonosaccharideFilter, MonosaccharideFilterState, makeMonosaccharideFilter, makeMonosaccharideRule, makeRuleSet;

makeMonosaccharideRule = function(count) {
  return {
    minimum: 0,
    maximum: count,
    include: true
  };
};

makeRuleSet = function(upperBounds) {
  var count, residue, residueNames, rules;
  residueNames = Object.keys(upperBounds);
  rules = {};
  for (residue in upperBounds) {
    count = upperBounds[residue];
    rules[residue] = makeMonosaccharideRule(count);
  }
  return rules;
};

makeMonosaccharideFilter = function(parent, upperBounds) {
  var residueNames, rules;
  if (upperBounds == null) {
    upperBounds = GlycReSoft.settings.monosaccharide_filters;
  }
  residueNames = Object.keys(upperBounds);
  rules = makeRuleSet(upperBounds);
  return new MonosaccharideFilter(parent, residueNames, rules);
};

MonosaccharideFilterState = (function() {
  function MonosaccharideFilterState(application) {
    this.application = application;
    this.setHypothesis(null);
  }

  MonosaccharideFilterState.prototype.setHypothesis = function(hypothesis) {
    if (hypothesis != null) {
      this.currentHypothesis = hypothesis;
      this.hypothesisUUID = this.currentHypothesis.uuid;
      this.hypothesisType = this.currentHypothesis.hypothesis_type;
      return this.bounds = makeRuleSet(this.currentHypothesis.monosaccharide_bounds);
    } else {
      this.currentHypothesis = null;
      this.hypothesisUUID = null;
      this.hypothesisType = null;
      return this.bounds = {};
    }
  };

  MonosaccharideFilterState.prototype.isSameHypothesis = function(hypothesis) {
    return hypothesis.uuid === this.hypothesisUUID;
  };

  MonosaccharideFilterState.prototype.setApplicationFilter = function() {
    console.log("Updating Filters", this.bounds);
    return this.application.settings.monosaccharide_filters = this.bounds;
  };

  MonosaccharideFilterState.prototype.update = function(hypothesisUUID, callback) {
    console.log("Is Hypothesis New?");
    console.log(hypothesisUUID, this.hypothesisUUID);
    if (hypothesisUUID !== this.hypothesisUUID) {
      console.log("Is New Hypothesis");
      return Hypothesis.get(hypothesisUUID, (function(_this) {
        return function(result) {
          var hypothesis;
          hypothesis = result.hypothesis;
          _this.setHypothesis(hypothesis);
          _this.setApplicationFilter();
          return callback(_this.bounds);
        };
      })(this));
    } else {
      console.log("Is not new hypothesis");
      this.setApplicationFilter();
      return callback(this.bounds);
    }
  };

  return MonosaccharideFilterState;

})();

MonosaccharideFilter = (function() {
  function MonosaccharideFilter(parent, residueNames, rules) {
    if (rules == null) {
      if (GlycReSoft.settings.monosaccharide_filters == null) {
        GlycReSoft.settings.monosaccharide_filters = {};
      }
      rules = GlycReSoft.settings.monosaccharide_filters;
    }
    if (residueNames == null) {
      console.log("Getting Residue Names", GlycReSoft.settings.monosaccharide_filters);
      residueNames = Object.keys(GlycReSoft.settings.monosaccharide_filters);
    }
    this.container = $("<div></div>").addClass("row");
    $(parent).append(this.container);
    this.residueNames = residueNames;
    this.rules = rules;
  }

  MonosaccharideFilter.prototype.makeFilterWidget = function(residue) {
    var rendered, rule, sanitizeName, self, template;
    rule = this.rules[residue];
    if (rule == null) {
      rule = {
        minimum: 0,
        maximum: 10,
        include: true
      };
      this.rules[residue] = rule;
    }
    residue.name = residue;
    residue.sanitizeName = sanitizeName = residue.replace(/[\(\),]/g, "_");
    template = "<span class=\"col s2 monosaccharide-filter\" data-name='" + residue + "'>\n    <p style='margin: 0px; margin-bottom: -10px;'>\n        <input type=\"checkbox\" id=\"" + sanitizeName + "_include\" name=\"" + sanitizeName + "_include\"/>\n        <label for=\"" + sanitizeName + "_include\"><b>" + residue + "</b></label>\n    </p>\n    <p style='margin-top: 0px; margin-bottom: 0px;'>\n        <input id=\"" + sanitizeName + "_min\" type=\"number\" placeholder=\"Minimum " + residue + "\" style='width: 45px;' min=\"0\"\n               value=\"" + rule.minimum + "\" max=\"" + rule.maximum + "\" name=\"" + sanitizeName + "_min\"/> : \n        <input id=\"" + sanitizeName + "_max\" type=\"number\" placeholder=\"Maximum " + residue + "\" style='width: 45px;' min=\"0\"\n               value=\"" + rule.maximum + "\" name=\"" + sanitizeName + "_max\"/>\n    </p>\n</span>";
    self = this;
    rendered = $(template);
    rendered.find("#" + sanitizeName + "_min").change(function() {
      rule.minimum = parseInt($(this).val());
      return self.changed();
    });
    rendered.find("#" + sanitizeName + "_max").change(function() {
      rule.maximum = parseInt($(this).val());
      return self.changed();
    });
    rendered.find("#" + sanitizeName + "_include").prop("checked", rule.include).click(function() {
      rule.include = $(this).prop("checked");
      return self.changed();
    });
    return rendered;
  };

  MonosaccharideFilter.prototype.render = function() {
    var i, len, ref, residue, results, widget;
    ref = this.residueNames;
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      residue = ref[i];
      widget = this.makeFilterWidget(residue);
      results.push(this.container.append(widget));
    }
    return results;
  };

  MonosaccharideFilter.prototype.changed = function() {
    var old;
    console.log("MonosaccharideFilter changed");
    if (this.rules == null) {
      console.log("No rules", this, this.rules);
    }
    old = GlycReSoft.settings.monosaccharide_filters;
    console.log("Updating monosaccharide_filters");
    GlycReSoft.settings.monosaccharide_filters = this.rules;
    console.log(old, GlycReSoft.settings.monosaccharide_filters);
    return GlycReSoft.emit("update_settings");
  };

  return MonosaccharideFilter;

})();

//# sourceMappingURL=monosaccharide-composition-filter.js.map

var makePresetSelector, samplePreprocessingPresets, setSamplePreprocessingConfiguration;

samplePreprocessingPresets = [
  {
    name: "Negative Mode Glycomics",
    max_charge: -9,
    ms1_score_threshold: 15,
    ms1_averagine: "glycan",
    max_missing_peaks: 1
  }, {
    name: "Positive Mode Glycoproteomics",
    max_charge: 12,
    max_missing_peaks: 1,
    ms1_score_threshold: 35,
    ms1_averagine: "glycopeptide",
    msn_score_threshold: 5,
    msn_averagine: 'peptide'
  }
];

setSamplePreprocessingConfiguration = function(name) {
  var config, form, found, i, len;
  found = false;
  for (i = 0, len = samplePreprocessingPresets.length; i < len; i++) {
    config = samplePreprocessingPresets[i];
    if (config.name === name) {
      found = true;
      break;
    }
  }
  if (!found) {
    return;
  }
  form = $("#add-sample");
  form.find("#maximum-charge-state").val(config.max_charge);
  form.find("#missed-peaks").val(config.max_missing_peaks);
  form.find('#ms1-minimum-isotopic-score').val(config.ms1_score_threshold);
  form.find('#ms1-averagine').val(config.ms1_averagine);
  if (config.msn_score_threshold != null) {
    form.find('#msn-minimum-isotopic-score').val(config.msn_score_threshold);
  }
  if (config.msn_averagine != null) {
    return form.find('#msn-averagine').val(config.msn_averagine);
  }
};

makePresetSelector = function(container) {
  var elem, i, len, preset;
  elem = $('<select style=\'browser-default\' name=\'preset-configuration>\n</select>');
  for (i = 0, len = samplePreprocessingPresets.length; i < len; i++) {
    preset = samplePreprocessingPresets[i];
    elem.append($("<option value='" + preset.name + "'>" + preset.name + "</option>"));
  }
  container.append(elem);
  return elem.change(function(event, name) {
    return console.log(arguments);
  });
};

//# sourceMappingURL=sample-preprocessing-configurations.js.map

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

var viewGlycanCompositionHypothesis;

viewGlycanCompositionHypothesis = function(hypothesisId) {
  var currentPage, detailModal, displayTable, setup, setupGlycanCompositionTablePageHandler, updateCompositionTablePage;
  detailModal = void 0;
  displayTable = void 0;
  currentPage = 1;
  setup = function() {
    displayTable = $("#composition-table-container");
    return updateCompositionTablePage(1);
  };
  setupGlycanCompositionTablePageHandler = function(page) {
    if (page == null) {
      page = 1;
    }
    $('.display-table tbody tr').click(function() {});
    $(':not(.disabled) .next-page').click(function() {
      return updateCompositionTablePage(page + 1);
    });
    $(':not(.disabled) .previous-page').click(function() {
      return updateCompositionTablePage(page - 1);
    });
    return $('.pagination li :not(.active)').click(function() {
      var nextPage;
      nextPage = $(this).attr("data-index");
      if (nextPage != null) {
        nextPage = parseInt(nextPage);
        return updateCompositionTablePage(nextPage);
      }
    });
  };
  updateCompositionTablePage = function(page) {
    var url;
    if (page == null) {
      page = 1;
    }
    url = "/view_glycan_composition_hypothesis/" + hypothesisId + "/" + page;
    console.log(url);
    return GlycReSoft.ajaxWithContext(url).success(function(doc) {
      currentPage = page;
      displayTable.html(doc);
      return setupGlycanCompositionTablePageHandler(page);
    });
  };
  return setup();
};

//# sourceMappingURL=view-glycan-composition-hypothesis.js.map

var GlycanCompositionLCMSSearchController, GlycanCompositionLCMSSearchPaginator, GlycanCompositionLCMSSearchTabView,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

GlycanCompositionLCMSSearchPaginator = (function(superClass) {
  extend(GlycanCompositionLCMSSearchPaginator, superClass);

  GlycanCompositionLCMSSearchPaginator.prototype.pageUrl = "/view_glycan_lcms_analysis/{analysisId}/page/{page}";

  GlycanCompositionLCMSSearchPaginator.prototype.tableSelector = ".glycan-chromatogram-table";

  GlycanCompositionLCMSSearchPaginator.prototype.tableContainerSelector = "#chromatograms-table";

  GlycanCompositionLCMSSearchPaginator.prototype.rowSelector = '.glycan-match-row';

  function GlycanCompositionLCMSSearchPaginator(analysisId, handle1, controller) {
    this.analysisId = analysisId;
    this.handle = handle1;
    this.controller = controller;
    this.rowClickHandler = bind(this.rowClickHandler, this);
    GlycanCompositionLCMSSearchPaginator.__super__.constructor.call(this, 1);
  }

  GlycanCompositionLCMSSearchPaginator.prototype.getPageUrl = function(page) {
    if (page == null) {
      page = 1;
    }
    return this.pageUrl.format({
      "page": page,
      "analysisId": this.analysisId
    });
  };

  GlycanCompositionLCMSSearchPaginator.prototype.rowClickHandler = function(row) {
    return this.controller.showGlycanCompositionDetailsModal(row);
  };

  return GlycanCompositionLCMSSearchPaginator;

})(PaginationBase);

GlycanCompositionLCMSSearchTabView = (function(superClass) {
  extend(GlycanCompositionLCMSSearchTabView, superClass);

  GlycanCompositionLCMSSearchTabView.prototype.tabSelector = 'ul.tabs';

  GlycanCompositionLCMSSearchTabView.prototype.tabList = ["chromatograms-plot", "chromatograms-table", "summary-abundance-plot"];

  GlycanCompositionLCMSSearchTabView.prototype.defaultTab = "chromatograms-plot";

  GlycanCompositionLCMSSearchTabView.prototype.updateUrl = '/view_glycan_lcms_analysis/{analysisId}/content';

  GlycanCompositionLCMSSearchTabView.prototype.containerSelector = '#glycan-lcms-content-container';

  function GlycanCompositionLCMSSearchTabView(analysisId, handle1, parent1, updateHandlers) {
    var parent;
    this.analysisId = analysisId;
    this.handle = handle1;
    this.parent = parent1;
    parent = this.parent;
    GlycanCompositionLCMSSearchTabView.__super__.constructor.call(this, updateHandlers);
  }

  GlycanCompositionLCMSSearchTabView.prototype.getUpdateUrl = function() {
    return this.updateUrl.format({
      'analysisId': this.analysisId
    });
  };

  return GlycanCompositionLCMSSearchTabView;

})(TabViewBase);

GlycanCompositionLCMSSearchController = (function() {
  GlycanCompositionLCMSSearchController.prototype.containerSelector = '#glycan-lcms-container';

  GlycanCompositionLCMSSearchController.prototype.detailModalSelector = '#glycan-detail-modal';

  GlycanCompositionLCMSSearchController.prototype.detailUrl = "/view_glycan_lcms_analysis/{analysisId}/details_for/{chromatogramId}";

  GlycanCompositionLCMSSearchController.prototype.saveCSVURL = "/view_glycan_lcms_analysis/{analysisId}/to-csv";

  GlycanCompositionLCMSSearchController.prototype.monosaccharideFilterContainerSelector = '#monosaccharide-filters';

  function GlycanCompositionLCMSSearchController(analysisId, hypothesisUUID, monosaccharides) {
    var updateHandlers;
    this.analysisId = analysisId;
    this.hypothesisUUID = hypothesisUUID;
    this.monosaccharides = monosaccharides != null ? monosaccharides : {
      "Hex": 10,
      "HexNAc": 10,
      "Fuc": 10,
      "Neu5Ac": 10
    };
    this.handle = $(this.containerSelector);
    this.paginator = new GlycanCompositionLCMSSearchPaginator(this.analysisId, this.handle, this);
    updateHandlers = [
      (function(_this) {
        return function() {
          return _this.paginator.setupTable();
        };
      })(this), (function(_this) {
        return function() {
          var handle;
          handle = $(_this.tabView.containerSelector);
          $.get("/view_glycan_lcms_analysis/" + _this.analysisId + "/chromatograms_chart").success(function(payload) {
            return handle.find("#chromatograms-plot").html(payload);
          });
          return $.get("/view_glycan_lcms_analysis/" + _this.analysisId + "/abundance_bar_chart").success(function(payload) {
            return handle.find("#summary-abundance-plot").html(payload);
          });
        };
      })(this)
    ];
    this.tabView = new GlycanCompositionLCMSSearchTabView(this.analysisId, this.handle, this, updateHandlers);
    this.setup();
  }

  GlycanCompositionLCMSSearchController.prototype.setup = function() {
    var filterContainer, self;
    this.handle.find(".tooltipped").tooltip();
    self = this;
    this.handle.find("#save-csv-btn").click(function(event) {
      var url;
      url = self.saveCSVURL.format({
        analysisId: self.analysisId
      });
      return $.get(url).success(function(info) {
        return GlycReSoft.downloadFile(info.filename);
      });
    });
    this.updateView();
    filterContainer = $(this.monosaccharideFilterContainerSelector);
    return GlycReSoft.monosaccharideFilterState.update(this.hypothesisUUID, (function(_this) {
      return function(bounds) {
        _this.monosaccharideFilter = new MonosaccharideFilter(filterContainer);
        return _this.monosaccharideFilter.render();
      };
    })(this));
  };

  GlycanCompositionLCMSSearchController.prototype.updateView = function() {
    return this.tabView.updateView();
  };

  GlycanCompositionLCMSSearchController.prototype.showGlycanCompositionDetailsModal = function(row) {
    var handle, id, modal, url;
    handle = $(row);
    id = handle.attr('data-target');
    modal = this.getModal();
    url = this.detailUrl.format({
      analysisId: this.analysisId,
      chromatogramId: id
    });
    return $.get(url).success(function(doc) {
      modal.find('.modal-content').html(doc);
      $(".lean-overlay").remove();
      return modal.openModal();
    });
  };

  GlycanCompositionLCMSSearchController.prototype.getModal = function() {
    return $(this.detailModalSelector);
  };

  GlycanCompositionLCMSSearchController.prototype.unload = function() {
    return GlycReSoft.removeCurrentLayer();
  };

  return GlycanCompositionLCMSSearchController;

})();

//# sourceMappingURL=view-glycan-search.js.map

var viewGlycopeptideCompositionHypothesis;

viewGlycopeptideCompositionHypothesis = function(hypothesisId) {
  var currentPage, displayTable, proteinContainer, proteinId, setup, setupGlycopeptideCompositionTablePageHandler, updateCompositionTablePage, updateProteinChoice;
  displayTable = void 0;
  currentPage = 1;
  proteinContainer = void 0;
  proteinId = void 0;
  setup = function() {
    proteinContainer = $("#protein-container");
    $('.protein-list-table tbody tr').click(updateProteinChoice);
    return updateProteinChoice.apply($('.protein-list-table tbody tr'));
  };
  setupGlycopeptideCompositionTablePageHandler = function(page) {
    if (page == null) {
      page = 1;
    }
    $('.display-table tbody tr').click(function() {});
    $(':not(.disabled) .next-page').click(function() {
      return updateCompositionTablePage(page + 1);
    });
    $(':not(.disabled) .previous-page').click(function() {
      return updateCompositionTablePage(page - 1);
    });
    return $('.pagination li :not(.active)').click(function() {
      var nextPage;
      nextPage = $(this).attr("data-index");
      if (nextPage != null) {
        nextPage = parseInt(nextPage);
        return updateCompositionTablePage(nextPage);
      }
    });
  };
  updateProteinChoice = function() {
    var handle, id, url;
    handle = $(this);
    proteinId = id = handle.attr('data-target');
    proteinContainer.html("<div class=\"progress\"><div class=\"indeterminate\"></div></div>").fadeIn();
    url = "/view_glycopeptide_composition_hypothesis/protein_view/" + proteinId;
    return $.post(url, {
      "settings": GlycReSoft.settings,
      "context": GlycReSoft.context
    }).success(function(doc) {
      proteinContainer.hide();
      proteinContainer.html(doc).fadeIn();
      GlycReSoft.context["current_protein"] = id;
      displayTable = $("#display-table-container");
      return updateCompositionTablePage(1);
    }).error(function(error) {
      return console.log(arguments);
    });
  };
  updateCompositionTablePage = function(page) {
    var url;
    if (page == null) {
      page = 1;
    }
    url = "/view_glycopeptide_composition_hypothesis/protein_view/" + proteinId + "/" + page;
    console.log(url);
    return GlycReSoft.ajaxWithContext(url).success(function(doc) {
      currentPage = page;
      displayTable.html(doc);
      return setupGlycopeptideCompositionTablePageHandler(page);
    });
  };
  return setup();
};

//# sourceMappingURL=view-glycopeptide-composition-hypothesis.js.map

var GlycopeptideHypothesisController, GlycopeptideHypothesisPaginator, viewGlycopeptideHypothesis,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

GlycopeptideHypothesisPaginator = (function(superClass) {
  extend(GlycopeptideHypothesisPaginator, superClass);

  GlycopeptideHypothesisPaginator.prototype.tableSelector = "#display-table-container";

  GlycopeptideHypothesisPaginator.prototype.tableContainerSelector = "#display-table-container";

  GlycopeptideHypothesisPaginator.prototype.rowSelector = "#display-table-container tbody tr";

  GlycopeptideHypothesisPaginator.prototype.pageUrl = "/view_glycopeptide_hypothesis/{hypothesisId}/{proteinId}/page/{page}";

  function GlycopeptideHypothesisPaginator(hypothesisId1, handle1, controller) {
    this.hypothesisId = hypothesisId1;
    this.handle = handle1;
    this.controller = controller;
    this.rowClickHandler = bind(this.rowClickHandler, this);
    GlycopeptideHypothesisPaginator.__super__.constructor.call(this, 1);
  }

  GlycopeptideHypothesisPaginator.prototype.getPageUrl = function(page) {
    if (page == null) {
      page = 1;
    }
    return this.pageUrl.format({
      "page": page,
      "hypothesisId": this.hypothesisId,
      "proteinId": this.controller.proteinId
    });
  };

  GlycopeptideHypothesisPaginator.prototype.rowClickHandler = function(row) {
    return console.log(row);
  };

  return GlycopeptideHypothesisPaginator;

})(PaginationBase);

GlycopeptideHypothesisController = (function() {
  GlycopeptideHypothesisController.prototype.containerSelector = '#hypothesis-protein-glycopeptide-container';

  GlycopeptideHypothesisController.prototype.proteinTableRowSelector = '.protein-list-table tbody tr';

  GlycopeptideHypothesisController.prototype.proteinContainerSelector = '#protein-container';

  GlycopeptideHypothesisController.prototype.proteinViewUrl = "/view_glycopeptide_hypothesis/{hypothesisId}/{proteinId}/view";

  function GlycopeptideHypothesisController(hypothesisId1, proteinId1) {
    this.hypothesisId = hypothesisId1;
    this.proteinId = proteinId1;
    this.proteinChoiceHandler = bind(this.proteinChoiceHandler, this);
    this.handle = $(this.containerSelector);
    this.paginator = new GlycopeptideHypothesisPaginator(this.hypothesisId, this.handle, this);
    this.setup();
  }

  GlycopeptideHypothesisController.prototype.setup = function() {
    var self;
    self = this;
    $(this.proteinTableRowSelector).click(function(event) {
      return self.proteinChoiceHandler(this);
    });
    return self.proteinChoiceHandler($(this.proteinTableRowSelector)[0]);
  };

  GlycopeptideHypothesisController.prototype.getProteinViewUrl = function(proteinId) {
    return this.proteinViewUrl.format({
      'hypothesisId': this.hypothesisId,
      'proteinId': 'proteinId',
      proteinId: proteinId
    });
  };

  GlycopeptideHypothesisController.prototype.proteinChoiceHandler = function(proteinRow) {
    var handle, id, proteinContainer, url;
    handle = $(proteinRow);
    this.proteinId = id = handle.attr('data-target');
    proteinContainer = $(this.proteinContainerSelector);
    proteinContainer.html("<div class=\"progress\"><div class=\"indeterminate\"></div></div>").fadeIn();
    url = this.getProteinViewUrl(id);
    return GlycReSoft.ajaxWithContext(url).success((function(_this) {
      return function(doc) {
        proteinContainer.hide();
        proteinContainer.html(doc).fadeIn();
        GlycReSoft.context["current_protein"] = id;
        return _this.paginator.setupTable();
      };
    })(this));
  };

  return GlycopeptideHypothesisController;

})();

viewGlycopeptideHypothesis = function(hypothesisId) {
  var currentPage, displayTable, proteinContainer, proteinId, setup, setupGlycopeptideTablePageHandler, updateCompositionTablePage, updateProteinChoice;
  displayTable = void 0;
  currentPage = 1;
  proteinContainer = void 0;
  proteinId = void 0;
  setup = function() {
    proteinContainer = $("#protein-container");
    $('.protein-list-table tbody tr').click(updateProteinChoice);
    return updateProteinChoice.apply($('.protein-list-table tbody tr'));
  };
  setupGlycopeptideTablePageHandler = function(page) {
    if (page == null) {
      page = 1;
    }
    $('.display-table tbody tr').click(function() {});
    $(':not(.disabled) .next-page').click(function() {
      return updateCompositionTablePage(page + 1);
    });
    $(':not(.disabled) .previous-page').click(function() {
      return updateCompositionTablePage(page - 1);
    });
    return $('.pagination li :not(.active)').click(function() {
      var nextPage;
      nextPage = $(this).attr("data-index");
      if (nextPage != null) {
        nextPage = parseInt(nextPage);
        return updateCompositionTablePage(nextPage);
      }
    });
  };
  updateProteinChoice = function() {
    var handle, id, url;
    handle = $(this);
    proteinId = id = handle.attr('data-target');
    proteinContainer.html("<div class=\"progress\"><div class=\"indeterminate\"></div></div>").fadeIn();
    url = "/view_glycopeptide_hypothesis/protein_view/" + proteinId;
    return $.post(url, {
      "settings": GlycReSoft.settings,
      "context": GlycReSoft.context
    }).success(function(doc) {
      proteinContainer.hide();
      proteinContainer.html(doc).fadeIn();
      GlycReSoft.context["current_protein"] = id;
      displayTable = $("#display-table-container");
      return updateCompositionTablePage(1);
    }).error(function(error) {
      return console.log(arguments);
    });
  };
  updateCompositionTablePage = function(page) {
    var url;
    if (page == null) {
      page = 1;
    }
    url = "/view_glycopeptide_hypothesis/protein_view/" + proteinId + "/" + page;
    console.log(url);
    return GlycReSoft.ajaxWithContext(url).success(function(doc) {
      currentPage = page;
      displayTable.html(doc);
      return setupGlycopeptideTablePageHandler(page);
    });
  };
  return setup();
};

//# sourceMappingURL=view-glycopeptide-hypothesis.js.map

var GlycopeptideLCMSMSSearchController, GlycopeptideLCMSMSSearchPaginator, GlycopeptideLCMSMSSearchTabView, PlotGlycoformsManager, PlotManagerBase, SiteSpecificGlycosylationPlotManager,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

GlycopeptideLCMSMSSearchPaginator = (function(superClass) {
  extend(GlycopeptideLCMSMSSearchPaginator, superClass);

  GlycopeptideLCMSMSSearchPaginator.prototype.pageUrl = "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/page/{page}";

  GlycopeptideLCMSMSSearchPaginator.prototype.tableSelector = "#identified-glycopeptide-table";

  GlycopeptideLCMSMSSearchPaginator.prototype.tableContainerSelector = "#glycopeptide-table";

  GlycopeptideLCMSMSSearchPaginator.prototype.rowSelector = '.glycopeptide-match-row';

  function GlycopeptideLCMSMSSearchPaginator(analysisId, handle1, controller) {
    this.analysisId = analysisId;
    this.handle = handle1;
    this.controller = controller;
    this.rowClickHandler = bind(this.rowClickHandler, this);
    GlycopeptideLCMSMSSearchPaginator.__super__.constructor.call(this, 1);
  }

  GlycopeptideLCMSMSSearchPaginator.prototype.getPageUrl = function(page) {
    if (page == null) {
      page = 1;
    }
    return this.pageUrl.format({
      "page": page,
      "analysisId": this.analysisId,
      "proteinId": this.controller.proteinId
    });
  };

  GlycopeptideLCMSMSSearchPaginator.prototype.rowClickHandler = function(row) {
    var handle, target;
    handle = $(row);
    target = handle.attr("data-target");
    return this.controller.getGlycopeptideMatchDetails(target);
  };

  return GlycopeptideLCMSMSSearchPaginator;

})(PaginationBase);

GlycopeptideLCMSMSSearchTabView = (function(superClass) {
  extend(GlycopeptideLCMSMSSearchTabView, superClass);

  GlycopeptideLCMSMSSearchTabView.prototype.tabSelector = '#protein-view ul.tabs';

  GlycopeptideLCMSMSSearchTabView.prototype.tabList = ["chromatograms-plot", "chromatograms-table", "summary-abundance-plot"];

  GlycopeptideLCMSMSSearchTabView.prototype.defaultTab = "chromatograms-plot";

  GlycopeptideLCMSMSSearchTabView.prototype.updateUrl = '/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/overview';

  GlycopeptideLCMSMSSearchTabView.prototype.containerSelector = '#glycopeptide-lcmsms-content-container';

  function GlycopeptideLCMSMSSearchTabView(analysisId, handle1, controller, updateHandlers) {
    this.analysisId = analysisId;
    this.handle = handle1;
    this.controller = controller;
    GlycopeptideLCMSMSSearchTabView.__super__.constructor.call(this, updateHandlers);
  }

  GlycopeptideLCMSMSSearchTabView.prototype.getUpdateUrl = function() {
    return this.updateUrl.format({
      'analysisId': this.analysisId,
      'proteinId': this.controller.proteinId
    });
  };

  return GlycopeptideLCMSMSSearchTabView;

})(TabViewBase);

PlotManagerBase = (function() {
  PlotManagerBase.prototype.plotUrl = "";

  PlotManagerBase.prototype.plotContainerSelector = "";

  function PlotManagerBase(handle) {
    this.handle = handle;
  }

  PlotManagerBase.prototype.getPlotUrl = function() {
    return this.plotUrl;
  };

  PlotManagerBase.prototype.updateView = function() {
    return GlycReSoft.ajaxWithContext(this.getPlotUrl()).success((function(_this) {
      return function(doc) {
        var plotContainer;
        plotContainer = _this.handle.find(_this.plotContainerSelector);
        plotContainer.html(doc);
        return _this.setupInteraction(plotContainer);
      };
    })(this));
  };

  PlotManagerBase.prototype.setupInteraction = function(container) {
    return console.log("Setup Interaction Callback");
  };

  return PlotManagerBase;

})();

PlotGlycoformsManager = (function(superClass) {
  extend(PlotGlycoformsManager, superClass);

  PlotGlycoformsManager.prototype.plotUrl = "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/plot_glycoforms";

  PlotGlycoformsManager.prototype.plotContainerSelector = "#protein-overview";

  function PlotGlycoformsManager(handle, controller) {
    this.controller = controller;
    PlotGlycoformsManager.__super__.constructor.call(this, handle);
  }

  PlotGlycoformsManager.prototype.getPlotUrl = function() {
    return this.plotUrl.format({
      "analysisId": this.controller.analysisId,
      "proteinId": this.controller.proteinId
    });
  };

  PlotGlycoformsManager.prototype.glycopeptideTooltipCallback = function(handle) {
    var template;
    template = '<div><table>\n<tr><td style=\'padding:3px;\'><b>MS2 Score:</b> {ms2-score}</td><td style=\'padding:3px;\'><b>Mass:</b> {calculated-mass}</td></tr>\n<tr><td style=\'padding:3px;\'><b>q-value:</b> {q-value}</td><td style=\'padding:3px;\'><b>Spectrum Matches:</b> {spectra-count}</td></tr>\n</table>\n<span>{sequence}</span>\n</div>';
    return template.format({
      'sequence': new PeptideSequence(handle.attr('data-sequence')).format(GlycReSoft.colors),
      'ms2-score': parseFloat(handle.attr('data-ms2-score')).toFixed(4),
      'q-value': handle.attr('data-q-value'),
      "calculated-mass": parseFloat(handle.attr("data-calculated-mass")).toFixed(4),
      "spectra-count": handle.attr("data-spectra-count")
    });
  };

  PlotGlycoformsManager.prototype.modificationTooltipCallback = function(handle) {
    var sequence, template, value;
    template = '<div> <span>{value}</span> </div>';
    value = handle.parent().attr('data-modification-type');
    if (value === 'HexNAc') {
      sequence = $('#' + handle.parent().attr('data-parent')).attr('data-sequence');
      value = 'HexNAc - Glycosylation: ' + sequence.split(/(\[|\{)/).slice(1).join('');
    }
    return template.format({
      'value': value
    });
  };

  PlotGlycoformsManager.prototype.setupTooltips = function() {
    var glycopeptide, self;
    glycopeptide = $('svg .glycopeptide');
    glycopeptide.customTooltip(this.glycopeptideTooltipCallback, 'protein-view-tooltip');
    self = this;
    glycopeptide.hover(function(event) {
      var baseColor, handle, newColor;
      handle = $(this);
      baseColor = handle.find("path").css("fill");
      newColor = '#74DEC5';
      handle.data("baseColor", baseColor);
      return handle.find("path").css("fill", newColor);
    }, function(event) {
      var handle;
      handle = $(this);
      return handle.find("path").css("fill", handle.data("baseColor"));
    });
    glycopeptide.click(function(event) {
      var handle, id;
      handle = $(this);
      id = handle.data("record-id");
      return self.controller.getGlycopeptideMatchDetails(id);
    });
    return $('svg .modification path').customTooltip(this.modificationTooltipCallback, 'protein-view-tooltip');
  };

  PlotGlycoformsManager.prototype.setupInteraction = function(container) {
    this.setupTooltips();
    return GlycReSoft.colors.update();
  };

  return PlotGlycoformsManager;

})(PlotManagerBase);

SiteSpecificGlycosylationPlotManager = (function(superClass) {
  extend(SiteSpecificGlycosylationPlotManager, superClass);

  SiteSpecificGlycosylationPlotManager.prototype.plotUrl = "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/site_specific_glycosylation";

  SiteSpecificGlycosylationPlotManager.prototype.plotContainerSelector = "#site-distribution";

  function SiteSpecificGlycosylationPlotManager(handle, controller) {
    this.controller = controller;
    SiteSpecificGlycosylationPlotManager.__super__.constructor.call(this, handle);
  }

  SiteSpecificGlycosylationPlotManager.prototype.getPlotUrl = function() {
    return this.plotUrl.format({
      "analysisId": this.controller.analysisId,
      "proteinId": this.controller.proteinId
    });
  };

  return SiteSpecificGlycosylationPlotManager;

})(PlotManagerBase);

GlycopeptideLCMSMSSearchController = (function() {
  GlycopeptideLCMSMSSearchController.prototype.containerSelector = '#glycopeptide-lcmsms-container';

  GlycopeptideLCMSMSSearchController.prototype.detailModalSelector = '#glycopeptide-detail-modal';

  GlycopeptideLCMSMSSearchController.prototype.proteinTableRowSelector = '.protein-match-table tbody tr';

  GlycopeptideLCMSMSSearchController.prototype.proteinContainerSelector = '#protein-container';

  GlycopeptideLCMSMSSearchController.prototype.proteinOverviewUrl = "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/overview";

  GlycopeptideLCMSMSSearchController.prototype.detailUrl = "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/details_for/{glycopeptideId}";

  GlycopeptideLCMSMSSearchController.prototype.saveCSVURL = "/view_glycopeptide_lcmsms_analysis/{analysisId}/to-csv";

  GlycopeptideLCMSMSSearchController.prototype.monosaccharideFilterContainerSelector = '#monosaccharide-filters';

  function GlycopeptideLCMSMSSearchController(analysisId, hypothesisUUID, proteinId1) {
    var updateHandlers;
    this.analysisId = analysisId;
    this.hypothesisUUID = hypothesisUUID;
    this.proteinId = proteinId1;
    this.proteinChoiceHandler = bind(this.proteinChoiceHandler, this);
    this.handle = $(this.containerSelector);
    this.paginator = new GlycopeptideLCMSMSSearchPaginator(this.analysisId, this.handle, this);
    this.plotGlycoforms = new PlotGlycoformsManager(this.handle, this);
    this.plotSiteSpecificGlycosylation = new SiteSpecificGlycosylationPlotManager(this.handle, this);
    updateHandlers = [
      (function(_this) {
        return function() {
          _this.paginator.setupTable();
          _this.plotGlycoforms.updateView();
          return _this.plotSiteSpecificGlycosylation.updateView();
        };
      })(this)
    ];
    this.tabView = new GlycopeptideLCMSMSSearchTabView(this.analysisId, this.handle, this, updateHandlers);
    this.setup();
  }

  GlycopeptideLCMSMSSearchController.prototype.getProteinTableRows = function() {
    var handle;
    handle = $(this.proteinTableRowSelector);
    return handle;
  };

  GlycopeptideLCMSMSSearchController.prototype.setup = function() {
    var filterContainer, proteinRowHandle, self;
    proteinRowHandle = $(this.proteinTableRowSelector);
    self = this;
    this.handle.find(".tooltipped").tooltip();
    console.log("Setting up Save Buttons");
    this.handle.find("#save-csv-btn").click(function(event) {
      var url;
      console.log("Clicked Save Button");
      url = self.saveCSVURL.format({
        analysisId: self.analysisId
      });
      return $.get(url).success(function(info) {
        return GlycReSoft.downloadFile(info.filename);
      });
    });
    proteinRowHandle.click(function(event) {
      return self.proteinChoiceHandler(this);
    });
    console.log("setup complete");
    this.proteinChoiceHandler(proteinRowHandle[0]);
    filterContainer = $(this.monosaccharideFilterContainerSelector);
    return GlycReSoft.monosaccharideFilterState.update(this.hypothesisUUID, (function(_this) {
      return function(bounds) {
        _this.monosaccharideFilter = new MonosaccharideFilter(filterContainer);
        return _this.monosaccharideFilter.render();
      };
    })(this));
  };

  GlycopeptideLCMSMSSearchController.prototype.getLastProteinViewed = function() {
    return GlycReSoft.context['protein_id'];
  };

  GlycopeptideLCMSMSSearchController.prototype.selectLastProteinViewed = function() {
    var proteinId;
    return proteinId = this.getLastProteinViewed();
  };

  GlycopeptideLCMSMSSearchController.prototype.updateView = function() {
    return this.tabView.updateView();
  };

  GlycopeptideLCMSMSSearchController.prototype.getModal = function() {
    return $(this.detailModalSelector);
  };

  GlycopeptideLCMSMSSearchController.prototype.unload = function() {
    return GlycReSoft.removeCurrentLayer();
  };

  GlycopeptideLCMSMSSearchController.prototype.getProteinOverviewUrl = function(proteinId) {
    return this.proteinOverviewUrl.format({
      "analysisId": this.analysisId,
      "proteinId": proteinId
    });
  };

  GlycopeptideLCMSMSSearchController.prototype.proteinChoiceHandler = function(row) {
    var handle, id;
    handle = $(row);
    $('.active-row').removeClass("active-row");
    handle.addClass("active-row");
    id = handle.attr('data-target');
    this.proteinId = id;
    $(this.tabView.containerSelector).html('<br>\n<div class="progress" id=\'waiting-for-protein-progress\'>\n    <div class="indeterminate">\n    </div>\n</div>');
    return this.tabView.updateView();
  };

  GlycopeptideLCMSMSSearchController.prototype.getGlycopeptideMatchDetails = function(glycopeptideId) {
    var url;
    url = this.detailUrl.format({
      "analysisId": this.analysisId,
      "proteinId": this.proteinId,
      "glycopeptideId": "glycopeptideId",
      glycopeptideId: glycopeptideId
    });
    return GlycReSoft.ajaxWithContext(url).success((function(_this) {
      return function(doc) {
        var modalHandle;
        modalHandle = _this.getModal();
        modalHandle.find('.modal-content').html(doc);
        $(".lean-overlay").remove();
        return modalHandle.openModal();
      };
    })(this));
  };

  return GlycopeptideLCMSMSSearchController;

})();

//# sourceMappingURL=view-glycopeptide-search.js.map
