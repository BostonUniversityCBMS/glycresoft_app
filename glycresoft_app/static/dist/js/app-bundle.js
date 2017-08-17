var Application, Task, createdAtParser, renderTask,
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
    this.handleMessage("log", (function(_this) {
      return function(data) {
        console.log(data);
      };
    })(this));
    this.handleMessage('update', (function(_this) {
      return function(data) {
        Materialize.toast(data.replace(/"/g, ''), 4000);
      };
    })(this));
    this.handleMessage('task-queued', (function(_this) {
      return function(data) {
        self.tasks[data.id] = Task.create({
          'id': data.id,
          'name': data.name,
          "created_at": data.created_at,
          'status': 'queued'
        });
        self.updateTaskList();
      };
    })(this));
    this.handleMessage('task-start', (function(_this) {
      return function(data) {
        self.tasks[data.id] = Task.create({
          'id': data.id,
          'name': data.name,
          "created_at": data.created_at,
          'status': 'running'
        });
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
          self.tasks[data.id] = Task.create({
            'id': data.id,
            'name': data.name,
            "created_at": data.created_at,
            'status': 'finished'
          });
        }
        self.updateTaskList();
      };
    })(this));
    this.handleMessage("task-stopped", (function(_this) {
      return function(data) {
        var err;
        try {
          self.tasks[data.id].status = 'stopped';
        } catch (_error) {
          err = _error;
          self.tasks[data.id] = Task.create({
            'id': data.id,
            'name': data.name,
            'status': 'stopped'
          });
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
        _this.analyses[data.uuid] = data;
        return _this.emit("render-analyses");
      };
    })(this));
    this.on("layer-change", (function(_this) {
      return function(data) {
        return _this.colors.update();
      };
    })(this));
  }

  Application.prototype.setUser = function(userId, callback) {
    User.set(userId, (function(_this) {
      return function(userId) {
        _this.eventStream.close();
        _this.connectEventSource();
        _this.loadData();
        return Materialize.toast("Logged in as " + userId.user_id);
      };
    })(this));
    if (callback != null) {
      return callback();
    }
  };

  Application.prototype.getUser = function(callback) {
    return User.get(function(userId) {
      return callback(userId.user_id);
    });
  };

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

  Application.prototype.updateTaskList = function(clearFinished) {
    var cancelTask, clickTask, self, taskListContainer, viewLog;
    if (clearFinished == null) {
      clearFinished = true;
    }
    taskListContainer = this.sideNav.find('.task-list-container ul');
    clickTask = function(event) {
      var handle, id, state;
      handle = $(this);
      state = handle.attr('data-status');
      id = handle.attr('data-id');
      if ((state === 'finished' || state === 'stopped') && event.which !== 3) {
        delete self.tasks[id];
        handle.fadeOut();
        handle.remove();
      }
    };
    self = this;
    viewLog = function(event) {
      var completer, created_at, handle, id, modal, name, state, updateWrapper;
      handle = $(this);
      id = handle.attr('data-id');
      name = handle.attr("data-name");
      created_at = handle.attr("data-created-at");
      state = {};
      modal = $("#message-modal");
      updateWrapper = function() {
        var updater;
        updater = function() {
          var status;
          status = taskListContainer.find("li[data-id='" + id + "']").attr('data-status');
          if (status === "running") {
            return $.get("/internal/log/" + name + "-" + created_at).success(function(message) {
              return modal.find(".modal-content").html(message);
            });
          }
        };
        return state.intervalId = setInterval(updater, 5000);
      };
      completer = function() {
        return clearInterval(state.intervalId);
      };
      return $.get("/internal/log/" + name + "-" + created_at).success((function(_this) {
        return function(message) {
          return self.displayMessageModal(message, {
            "ready": updateWrapper,
            "complete": completer
          });
        };
      })(this)).error((function(_this) {
        return function(err) {
          return alert("An error occurred during retrieval. " + (err.toString()));
        };
      })(this));
    };
    cancelTask = function(event) {
      var handle, id, userInput;
      userInput = window.confirm("Are you sure you want to cancel this task?");
      if (userInput) {
        handle = $(this);
        id = handle.attr('data-id');
        return $.get("/internal/cancel_task/" + id);
      }
    };
    taskListContainer.html("");
    taskListContainer.append(_.map(_.sortBy(_.values(this.tasks), ["createdAt"]), renderTask));
    taskListContainer.find('li').map(function(i, li) {
      return contextMenu(li, {
        "View Log": viewLog,
        "Cancel Task": cancelTask
      });
    });
    taskListContainer.find('li').click(clickTask);
    return taskListContainer.find("li").dblclick(viewLog);
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
      var refreshTasks;
      setInterval(this._upkeepIntervalCallback, this.options.upkeepInterval || 10000);
      refreshTasks = (function(_this) {
        return function() {
          return TaskAPI.all(function(d) {
            var key, task;
            for (key in d) {
              task = d[key];
              _this.tasks[key] = task;
            }
            return _this.updateTaskList();
          });
        };
      })(this);
      return setInterval(refreshTasks, this.options.refreshTasksInterval || 250000);
    }
  ];

  Application.prototype.loadData = function() {
    HypothesisAPI.all((function(_this) {
      return function(d) {
        _this.hypotheses = d;
        return _this.emit("render-hypotheses");
      };
    })(this));
    SampleAPI.all((function(_this) {
      return function(d) {
        _this.samples = d;
        return _this.emit("render-samples");
      };
    })(this));
    AnalysisAPI.all((function(_this) {
      return function(d) {
        _this.analyses = d;
        return _this.emit("render-analyses");
      };
    })(this));
    TaskAPI.all((function(_this) {
      return function(d) {
        var data, key;
        for (key in d) {
          data = d[key];
          d[key] = Task.create(data);
        }
        _this.tasks = d;
        return _this.updateTaskList();
      };
    })(this));
    MassShiftAPI.all((function(_this) {
      return function(d) {
        return _this.massShifts = d;
      };
    })(this));
    return this.colors.update();
  };

  Application.prototype.downloadFile = function(filePath) {
    return window.location = "/internal/file_download/" + btoa(filePath);
  };

  Application.prototype.displayMessageModal = function(message, modalArgs) {
    var container;
    container = $("#message-modal");
    container.find('.modal-content').html(message);
    $(".lean-overlay").remove();
    return container.openModal(modalArgs);
  };

  Application.prototype.closeMessageModal = function() {
    var container;
    container = $("#message-modal");
    return container.closeModal();
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
      console.log("Re-establishing EventSource");
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

  Application.prototype.invalidate = function() {
    this.monosaccharideFilterState.invalidate();
    return console.log("Invalidated");
  };

  Application.prototype.isNativeClient = function() {
    return window.nativeClientKey != null;
  };

  return Application;

})(ActionLayerManager);

createdAtParser = /(\d{4})-(\d{2})-(\d{2})\s(\d+)-(\d+)-(\d+(?:\.\d*)?)/;

Task = (function() {
  Task.create = function(obj) {
    return new Task(obj.id, obj.status, obj.name, obj.created_at);
  };

  function Task(id1, status1, name1, created_at1) {
    var _, day, hour, minute, month, ref, seconds, year;
    this.id = id1;
    this.status = status1;
    this.name = name1;
    this.created_at = created_at1;
    ref = this.created_at.match(createdAtParser), _ = ref[0], year = ref[1], month = ref[2], day = ref[3], hour = ref[4], minute = ref[5], seconds = ref[6];
    this.createdAt = new Date(year, month, day, hour, minute, seconds);
  }

  return Task;

})();

renderTask = function(task) {
  var created_at, element, id, name, status;
  name = task.name;
  status = task.status;
  id = task.id;
  created_at = task.created_at;
  element = $("<li data-id=\'" + id + "\' data-status=\'" + status + "\' data-name=\'" + name + "\' data-created-at=\'" + created_at + "\'><b>" + name + "</b> (" + status + ")</li>");
  element.attr("data-name", name);
  return element;
};

//# sourceMappingURL=Application-common.js.map

var ActionBook, AnalysisAPI, ErrorLogURL, HypothesisAPI, MassShiftAPI, SampleAPI, TaskAPI, User, makeAPIGet, makeParameterizedAPIGet;

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
  },
  viewSample: {
    contentURLTemplate: "/view_sample/{sample_id}",
    method: 'get'
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

HypothesisAPI = {
  all: makeAPIGet("/api/hypotheses"),
  get: makeParameterizedAPIGet("/api/hypotheses/{}")
};

SampleAPI = {
  all: makeAPIGet("/api/samples")
};

AnalysisAPI = {
  all: makeAPIGet("/api/analyses")
};

TaskAPI = {
  all: makeAPIGet("/api/tasks")
};

ErrorLogURL = "/log_js_error";

User = {
  get: makeAPIGet("/users/current_user"),
  set: function(user_id, callback) {
    return $.post("/users/login", {
      "user_id": user_id
    }).success(callback);
  }
};

MassShiftAPI = {
  all: makeAPIGet("/api/mass-shift")
};

//# sourceMappingURL=bind-urls.js.map

var ConstraintInputGrid, MonosaccharideInputWidgetGrid;

MonosaccharideInputWidgetGrid = (function() {
  MonosaccharideInputWidgetGrid.prototype.template = "<div class='monosaccharide-row row'>\n    <div class='input-field col s2'>\n        <label for='mass_shift_name'>Residue Name</label>\n        <input class='monosaccharide-name center-align' type='text' name='monosaccharide_name' placeholder='Name'>\n    </div>\n    <div class='input-field col s2'>\n        <label for='monosaccharide_mass_delta'>Lower Bound</label>\n        <input class='lower-bound numeric-entry' min='0' type='number' name='monosaccharide_lower_bound' placeholder='Bound'>\n    </div>\n    <div class='input-field col s2'>\n        <label for='monosaccharide_max_count'>Upper Bound</label>    \n        <input class='upper-bound numeric-entry' type='number' min='0' placeholder='Bound' name='monosaccharide_upper_bound'>\n    </div>\n</div>";

  function MonosaccharideInputWidgetGrid(container) {
    this.counter = 0;
    this.container = $(container);
    this.monosaccharides = {};
  }

  MonosaccharideInputWidgetGrid.prototype.update = function() {
    var continuation, entry, i, len, monosaccharides, notif, notify, pos, ref, row;
    monosaccharides = {};
    ref = this.container.find(".monosaccharide-row");
    for (i = 0, len = ref.length; i < len; i++) {
      row = ref[i];
      row = $(row);
      entry = {
        name: row.find(".monosaccharide-name").val(),
        lower_bound: row.find(".lower-bound").val(),
        upper_bound: row.find(".upper-bound").val()
      };
      if (entry.name === "") {
        row.removeClass("warning");
        if (row.data("tinyNotification") != null) {
          notif = row.data("tinyNotification");
          notif.dismiss();
          row.data("tinyNotification", void 0);
        }
        continue;
      }
      if (entry.name in monosaccharides) {
        row.addClass("warning");
        pos = row.position();
        if (row.data("tinyNotification") != null) {
          notif = row.data("tinyNotification");
          notif.dismiss();
        }
        notify = new TinyNotification(pos.top + 50, pos.left, "This residue is already present.", row);
        row.data("tinyNotification", notify);
      } else {
        row.removeClass("warning");
        if (row.data("tinyNotification") != null) {
          notif = row.data("tinyNotification");
          notif.dismiss();
          row.data("tinyNotification", void 0);
        }
        monosaccharides[entry.name] = entry;
        continuation = function(gridRow) {
          return $.post("/api/validate-iupac", {
            "target_string": entry.name
          }).then(function(validation, message, query) {
            if (validation.valid) {
              if (!(entry.name in monosaccharides)) {
                gridRow.removeClass("warning");
                if (gridRow.data("tinyNotification") != null) {
                  notif = gridRow.data("tinyNotification");
                  notif.dismiss();
                  return gridRow.data("tinyNotification", void 0);
                }
              }
            } else {
              gridRow.addClass("warning");
              pos = gridRow.position();
              if (gridRow.data("tinyNotification") != null) {
                notif = gridRow.data("tinyNotification");
                notif.dismiss();
              }
              notify = new TinyNotification(pos.top + 50, pos.left, validation.message, gridRow);
              return gridRow.data("tinyNotification", notify);
            }
          });
        };
        continuation(row);
      }
    }
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
    return this.update();
  };

  return MonosaccharideInputWidgetGrid;

})();

ConstraintInputGrid = (function() {
  ConstraintInputGrid.prototype.template = "<div class=\"monosaccharide-constraints-row row\">\n    <div class='input-field col s2'>\n        <label for='left_hand_side'>Limit</label>\n        <input class='monosaccharide-name center-align' type='text' name='left_hand_side' placeholder='Name'>\n    </div>\n    <div class='input-field col s2' style='padding-left: 2px;padding-right: 2px;'>\n        <select class='browser-default center-align' name='operator'>\n            <option>=</option>\n            <option>!=</option>\n            <option>&gt;</option>\n            <option>&lt;</option>\n            <option>&gt;=</option>\n            <option>&lt;=</option>\n        </select>\n    </div>\n    <div class='input-field col s4 constrained-value-cell'>\n        <label for='right_hand_side'>Constrained Value</label>\n        <input class='monosaccharide-name constrained-value' type='text' name='right_hand_side' placeholder='Name/Value'>\n    </div>\n</div>";

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
      var counter, index, parts;
      parts = o.name.split(" ");
      counter = parts[parts.length - 1];
      if (counter.startsWith("(") && counter.endsWith(")")) {
        index = parseInt(counter.slice(1, -1));
      } else {
        index = Infinity;
      }
      return index;
    });
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      analysis = ref[i];
      analysis.name = analysis.name !== '' ? analysis.name : "Analysis:" + analysis.uuid;
      row = $("<div data-id=" + analysis.uuid + " class='list-item clearfix' data-uuid='" + analysis.uuid + "'> <span class='handle user-provided-name'>" + (analysis.name.replace(/_/g, ' ')) + "</span> <small class='right' style='display:inherit'> " + analysisTypeDisplayMap[analysis.analysis_type] + " <!-- <a class='remove-analysis mdi-content-clear'></a> --> </small> </div>");
      chunks.push(row);
      self = this;
      row.click(function(event) {
        var handle, id;
        GlycReSoft.invalidate();
        handle = $(this);
        id = handle.attr('data-uuid');
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
      try {
        return _this.renderAnalyses(".analysis-list");
      } catch (_error) {}
    };
  })(this));
});

//# sourceMappingURL=home-analysis-list-ui.js.map

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

var MassShiftInputWidget;

MassShiftInputWidget = (function() {
  var addEmptyRowOnEdit, counter, template;
  template = "<div class='mass-shift-row row'>\n    <div class='input-field col s3' style='margin-right:55px; margin-left:30px;'>\n        <label for='mass_shift_name'>Name or Formula</label>\n        <input class='mass-shift-name' type='text' name='mass_shift_name' placeholder='Name/Formula'>\n    </div>\n    <div class='input-field col s2'>\n        <label for='mass_shift_max_count'>Up To Count</label>    \n        <input class='max-count' type='number' min='0' placeholder='Maximum Count' name='mass_shift_max_count'>\n    </div>\n</div>";
  counter = 0;
  addEmptyRowOnEdit = function(container, addHeader) {
    var autocompleteValues, callback, name, row;
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
    row.find("input").change(callback);
    autocompleteValues = {};
    for (name in GlycReSoft.massShifts) {
      if (name === "Unmodified") {
        continue;
      }
      autocompleteValues[name] = null;
    }
    return row.find(".mass-shift-name").autocomplete({
      data: autocompleteValues,
      onAutocomplete: function(value) {
        return console.log(value, this);
      }
    });
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
      return HypothesisAPI.get(hypothesisUUID, (function(_this) {
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

  MonosaccharideFilterState.prototype.invalidate = function() {
    this.setHypothesis(null);
    return this.setApplicationFilter();
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
    residue.sanitizeName = sanitizeName = residue.replace(/[\(\),#.@\^]/g, "_");
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

var ModificationIndex, ModificationRule, ModificationRuleListing, ModificationSelectionEditor, ModificationSpecification, ModificationTarget, PositionClassifier, makeModificationSelectionEditor, parseModificationRuleSpecification,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

PositionClassifier = {
  "nterm": "N-term",
  "cterm": "C-term",
  "N-term": "N-term",
  "C-term": "C-term"
};

parseModificationRuleSpecification = function(specString) {
  var match;
  match = /(.*)\s\((.+)\)$/.exec(specString);
  return [match[1], ModificationTarget.parse(match[2])];
};

ModificationTarget = (function() {
  function ModificationTarget(residues, positionClassifier) {
    if (residues == null) {
      residues = [];
    }
    this.residues = residues;
    this.positionClassifier = positionClassifier;
  }

  ModificationTarget.prototype.serialize = function() {
    var parts;
    parts = [];
    parts.push(this.residues.join(""));
    if (this.positionClassifier != null) {
      parts.push("@");
      parts.push(PositionClassifier[this.positionClassifier]);
    }
    return parts.join(" ");
  };

  ModificationTarget.parse = function(specString) {
    var match;
    match = /([A-Z]*)(?: @ ([NC]-term))?/.exec(specString);
    return new ModificationTarget(match[1].split(""), match[2]);
  };

  return ModificationTarget;

})();

ModificationRule = (function() {
  function ModificationRule(name1, formula1, mass, targets, hidden, category, recent) {
    var k, len, target;
    this.name = name1;
    this.formula = formula1;
    this.mass = mass;
    this.hidden = hidden != null ? hidden : false;
    this.category = category != null ? category : 0;
    this.recent = recent != null ? recent : false;
    this.targets = [];
    if (targets != null) {
      if (_.isArray(targets)) {
        for (k = 0, len = targets.length; k < len; k++) {
          target = targets[k];
          this.addTarget(target);
        }
      } else {
        this.addTarget(target);
      }
    }
  }

  ModificationRule.prototype.addTarget = function(target) {
    if (!(target instanceof ModificationTarget)) {
      target = ModificationTarget.parse(target);
    }
    return this.targets.push(target);
  };

  ModificationRule.prototype.toSpecifications = function() {
    var k, len, ref, specs, target;
    specs = [];
    ref = this.targets;
    for (k = 0, len = ref.length; k < len; k++) {
      target = ref[k];
      specs.push(new ModificationSpecification(this, target));
    }
    return specs;
  };

  ModificationRule.prototype.render = function(container) {
    var entry, formula, formulaEntry, k, len, name, nameEntry, ref, results, target;
    if (this.name.length < 20) {
      name = this.name;
      nameEntry = "<div class=\"modification-rule-entry-name col s4\" data-modification-name=\"" + this.name + "\">\n    " + name + "\n</div>";
    } else {
      name = this.name.slice(0, 17) + "...";
      nameEntry = "<div class=\"modification-rule-entry-name col s4 tooltipped\" data-tooltip=\"" + this.name + "\" data-modification-name=\"" + this.name + "\">\n    " + name + "\n</div>";
    }
    if (this.formula.length < 13) {
      formula = this.formula;
      formulaEntry = "<div class=\"modification-rule-entry-formula col s3\">\n    " + formula + "\n</div>";
    } else {
      formula = this.formula.slice(0, 10) + '...';
      formulaEntry = "<div class=\"modification-rule-entry-formula col s3 tooltipped\" data-tooltip=\"" + this.formula + "\">\n    " + formula + "\n</div>";
    }
    ref = this.targets;
    results = [];
    for (k = 0, len = ref.length; k < len; k++) {
      target = ref[k];
      entry = $("<div class=\"modification-rule-entry row\">\n    " + nameEntry + "\n    <div class=\"modification-rule-entry-target col s2\">\n        " + (target.serialize()) + "\n    </div>\n    " + formulaEntry + "\n    <div class=\"modification-rule-entry-mass col s3\">\n        " + this.mass + "\n    </div>\n</div>");
      results.push(container.append(entry));
    }
    return results;
  };

  return ModificationRule;

})();

ModificationSpecification = (function() {
  function ModificationSpecification(rule1, target1, hidden) {
    this.rule = rule1;
    this.target = target1;
    this.hidden = hidden != null ? hidden : false;
    this.name = this.rule.name;
    this.formula = this.rule.formula;
    this.mass = this.rule.mass;
  }

  ModificationSpecification.prototype.render = function(container) {
    var entry, formula, formulaEntry, name, nameEntry;
    if (this.name.length < 20) {
      name = this.name;
      nameEntry = "<div class=\"modification-rule-entry-name col s4\" data-modification-name=\"" + this.name + "\">\n    " + name + "\n</div>";
    } else {
      name = this.name.slice(0, 17) + "...";
      nameEntry = "<div class=\"modification-rule-entry-name col s4 tooltipped\" data-tooltip=\"" + this.name + "\" data-modification-name=\"" + this.name + "\">\n    " + name + "\n</div>";
    }
    if (this.formula.length < 13) {
      formula = this.formula;
      formulaEntry = "<div class=\"modification-rule-entry-formula col s3\">\n    " + formula + "\n</div>";
    } else {
      formula = this.formula.slice(0, 10) + '...';
      formulaEntry = "<div class=\"modification-rule-entry-formula col s3 tooltipped\" data-tooltip=\"" + this.formula + "\">\n    " + formula + "\n</div>";
    }
    entry = $("<div class=\"modification-rule-entry row\" data-key=\"" + (this.serialize()) + "\">\n    " + nameEntry + "\n    <div class=\"modification-rule-entry-target col s2\">\n        " + (this.target.serialize()) + "\n    </div>\n    " + formulaEntry + "\n    <div class=\"modification-rule-entry-mass col s3\">\n        " + this.mass + "\n    </div>\n</div>");
    return container.append(entry);
  };

  ModificationSpecification.prototype.serialize = function() {
    return this.name + " (" + (this.target.serialize()) + ")";
  };

  return ModificationSpecification;

})();

ModificationIndex = (function() {
  function ModificationIndex(rules) {
    if (rules == null) {
      rules = {};
    }
    this.rules = rules;
    this.index = {};
  }

  ModificationIndex.prototype.addRule = function(rule) {
    return this.rules[rule.serialize()] = rule;
  };

  ModificationIndex.prototype.removeRule = function(rule) {
    return delete this.rules[rule.serialize()];
  };

  ModificationIndex.prototype.getRule = function(spec) {
    return this.rules[spec];
  };

  ModificationIndex.prototype.updateRuleFromSpecString = function(specString) {
    var name, ref, target;
    ref = parseModificationRuleSpecification(specString), name = ref[0], target = ref[1];
    if (this.rules[name] != null) {
      return this.rules[name].addTarget(target);
    } else {
      throw new Error(name + " does not exist");
    }
  };

  ModificationIndex.prototype.updateFromAPI = function(callback) {
    return $.get("/api/modifications").done((function(_this) {
      return function(collection) {
        var definitions, entry, i, j, k, key, l, len, len1, len2, m, modSpec, name, ref, ref1, spec, specificities, target, tempIndex, values;
        definitions = collection["definitions"];
        specificities = collection["specificities"];
        i = 0;
        tempIndex = {};
        for (k = 0, len = definitions.length; k < len; k++) {
          values = definitions[k];
          i += 1;
          entry = new ModificationRule(values[0], values[1], values[2]);
          tempIndex[entry.name] = entry;
        }
        j = 0;
        for (l = 0, len1 = specificities.length; l < len1; l++) {
          spec = specificities[l];
          j += 1;
          ref = parseModificationRuleSpecification(spec), name = ref[0], target = ref[1];
          entry = tempIndex[name];
          entry.addTarget(target);
          j = 0;
        }
        for (key in tempIndex) {
          entry = tempIndex[key];
          ref1 = entry.toSpecifications();
          for (m = 0, len2 = ref1.length; m < len2; m++) {
            modSpec = ref1[m];
            _this.addRule(modSpec);
          }
        }
        console.log("Update From API Done");
        _this.index = tempIndex;
        if (callback != null) {
          return callback(_this);
        }
      };
    })(this));
  };

  return ModificationIndex;

})();

ModificationRuleListing = (function(superClass) {
  extend(ModificationRuleListing, superClass);

  function ModificationRuleListing(container1, rules) {
    this.container = container1;
    if (rules == null) {
      rules = {};
    }
    ModificationRuleListing.__super__.constructor.call(this, rules);
  }

  ModificationRuleListing.prototype.find = function(selector) {
    return this.container.find(selector);
  };

  ModificationRuleListing.prototype.render = function() {
    var k, key, keys, len, rule;
    this.container.empty();
    keys = Object.keys(this.rules);
    keys.sort(function(a, b) {
      a = a.toLowerCase();
      b = b.toLowerCase();
      if (a > b) {
        return 1;
      } else if (a < b) {
        return -1;
      }
      return 0;
    });
    for (k = 0, len = keys.length; k < len; k++) {
      key = keys[k];
      rule = this.rules[key];
      if (rule.hidden) {
        continue;
      }
      rule.render(this.container);
    }
    return materialTooltip();
  };

  return ModificationRuleListing;

})(ModificationIndex);

ModificationSelectionEditor = (function() {
  function ModificationSelectionEditor(container1) {
    this.container = container1;
    this.getSelectedModifications = bind(this.getSelectedModifications, this);
    this.fullListingContainer = this.container.find(".modification-listing");
    this.constantListingContainer = this.container.find(".constant-modification-choices");
    this.variableListingContainer = this.container.find(".variable-modification-choices");
    this.fullListing = new ModificationRuleListing(this.fullListingContainer);
    this.constantListing = new ModificationRuleListing(this.constantListingContainer);
    this.variableListing = new ModificationRuleListing(this.variableListingContainer);
    this.state = 'select';
    this.setState(this.state);
  }

  ModificationSelectionEditor.prototype.initialize = function(callback) {
    this.hide();
    return this.fullListing.updateFromAPI((function(_this) {
      return function(content) {
        console.log("Finished Update From API");
        _this.fullListing.render();
        _this.setupHandlers();
        _this.show();
        if (callback != null) {
          return callback(_this);
        }
      };
    })(this));
  };

  ModificationSelectionEditor.prototype.hide = function() {
    return this.container.hide();
  };

  ModificationSelectionEditor.prototype.show = function() {
    return this.container.show();
  };

  ModificationSelectionEditor.prototype.getSelectedModifications = function(listing, sourceListing) {
    var chosen, k, key, len, row, rule, specs;
    if (sourceListing == null) {
      sourceListing = this.fullListing;
    }
    chosen = listing.find(".selected");
    specs = [];
    for (k = 0, len = chosen.length; k < len; k++) {
      row = chosen[k];
      row = $(row);
      key = row.data("key");
      rule = sourceListing.getRule(key);
      specs.push(rule);
    }
    return specs;
  };

  ModificationSelectionEditor.prototype._getChosenModificationSpecs = function(listing) {
    var chosen, k, key, len, row, specs;
    chosen = listing.find(".modification-rule-entry");
    specs = [];
    for (k = 0, len = chosen.length; k < len; k++) {
      row = chosen[k];
      row = $(row);
      key = row.data("key");
      specs.push(key);
    }
    return specs.join(";;;");
  };

  ModificationSelectionEditor.prototype.getConstantModificationSpecs = function() {
    return this._getChosenModificationSpecs(this.constantListing);
  };

  ModificationSelectionEditor.prototype.getVariableModificationSpecs = function() {
    return this._getChosenModificationSpecs(this.variableListing);
  };

  ModificationSelectionEditor.prototype._chooseModification = function(modSpec, listing) {
    var rule;
    rule = this.fullListing.getRule(modSpec);
    this.fullListing.removeRule(rule);
    listing.addRule(rule);
    this.fullListing.render();
    return listing.render();
  };

  ModificationSelectionEditor.prototype.chooseConstant = function(modSpec) {
    return this._chooseModification(modSpec, this.constantListing);
  };

  ModificationSelectionEditor.prototype.chooseVariable = function(modSpec) {
    return this._chooseModification(modSpec, this.variableListing);
  };

  ModificationSelectionEditor.prototype.transferModificationsToChosenSet = function(chosenListing) {
    var k, len, ruleSpec, rules;
    rules = this.getSelectedModifications(this.fullListingContainer);
    for (k = 0, len = rules.length; k < len; k++) {
      ruleSpec = rules[k];
      this.fullListing.removeRule(ruleSpec);
      chosenListing.addRule(ruleSpec);
    }
    chosenListing.render();
    return this.fullListing.render();
  };

  ModificationSelectionEditor.prototype.removeRuleFromChosenSet = function(chosenListing) {
    var k, len, ruleSpec, rules;
    rules = this.getSelectedModifications(chosenListing, chosenListing);
    for (k = 0, len = rules.length; k < len; k++) {
      ruleSpec = rules[k];
      chosenListing.removeRule(ruleSpec);
      this.fullListing.addRule(ruleSpec);
    }
    this.fullListing.render();
    return chosenListing.render();
  };

  ModificationSelectionEditor.prototype.setupHandlers = function() {
    var self;
    this.container.on("click", ".modification-rule-entry", function(event) {
      var handle, isSelected;
      handle = $(this);
      isSelected = handle.data("selected");
      if (isSelected == null) {
        isSelected = false;
      }
      handle.data("selected", !isSelected);
      if (handle.data("selected")) {
        return handle.addClass("selected");
      } else {
        return handle.removeClass("selected");
      }
    });
    self = this;
    this.container.find(".add-constant-btn").click((function(_this) {
      return function(event) {
        return _this.transferModificationsToChosenSet(_this.constantListing);
      };
    })(this));
    this.container.find(".add-variable-btn").click((function(_this) {
      return function(event) {
        return _this.transferModificationsToChosenSet(_this.variableListing);
      };
    })(this));
    this.container.find(".remove-selected-btn").click((function(_this) {
      return function(event) {
        _this.removeRuleFromChosenSet(_this.constantListing);
        return _this.removeRuleFromChosenSet(_this.variableListing);
      };
    })(this));
    this.container.find(".create-custom-btn").click((function(_this) {
      return function(event) {
        return _this.setState("create");
      };
    })(this));
    this.container.find(".cancel-creation-btn").click((function(_this) {
      return function(event) {
        return _this.setState("select");
      };
    })(this));
    this.container.find(".submit-creation-btn").click((function(_this) {
      return function(event) {
        return _this.createModification();
      };
    })(this));
    return this.container.find("#modification-listing-search").keyup(function(event) {
      return self.filterSelectionList(this.value);
    });
  };

  ModificationSelectionEditor.prototype.createModification = function() {
    var formData, formula, name, target;
    name = this.container.find("#new-modification-name").val();
    formula = this.container.find("#new-modification-formula").val();
    target = this.container.find("#new-modification-target").val();
    formData = {
      "new-modification-name": name,
      "new-modification-formula": formula,
      "new-modification-target": target
    };
    console.log("Submitting", formData);
    return $.post("/glycopeptide_search_space/modification_menu", formData).done((function(_this) {
      return function(payload) {
        var k, l, len, len1, modRule, modSpec, ref, ref1, spec;
        _this.container.find("#new-modification-name").val("");
        _this.container.find("#new-modification-formula").val("");
        _this.container.find("#new-modification-target").val("");
        modRule = new ModificationRule(payload.name, payload.formula, payload.mass);
        ref = payload.specificities;
        for (k = 0, len = ref.length; k < len; k++) {
          spec = ref[k];
          modRule.addTarget(spec);
        }
        ref1 = modRule.toSpecifications();
        for (l = 0, len1 = ref1.length; l < len1; l++) {
          modSpec = ref1[l];
          _this.fullListing.addRule(modSpec);
        }
        _this.fullListing.render();
        return _this.setState("select");
      };
    })(this)).fail((function(_this) {
      return function(err) {
        return console.log(err);
      };
    })(this));
  };

  ModificationSelectionEditor.prototype.filterSelectionList = function(pattern) {
    var err, key, ref, results, rule;
    try {
      pattern = new RegExp(pattern);
      ref = this.fullListing.rules;
      results = [];
      for (key in ref) {
        rule = ref[key];
        if (pattern.test(key)) {
          results.push(rule.hidden = false);
        } else {
          results.push(rule.hidden = true);
        }
      }
      return results;
    } catch (_error) {
      err = _error;
      return console.log(err);
    } finally {
      this.fullListing.render();
    }
  };

  ModificationSelectionEditor.prototype.setState = function(state) {
    if (state === 'select') {
      this.container.find(".modification-listing-container").show();
      this.container.find(".modification-creation-container").hide();
      this.container.find(".modification-editor-disabled").hide();
    } else if (state === 'create') {
      this.container.find(".modification-listing-container").hide();
      this.container.find(".modification-creation-container").show();
      this.container.find(".modification-editor-disabled").hide();
    } else if (state === "disabled") {
      this.container.find(".modification-listing-container").hide();
      this.container.find(".modification-creation-container").hide();
      this.container.find(".modification-editor-disabled").show();
    }
    return this.state = state;
  };

  return ModificationSelectionEditor;

})();

makeModificationSelectionEditor = function(uid, callback) {
  var handle, inst, template;
  template = "<div class='modification-selection-editor' id='modification-selection-editor-" + uid + "'>\n    <div class='modification-listing-container'>\n        <div class='row'>\n            <h5 class='section-title'>Select Modifications</h5>\n        </div>\n        <div class='row'>\n            <div class='col s6'>\n                <div class='modification-listing-header row'>\n                    <div class='col s4'>Name</div>\n                    <div class='col s2'>Target</div>\n                    <div class='col s3'>Formula</div>\n                    <div class='col s3'>Mass</div>\n                </div>\n                <div class='modification-listing'>\n                </div>\n                <input id='modification-listing-search' type=\"text\" name=\"modification-listing-search\"\n                       placeholder=\"Search by name\"/>\n            </div>\n            <div class='col s2'>\n                <div class='modification-choice-controls'>\n                    <a class='btn add-constant-btn tooltipped'\n                       data-tooltip=\"Add Selected Modification Rules to Constant List\">\n                       + Constant</a><br>\n                    <a class='btn add-variable-btn tooltipped'\n                       data-tooltip=\"Add Selected Modification Rules to Variable List\">\n                       + Variable</a><br>\n                    <a class='btn remove-selected-btn tooltipped'\n                       data-tooltip=\"Remove Selected Rules From Constant and/or Variable List\">\n                       - Selection</a><br>\n                    <a class='btn create-custom-btn tooltipped' data-tooltip=\"Create New Modification Rule\">\n                        Create Custom</a><br>\n                </div>\n            </div>\n            <div class='modification-choices-container col s4'>\n                <div class='modification-choices'>\n                    <div class='choice-list-header'>\n                        Constant\n                    </div>\n                    <div class='constant-modification-choices'>\n                        \n                    </div>\n                    <div class='choice-list-header' style='border-top: 1px solid lightgrey'>\n                        Variable\n                    </div>\n                    <div class='variable-modification-choices'>\n                        \n                    </div>\n                </div>\n            </div>\n        </div>\n    </div>\n    <div class='modification-creation-container'>\n        <div class='row'>\n            <h5 class='section-title'>Create Modification</h5>\n        </div>\n        <div class='modification-creation row'>\n            <div class='col s3 input-field'>\n                <label for='new-modification-name'>New Modification Name</label>\n                <input id='new-modification-name' name=\"new-modification-name\"\n                       type=\"text\" class=\"validate\">\n            </div>\n            <div class='col s3 input-field'>\n                <label for='new-modification-formula'>New Modification Formula</label>\n                <input id='new-modification-formula' name=\"new-modification-formula\"\n                       type=\"text\" class=\"validate\" pattern=\"^[A-Za-z0-9\-\(\)]+$\">\n            </div>\n            <div class='col s3 input-field'>\n                <label for='new-modification-target'>New Modification Target</label>\n                <input id='new-modification-target' name=\"new-modification-target\"\n                       type=\"text\" class=\"validate\" pattern=\"([A-Z]*)(?: @ ([NC]-term))?\">\n            </div>\n        </div>\n        <div class='modification-choice-controls row'>\n            <a class='btn submit-creation-btn'>Create</a><br>\n            <a class='btn cancel-creation-btn'>Cancel</a><br>\n        </div>\n    </div>\n    <div class='modification-editor-disabled'>\n        Modification Specification Not Permitted\n    </div>\n</div>";
  handle = $(template);
  handle.find("#modification-selection-editor-" + uid);
  inst = new ModificationSelectionEditor(handle);
  inst.initialize(callback);
  return inst;
};

//# sourceMappingURL=peptide-modification-ui.js.map

var makePresetSelector, samplePreprocessingPresets, setSamplePreprocessingConfiguration;

samplePreprocessingPresets = [
  {
    name: "MS Glycomics Profiling",
    max_charge: 9,
    ms1_score_threshold: 35,
    ms1_averagine: "glycan",
    max_missing_peaks: 3,
    msn_score_threshold: 10,
    msn_averagine: 'glycan',
    fit_only_msn: false
  }, {
    name: "LC-MS/MS Glycoproteomics",
    max_charge: 12,
    max_missing_peaks: 3,
    ms1_score_threshold: 35,
    ms1_averagine: "glycopeptide",
    msn_score_threshold: 10,
    msn_averagine: 'peptide',
    fit_only_msn: true
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
  console.log(found, config);
  if (!found) {
    return;
  }
  form = $("form#add-sample-form");
  console.log(form);
  form.find("#maximum-charge-state").val(config.max_charge);
  form.find("#missed-peaks").val(config.max_missing_peaks);
  form.find('#ms1-minimum-isotopic-score').val(config.ms1_score_threshold);
  form.find('#ms1-averagine').val(config.ms1_averagine);
  if (config.msn_score_threshold != null) {
    form.find('#msn-minimum-isotopic-score').val(config.msn_score_threshold);
  }
  if (config.msn_averagine != null) {
    form.find('#msn-averagine').val(config.msn_averagine);
  }
  if (config.fit_only_msn != null) {
    return form.find("#msms-features-only").prop("checked", config.fit_only_msn);
  }
};

makePresetSelector = function(container) {
  var elem, i, label, len, preset;
  label = $("<label for='preset-configuration'>Preset Configurations</label>");
  container.append(label);
  elem = $('<select class=\'browser-default\' name=\'preset-configuration\'></select>');
  for (i = 0, len = samplePreprocessingPresets.length; i < len; i++) {
    preset = samplePreprocessingPresets[i];
    elem.append($("<option value='" + preset.name + "'>" + preset.name + "</option>"));
  }
  container.append(elem);
  return elem.change(function(event) {
    console.log(this, arguments);
    return setSamplePreprocessingConfiguration(this.value);
  });
};

//# sourceMappingURL=sample-preprocessing-configurations.js.map

(function() {
  var TreeViewStateCode, composeSampleAnalysisTree, findProjectEntry, toggleProjectTreeOpenCloseState;
  TreeViewStateCode = {
    open: "open",
    closed: "closed"
  };
  composeSampleAnalysisTree = function(bundle) {
    var analyses, analysis, analysisList, entry, id, name, sampleMap, sampleName, samples, trees;
    samples = bundle.samples;
    analyses = bundle.analyses;
    if (samples == null) {
      samples = {};
    }
    sampleMap = {};
    for (name in samples) {
      sampleMap[name] = [];
    }
    for (id in analyses) {
      analysis = analyses[id];
      sampleName = analysis.sample_name;
      if (sampleMap[sampleName] == null) {
        sampleMap[sampleName] = [];
      }
      sampleMap[sampleName].push(analysis);
    }
    trees = [];
    for (name in sampleMap) {
      analysisList = sampleMap[name];
      entry = {
        "sample": samples[name],
        "analyses": _.sortBy(analysisList, "name")
      };
      trees.push(entry);
    }
    _.sortBy(trees, function(obj) {
      return obj.sample.name;
    });
    return trees;
  };
  findProjectEntry = function(element) {
    var i, isMatch, parent;
    parent = element.parent();
    isMatch = parent.hasClass("project-entry");
    i = 0;
    while (!isMatch && i < 100) {
      i++;
      parent = parent.parent();
      isMatch = parent.hasClass("project-entry") || parent.prop("tagName") === "BODY";
    }
    return parent;
  };
  Application.prototype._makeSampleTree = function(tree) {
    var analyses, analysis, analysisChunk, analysisChunks, cleanNamePattern, entry, expander, j, len, prefix, sample, suffix;
    cleanNamePattern = /_/g;
    sample = tree.sample;
    analyses = tree.analyses;
    analysisChunks = [];
    if (analyses.length > 0) {
      expander = "<span class=\"expanded-display-control indigo-text\">\n    <i class=\"material-icons\">check_box_outline_blank</i>\n</span>";
    } else {
      expander = "";
    }
    prefix = "<div class='project-entry'>\n    <div class=\"project-item\" data-uuid='" + sample.uuid + "'>\n        <span class='project-sample-name'>\n            " + expander + "\n            " + (sample.name.replace(cleanNamePattern, " ")) + "\n        </span>\n        <div class=\"analysis-entry-list\">";
    for (j = 0, len = analyses.length; j < len; j++) {
      analysis = analyses[j];
      analysisChunk = "<div class='analysis-entry-item' data-uuid='" + analysis.uuid + "'>\n    <span class='project-analysis-name'>\n        " + (analysis.name.replace(" at " + sample.name, "").replace(cleanNamePattern, " ")) + "\n    </span>\n</div>";
      analysisChunks.push(analysisChunk);
    }
    suffix = "        </div>\n    </div>\n</div>";
    entry = [prefix, analysisChunks.join("\n"), suffix].join("\n");
    return $(entry);
  };
  Application.prototype.renderSampleTree = function(container) {
    var dataTag, element, entry, j, k, l, len, len1, len2, openClosed, pastState, ref, rendered, stateValue, tree, trees, uuid;
    container = $(container);
    pastState = {};
    ref = container.find(".project-entry");
    for (j = 0, len = ref.length; j < len; j++) {
      element = ref[j];
      element = $(element);
      dataTag = element.find(".project-item");
      uuid = dataTag.data("uuid");
      stateValue = dataTag.data("state");
      pastState[uuid] = stateValue != null ? stateValue : TreeViewStateCode.closed;
    }
    container.empty();
    trees = composeSampleAnalysisTree(this);
    rendered = [];
    for (k = 0, len1 = trees.length; k < len1; k++) {
      tree = trees[k];
      entry = this._makeSampleTree(tree);
      rendered.push(entry);
    }
    container.append(rendered);
    for (l = 0, len2 = rendered.length; l < len2; l++) {
      entry = rendered[l];
      dataTag = entry.find(".project-item");
      uuid = dataTag.data("uuid");
      openClosed = pastState[uuid];
      if (openClosed === "closed") {
        toggleProjectTreeOpenCloseState(entry, openClosed);
      }
    }
    return pastState;
  };
  toggleProjectTreeOpenCloseState = function(projectTree, state) {
    var dataTag, handleList;
    if (state == null) {
      state = void 0;
    }
    handleList = projectTree.find(".analysis-entry-list");
    dataTag = projectTree.find(".project-item");
    if (state == null) {
      if (handleList.is(":visible")) {
        state = TreeViewStateCode.closed;
      } else {
        state = TreeViewStateCode.open;
      }
    }
    if (state === TreeViewStateCode.open) {
      handleList.show();
      projectTree.find(".expanded-display-control .material-icons").text("check_box_outline_blank");
      return dataTag.data("state", TreeViewStateCode.open);
    } else {
      handleList.hide();
      projectTree.find(".expanded-display-control .material-icons").text("add_box");
      return dataTag.data("state", TreeViewStateCode.closed);
    }
  };
  $(function() {
    $("body").on("click", ".projects-entry-list .analysis-entry-item", function(event) {
      var handle, id, target;
      target = this;
      GlycReSoft.invalidate();
      handle = $(target);
      id = handle.data('uuid');
      if (GlycReSoft.getShowingLayer().name !== ActionLayerManager.HOME_LAYER) {
        GlycReSoft.removeCurrentLayer();
      }
      GlycReSoft.addLayer(ActionBook.viewAnalysis, {
        analysis_id: id
      });
      console.log(GlycReSoft.layers);
      console.log(GlycReSoft.lastAdded);
      GlycReSoft.context["analysis_id"] = id;
      return GlycReSoft.setShowingLayer(GlycReSoft.lastAdded);
    });
    return $("body").on("click", ".project-entry .expanded-display-control", function(event) {
      var parent, target;
      target = $(event.currentTarget);
      parent = findProjectEntry(target);
      return toggleProjectTreeOpenCloseState(parent);
    });
  });
  return Application.initializers.push(function() {
    this.on("render-samples", (function(_this) {
      return function() {
        try {
          return _this.renderSampleTree(".projects-entry-list");
        } catch (_error) {}
      };
    })(this));
    return this.on("render-analyses", (function(_this) {
      return function() {
        try {
          return _this.renderSampleTree(".projects-entry-list");
        } catch (_error) {}
      };
    })(this));
  });
})();

//# sourceMappingURL=sample-tree-ui.js.map

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

var GlycanCompositionLCMSSearchController, GlycanCompositionLCMSSearchPaginator, GlycanCompositionLCMSSearchTabView, GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator,
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

GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator = (function(superClass) {
  extend(GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator, superClass);

  GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator.prototype.pageUrl = "/view_glycan_lcms_analysis/{analysisId}/page_unidentified/{page}";

  GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator.prototype.tableSelector = ".unidentified-chromatogram-table";

  GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator.prototype.tableContainerSelector = "#unidentified-chromatograms-table";

  GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator.prototype.rowSelector = ".unidentified-row";

  function GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator(analysisId, handle1, controller) {
    this.analysisId = analysisId;
    this.handle = handle1;
    this.controller = controller;
    this.rowClickHandler = bind(this.rowClickHandler, this);
    GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator.__super__.constructor.call(this, 1);
  }

  GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator.prototype.getPageUrl = function(page) {
    if (page == null) {
      page = 1;
    }
    return this.pageUrl.format({
      "page": page,
      "analysisId": this.analysisId
    });
  };

  GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator.prototype.rowClickHandler = function(row) {
    return this.controller.showUnidentifiedDetailsModal(row);
  };

  return GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator;

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

  GlycanCompositionLCMSSearchController.prototype.detailUnidentifiedUrl = "/view_glycan_lcms_analysis/{analysisId}/details_for_unidentified/{chromatogramId}";

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
    this.showExportMenu = bind(this.showExportMenu, this);
    this.handle = $(this.containerSelector);
    this.paginator = new GlycanCompositionLCMSSearchPaginator(this.analysisId, this.handle, this);
    this.unidentifiedPaginator = new GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator(this.analysisId, this.handle, this);
    updateHandlers = [
      (function(_this) {
        return function() {
          _this.paginator.setupTable();
          return _this.unidentifiedPaginator.setupTable();
        };
      })(this), (function(_this) {
        return function() {
          var handle;
          handle = _this.find(_this.tabView.containerSelector);
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

  GlycanCompositionLCMSSearchController.prototype.find = function(selector) {
    return this.handle.find(selector);
  };

  GlycanCompositionLCMSSearchController.prototype.setup = function() {
    var filterContainer, self;
    this.handle.find(".tooltipped").tooltip();
    self = this;
    this.handle.find("#omit_used_as_adduct").prop("checked", GlycReSoft.settings.omit_used_as_adduct);
    this.handle.find("#omit_used_as_adduct").change(function(event) {
      var handle, isChecked;
      handle = $(this);
      isChecked = handle.prop("checked");
      GlycReSoft.settings.omit_used_as_adduct = isChecked;
      return GlycReSoft.emit("update_settings");
    });
    this.handle.find("#end_time").val(GlycReSoft.settings.end_time);
    this.handle.find("#end_time").change(function(event) {
      var handle, value;
      handle = $(this);
      value = parseFloat(handle.val());
      if (isNaN(value) || (value == null)) {
        value = Infinity;
      }
      GlycReSoft.settings.end_time = value;
      return GlycReSoft.emit("update_settings");
    });
    this.handle.find("#start_time").val(GlycReSoft.settings.start_time);
    this.handle.find("#start_time").change(function(event) {
      var handle, value;
      handle = $(this);
      value = parseFloat(handle.val());
      if (isNaN(value) || (value == null)) {
        value = 0;
      }
      GlycReSoft.settings.start_time = value;
      return GlycReSoft.emit("update_settings");
    });
    this.handle.find("#save-csv-btn").click(function(event) {
      return self.showExportMenu();
    });
    this.updateView();
    filterContainer = this.find(this.monosaccharideFilterContainerSelector);
    return GlycReSoft.monosaccharideFilterState.update(this.hypothesisUUID, (function(_this) {
      return function(bounds) {
        _this.monosaccharideFilter = new MonosaccharideFilter(filterContainer);
        return _this.monosaccharideFilter.render();
      };
    })(this));
  };

  GlycanCompositionLCMSSearchController.prototype.noResultsHandler = function() {
    return $(this.tabView.containerSelector).html('<h5 class=\'red-text center\' style=\'margin: 50px;\'>\nYou don\'t appear to have any results to show. Your filters may be set too high. <br>\nTo lower your filters, please go to the Preferences menu in the upper right corner <br>\nof the screen and set the <code>"Minimum MS1 Score Filter"</code> to be lower and try again.<br>\n</h5>');
  };

  GlycanCompositionLCMSSearchController.prototype.showExportMenu = function() {
    return $.get("/view_glycan_lcms_analysis/" + this.analysisId + "/export").success((function(_this) {
      return function(formContent) {
        return GlycReSoft.displayMessageModal(formContent);
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

  GlycanCompositionLCMSSearchController.prototype.showUnidentifiedDetailsModal = function(row) {
    var handle, id, modal, url;
    handle = $(row);
    id = handle.attr('data-target');
    modal = this.getModal();
    url = this.detailUnidentifiedUrl.format({
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

var GlycopeptideLCMSMSSearchController, GlycopeptideLCMSMSSearchPaginator, GlycopeptideLCMSMSSearchTabView, PlotChromatogramGroupManager, PlotGlycoformsManager, PlotManagerBase, SiteSpecificGlycosylationPlotManager,
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

PlotChromatogramGroupManager = (function(superClass) {
  extend(PlotChromatogramGroupManager, superClass);

  PlotChromatogramGroupManager.prototype.plotUrl = "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/chromatogram_group";

  function PlotChromatogramGroupManager(handle, controller) {
    this.controller = controller;
    PlotChromatogramGroupManager.__super__.constructor.call(this, handle);
  }

  PlotChromatogramGroupManager.prototype.getPlotUrl = function() {
    return this.plotUrl.format({
      "analysisId": this.controller.analysisId,
      "proteinId": this.controller.proteinId
    });
  };

  return PlotChromatogramGroupManager;

})(PlotManagerBase);

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
    var formattedGlycan, glycanComposition, glycopeptideId, sequence, template, value;
    template = '<div> <span>{value}</span> </div>';
    value = handle.parent().attr('data-modification-type');
    if (/Glycosylation/ig.test(value)) {
      glycopeptideId = handle.parent().attr('data-parent');
      sequence = $("g[data-record-id=\"" + glycopeptideId + "\"]").attr('data-sequence');
      sequence = new PeptideSequence(sequence);
      glycanComposition = sequence.glycan;
      formattedGlycan = glycanComposition.format(GlycReSoft.colors);
      value = (value + ": ") + formattedGlycan;
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
      var baseColor, handle, newColor, origTarget, recordId;
      origTarget = $(this);
      recordId = origTarget.attr("data-record-id");
      handle = $("g[data-record-id=" + recordId + "]");
      baseColor = handle.find("path").css("fill");
      newColor = '#74DEC5';
      handle.data("baseColor", baseColor);
      return handle.find("path").css("fill", newColor);
    }, function(event) {
      var handle, origTarget, recordId;
      origTarget = $(this);
      recordId = origTarget.attr("data-record-id");
      handle = $("g[data-record-id=" + recordId + "]");
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

  GlycopeptideLCMSMSSearchController.prototype.searchByScanIdUrl = "/view_glycopeptide_lcmsms_analysis/{analysisId}/search_by_scan/{scanId}";

  GlycopeptideLCMSMSSearchController.prototype.monosaccharideFilterContainerSelector = '#monosaccharide-filters';

  function GlycopeptideLCMSMSSearchController(analysisId, hypothesisUUID, proteinId1) {
    var updateHandlers;
    this.analysisId = analysisId;
    this.hypothesisUUID = hypothesisUUID;
    this.proteinId = proteinId1;
    this.proteinChoiceHandler = bind(this.proteinChoiceHandler, this);
    this.searchByScanId = bind(this.searchByScanId, this);
    this.showExportMenu = bind(this.showExportMenu, this);
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
    this.handle.find("#save-result-btn").click(function(event) {
      console.log("Clicked Save Button");
      return self.showExportMenu();
    });
    this.handle.find("#search-by-scan-id").blur(function(event) {
      console.log(this);
      return self.searchByScanId(this.value.replace(/\s+$/g, ""));
    });
    proteinRowHandle.click(function(event) {
      return self.proteinChoiceHandler(this);
    });
    console.log("setup complete");
    filterContainer = $(this.monosaccharideFilterContainerSelector);
    GlycReSoft.monosaccharideFilterState.update(this.hypothesisUUID, (function(_this) {
      return function(bounds) {
        _this.monosaccharideFilter = new MonosaccharideFilter(filterContainer);
        return _this.monosaccharideFilter.render();
      };
    })(this));
    if (proteinRowHandle[0] != null) {
      return this.proteinChoiceHandler(proteinRowHandle[0]);
    } else {
      return this.noResultsHandler();
    }
  };

  GlycopeptideLCMSMSSearchController.prototype.showExportMenu = function() {
    return $.get("/view_glycopeptide_lcmsms_analysis/" + this.analysisId + "/export").success((function(_this) {
      return function(formContent) {
        return GlycReSoft.displayMessageModal(formContent);
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

  GlycopeptideLCMSMSSearchController.prototype.noResultsHandler = function() {
    return $(this.tabView.containerSelector).html('<h5 class=\'red-text center\' style=\'margin: 50px;\'>\nYou don\'t appear to have any results to show. Your filters may be set too high. <br>\nTo lower your filters, please go to the Preferences menu in the upper right corner <br>\nof the screen and set the <code>"Minimum MS2 Score Filter"</code> to be lower and try again.<br>\n</h5>');
  };

  GlycopeptideLCMSMSSearchController.prototype.searchByScanId = function(scanId) {
    var url;
    if (!scanId) {
      return;
    }
    url = this.searchByScanIdUrl.format({
      "analysisId": this.analysisId,
      "scanId": scanId
    });
    return $.get(url).success((function(_this) {
      return function(doc) {
        var modalHandle;
        modalHandle = _this.getModal();
        modalHandle.find('.modal-content').html(doc);
        $(".lean-overlay").remove();
        return modalHandle.openModal();
      };
    })(this));
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
