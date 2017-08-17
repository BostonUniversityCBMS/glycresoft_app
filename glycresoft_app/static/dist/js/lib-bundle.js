var ActionLayer, ActionLayerManager, errorLoadingContent, loadingContent,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

ActionLayerManager = (function(superClass) {
  extend(ActionLayerManager, superClass);

  ActionLayerManager.HOME_LAYER = "home-layer";

  function ActionLayerManager(container, options) {
    this.container = $(container);
    this.options = options;
    this.layers = {};
    this.lastAdded = null;
    this.layerCounter = 0;
    this.on('layer-change', function(event) {
      return materialRefresh();
    });
    this.layerStack = [];
  }

  ActionLayerManager.prototype.incLayerCounter = function() {
    this.layerCounter++;
    return this.layerCounter;
  };

  ActionLayerManager.prototype.add = function(layer) {
    if (layer.options.closeable == null) {
      layer.options.closeable = true;
    }
    this.layers[layer.id] = layer;
    this.container.append(layer.container);
    this.emit("layer-added", {
      "layer": layer
    });
    this.lastAdded = layer.id;
    return this;
  };

  ActionLayerManager.prototype.get = function(id) {
    return this.layers[id];
  };

  ActionLayerManager.prototype.getShowingLayer = function() {
    var result;
    result = void 0;
    _.forIn(this.layers, function(layer, id) {
      if (layer.showing) {
        result = layer;
      }
    });
    return result;
  };

  ActionLayerManager.prototype.setShowingLayer = function(id) {
    var current, i, next;
    clearTooltip();
    current = this.getShowingLayer();
    next = this.get(id);
    try {
      current.hide();
    } catch (_error) {}
    try {
      next.show();
      i = this.findLayer(next);
      if (i !== -1) {
        this.layerStack.pop(i);
      }
      this.layerStack.push(next);
    } catch (_error) {
      this.get(ActionLayerManager.HOME_LAYER).show();
    }
    return this.emit('layer-change', {
      'layer': next
    });
  };

  ActionLayerManager.prototype.addLayer = function(options, params) {
    var layer;
    if (options.closeable == null) {
      options.closeable = true;
    }
    layer = new ActionLayer(this, options, params);
    if (this.layerStack.length === 0) {
      this.layerStack.push(layer);
    }
    return this;
  };

  ActionLayerManager.prototype.removeLayer = function(id) {
    var i;
    this.layers[id].container.remove();
    i = this.findLayer(this.layers[id]);
    if (i !== -1) {
      this.layerStack.pop(i);
    }
    delete this.layers[id];
    return this;
  };

  ActionLayerManager.prototype.removeCurrentLayer = function(next) {
    var current;
    if (next == null) {
      next = null;
    }
    current = this.getShowingLayer();
    this.layerStack.pop();
    if (next == null) {
      next = this.layerStack[this.layerStack.length - 1];
    }
    this.setShowingLayer(next);
    current.dispose();
    return this;
  };

  ActionLayerManager.prototype.findLayer = function(targetLayer) {
    var index, j, layer, len, ref;
    index = -1;
    ref = this.layerStack;
    for (j = 0, len = ref.length; j < len; j++) {
      layer = ref[j];
      index += 1;
      if (layer.id === targetLayer.id) {
        return index;
      }
    }
    return -1;
  };

  ActionLayerManager.prototype.setActiveLayerController = function(controller) {
    var layer;
    layer = this.getShowingLayer();
    return layer.setController(controller);
  };

  ActionLayerManager.prototype.getActiveLayerController = function() {
    var layer;
    layer = this.getShowingLayer();
    return layer.controller;
  };

  return ActionLayerManager;

})(EventEmitter);

loadingContent = "<div class='content-loading-please-wait' style='margin-top:5%'>\n    <h5 class='center-align green-text'>Loading Content. Please Wait.</h5>\n    <div class=\"progress\">\n        <div class=\"indeterminate\"></div>\n    </div>\n</div>";

errorLoadingContent = "<div class='content-loading-please-wait' style='margin-top:5%'>\n    <h5 class='center-align red-text'>Something Went Wrong.</h5>\n</div>";

ActionLayer = (function() {
  function ActionLayer(manager, options, params, method) {
    if (method == null) {
      method = 'get';
    }
    this.manager = manager;
    this.options = options;
    this.params = params;
    this.contentURL = options.contentURL;
    this.method = method;
    if (this.options.method != null) {
      this.method = this.options.method;
    }
    if (!options.container) {
      if (this.params != null) {
        this.id = options.name + "-" + manager.incLayerCounter();
      } else {
        this.id = options.name || 'action-layer-' + manager.incLayerCounter();
      }
      this.container = $('<div></div>').attr('id', this.id);
      this.setup();
    } else {
      this.container = $(options.container);
      this.id = this.container.attr('id');
    }
    this.name = options.name || 'layer-' + this.id;
    this.container.attr('data-name', this.name).addClass('container');
    this.manager.add(this);
    this.showing = false;
    this.hide();
    if (this.manager.getShowingLayer() === void 0) {
      this.show();
    }
    this.controller = null;
  }

  ActionLayer.prototype.setup = function() {
    var callback, errorHandler;
    if (this.options.contentURLTemplate != null) {
      this.contentURL = this.options.contentURLTemplate.format(this.params);
    }
    callback = (function(_this) {
      return function(doc) {
        if (!_this.showing) {
          _this.container.hide();
        }
        _this.options.document = doc;
        _this.container.html(doc);
        _this.container.find('script').each(function(i, tag) {
          var srcURL;
          tag = $(tag);
          srcURL = tag.attr('src');
          if (srcURL !== void 0) {
            return $.getScript(srcURL);
          }
        });
        materialRefresh();
        if (_this.options.closeable) {
          return _this.container.prepend("<div>\n    <a class='dismiss-layer mdi mdi-close' onclick='GlycReSoft.removeCurrentLayer()'></a>\n</div>");
        }
      };
    })(this);
    errorHandler = (function(_this) {
      return function(err) {
        return _this.container.html(errorLoadingContent);
      };
    })(this);
    this.container.html(loadingContent);
    if (this.method === "get") {
      return $.get(this.contentURL).success(callback).error(errorHandler);
    } else if (this.method === "post") {
      console.log("Setup Post", this.manager.settings);
      return $.ajax(this.contentURL, {
        contentType: "application/json",
        data: JSON.stringify({
          params: this.params,
          context: this.manager.context,
          settings: this.manager.settings
        }),
        success: callback,
        error: errorHandler,
        type: "POST"
      });
    }
  };

  ActionLayer.prototype.reload = function() {
    this.container.html(this.options.document);
    this.container.find('script').each(function(i, tag) {
      var srcURL;
      tag = $(tag);
      srcURL = tag.attr('src');
      if (srcURL !== void 0) {
        return $.getScript(srcURL);
      }
    });
    materialRefresh();
    if (this.options.closeable) {
      return this.container.prepend("<div>\n<a class='dismiss-layer mdi-content-clear' onclick='GlycReSoft.removeCurrentLayer()'></a>\n</div>");
    }
  };

  ActionLayer.prototype.setController = function(controller) {
    return this.controller = controller;
  };

  ActionLayer.prototype.getController = function() {
    return this.controller;
  };

  ActionLayer.prototype.show = function() {
    this.container.fadeIn(100);
    return this.showing = true;
  };

  ActionLayer.prototype.hide = function() {
    this.container.fadeOut(100);
    return this.showing = false;
  };

  ActionLayer.prototype.dispose = function() {
    this.container.remove();
    return delete this.manager.layers[this.id];
  };

  return ActionLayer;

})();

//# sourceMappingURL=action-layer.js.map

var ajaxForm, setupAjaxForm;

ajaxForm = function(formHandle, success, error, transform, progress) {
  if (progress == null) {
    (function(ev) {
      return ev;
    });
  }
  return $(formHandle).on('submit', function(event) {
    var ajaxParams, data, encoding, handle, locked, method, url, wrappedError, wrappedSuccess;
    event.preventDefault();
    handle = $(this);
    locked = handle.data("locked");
    if (locked === true) {
      return false;
    } else if (locked === void 0 || locked === null) {
      locked = true;
      handle.data("locked", locked);
    } else if (locked === false) {
      locked = true;
      handle.data("locked", locked);
    }
    if (error == null) {
      error = function() {
        return console.log(arguments);
      };
    }
    if (transform == null) {
      transform = function(form) {
        return new FormData(form);
      };
    }
    url = handle.attr('action');
    method = handle.attr('method');
    data = transform(this);
    encoding = handle.attr('enctype') || 'application/x-www-form-urlencoded; charset=UTF-8';
    wrappedSuccess = function(a, b, c) {
      handle.data("locked", false);
      if (success != null) {
        return success(a, b, c);
      }
    };
    wrappedError = function(a, b, c) {
      handle.data("locked", false);
      if (error != null) {
        return error(a, b, c);
      }
    };
    ajaxParams = {
      'xhr': function() {
        var xhr;
        xhr = new window.XMLHttpRequest();
        xhr.upload.addEventListener("progress", progress);
        xhr.addEventListener("progress", progress);
        return xhr;
      },
      'url': url,
      'method': method,
      'data': data,
      'processData': false,
      'contentType': false,
      'success': wrappedSuccess,
      'error': wrappedError
    };
    return $.ajax(ajaxParams);
  });
};

setupAjaxForm = function(sourceUrl, container) {
  var isModal;
  container = $(container);
  isModal = container.hasClass('modal');
  $.get(sourceUrl).success(function(doc) {
    if (isModal) {
      container.find('.modal-content').html(doc);
      container.openModal();
      return container.find('form').submit(function(event) {
        return container.closeModal();
      });
    } else {
      return container.html(doc);
    }
  });
  return container.find('script').each(function(i, tag) {
    var srcURL;
    tag = $(tag);
    srcURL = tag.attr('src');
    if (srcURL !== void 0) {
      return $.getScript(srcURL);
    } else {
      return eval(tag.text());
    }
  });
};

//# sourceMappingURL=ajax-form.js.map

var ColorManager;

ColorManager = (function() {
  function ColorManager(obj) {
    this.store = obj;
  }

  ColorManager.prototype.get = function(name) {
    var b, g, r, rgb, string;
    try {
      rgb = this.store[name];
      r = rgb[0], g = rgb[1], b = rgb[2];
      string = "rgba(" + (r * 255) + "," + (g * 255) + "," + (b * 255) + ",0.5)";
      return string;
    } catch (_error) {
      return this.update;
    }
  };

  ColorManager.prototype.update = function(callback) {
    if (callback == null) {
      callback = function() {
        return {};
      };
    }
    return $.getJSON("/api/colors").success((function(_this) {
      return function(data) {
        _this.store = data;
        return callback(_this);
      };
    })(this));
  };

  return ColorManager;

})();

//# sourceMappingURL=color.js.map

var contextMenu;

contextMenu = function(target, options, callback) {
  if (callback == null) {
    callback = null;
  }
  $(target).off("contextmenu", false);
  $(document).off("mousedown", false);
  return $(target).on("contextmenu", function(event) {
    var action, handle, item;
    event.preventDefault();
    handle = $(".context-menu");
    handle.empty();
    if (callback != null) {
      callback(handle);
    }
    for (item in options) {
      action = options[item];
      handle.append($("<li></li>").text(item).attr("data-action", item));
    }
    $(".context-menu li").click(function(e) {
      handle = $(this);
      console.log(this, target);
      action = options[handle.attr("data-action")];
      return action.apply(target);
    });
    return $(".context-menu").finish().toggle(100).css({
      top: event.pageY + 'px',
      left: event.pageX + 'px'
    });
  });
};

$(document).on("mousedown", function(e) {
  if (!$(e.target).parents(".context-menu").length > 0) {
    return $(".context-menu").hide(100);
  }
});

//# sourceMappingURL=context-menu.js.map

$(function() {
  var $body, $tooltip, closeTooltip, openTooltip, xOffset, yOffset;
  yOffset = 20;
  xOffset = -180;
  $body = $('body');
  $tooltip = $('<div></div>').hide().css({
    'position': 'absolute',
    'z-index': '10'
  });
  openTooltip = function(event) {
    var content, handle;
    handle = $(this);
    content = handle.data('tooltip-content');
    if (typeof content === 'function') {
      content = content(handle);
    }
    content = content === void 0 ? 'This is a simple tooltip' : content;
    $tooltip.html(content).addClass(handle.data('tooltip-css-class')).css('top', event.pageY + yOffset + 'px').css('left', event.pageX + xOffset + 'px').show();
  };
  closeTooltip = function(event) {
    var handle;
    handle = $(this);
    $tooltip.html('').removeClass(handle.data('tooltip-css-class')).hide();
  };
  $body.append($tooltip);
  jQuery.fn.customTooltip = function(content, cssClass) {
    var handle;
    handle = $(this);
    if (content !== void 0) {
      handle.data('tooltip-content', content);
    }
    if (cssClass !== void 0) {
      handle.data('tooltip-css-class', cssClass);
    }
    handle.hover(openTooltip, closeTooltip);
  };
});

//# sourceMappingURL=custom-tooltip.js.map

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

var GlycanComposition;

GlycanComposition = (function() {
  function GlycanComposition(string) {
    this.__order = [];
    this.map = {};
    this.parse(string);
  }

  GlycanComposition.prototype.parse = function(string) {
    var i, len, name, number, part, parts, ref, results;
    parts = string.slice(1, -1).split("; ");
    results = [];
    for (i = 0, len = parts.length; i < len; i++) {
      part = parts[i];
      ref = part.split(":"), name = ref[0], number = ref[1];
      this.__order.push(name);
      results.push(this.map[name] = parseInt(number));
    }
    return results;
  };

  GlycanComposition.prototype.format = function(colorSource) {
    var color, name, number, parts, ref, template;
    parts = [];
    ref = this.map;
    for (name in ref) {
      number = ref[name];
      if (name === '__order') {
        continue;
      }
      color = colorSource.get(name);
      template = "<span class='monosaccharide-name' style='background-color:" + color + "; padding: 2px;border-radius:2px;'>" + name + " " + number + "</span>";
      parts.push(template);
    }
    return parts.join(' ');
  };

  return GlycanComposition;

})();

//# sourceMappingURL=glycan-composition.js.map

var MzIdentMLProteinSelector, ProteomicsFileFormats, getProteinName, getProteinNamesFromMzIdentML, identifyProteomicsFormat;

identifyProteomicsFormat = function(file, callback) {
  var isMzML, isMzidentML, reader;
  isMzidentML = function(lines) {
    var d, hasVersion, hit, i, j, len, line, match, tag, version;
    i = 0;
    hit = false;
    tag = [];
    for (j = 0, len = lines.length; j < len; j++) {
      line = lines[j];
      if (/mzIdentML/i.test(line)) {
        hit = true;
        break;
      }
      i += 1;
    }
    if (hit) {
      console.log(hit);
      tag.push(line[i]);
      tag.push(lines[i + 1]);
      tag.push(lines[i + 2]);
      tag = tag.join(" ");
      hasVersion = /version="([0-9\.]+)"/.test(tag);
      if (hasVersion) {
        match = /version="([0-9\.]+)"/.exec(tag);
        version = match[1];
        version = [
          (function() {
            var k, len1, ref, results;
            ref = version.split('.');
            results = [];
            for (k = 0, len1 = ref.length; k < len1; k++) {
              d = ref[k];
              results.push(parseInt(d));
            }
            return results;
          })()
        ];
        return {
          "version": version,
          "format": ProteomicsFileFormats.mzIdentML
        };
      } else {
        return {
          "format": ProteomicsFileFormats.mzIdentML
        };
      }
    }
    return false;
  };
  isMzML = function(lines) {
    var hit, i, j, len, line, tag;
    i = 0;
    hit = false;
    tag = [];
    for (j = 0, len = lines.length; j < len; j++) {
      line = lines[j];
      if (/(mzML)|(indexedmzML)/.test(line)) {
        hit = true;
        break;
      }
      i += 1;
    }
    if (hit) {
      return {
        "format": ProteomicsFileFormats.error
      };
    }
    return false;
  };
  reader = new FileReader();
  reader.onload = function() {
    var lines, proteomicsFileType, test;
    lines = this.result.split("\n");
    proteomicsFileType = {
      "format": ProteomicsFileFormats.fasta
    };
    test = isMzML(lines);
    if (test) {
      proteomicsFileType = test;
    }
    test = isMzidentML(lines);
    if (test) {
      proteomicsFileType = test;
    }
    return callback(proteomicsFileType);
  };
  return reader.readAsText(file.slice(0, 100));
};

ProteomicsFileFormats = {
  mzIdentML: "mzIdentML",
  fasta: "fasta",
  error: "error"
};

getProteinName = function(sequence) {
  var chunk, i, id, j, k, len, len1, line, part, parts, ref;
  ref = sequence.split("\n");
  for (j = 0, len = ref.length; j < len; j++) {
    line = ref[j];
    parts = line.split(/(<DBSequence)/g);
    i = 0;
    chunk = null;
    for (k = 0, len1 = parts.length; k < len1; k++) {
      part = parts[k];
      if (/<DBSequence/.test(part)) {
        chunk = parts[i + 1];
        break;
      }
      i += 1;
    }
    if (chunk != null) {
      id = /accession="([^"]+)"/.exec(chunk);
      id = id[1];
      return id;
    }
  }
};

getProteinNamesFromMzIdentML = function(file, callback, nameCallback) {
  var chunksize, fr, isDone, lastLine, offset, proteins, seek;
  fr = new FileReader();
  if (nameCallback == null) {
    nameCallback = function(name) {
      return console.log(name);
    };
  }
  chunksize = 1024 * 32;
  offset = 0;
  proteins = {};
  lastLine = "";
  isDone = false;
  fr.onload = function() {
    var error, i, j, len, line, name, sequence, sequences;
    sequences = [lastLine].concat(this.result.split(/<\/DBSequence>/g));
    i = 0;
    for (j = 0, len = sequences.length; j < len; j++) {
      sequence = sequences[j];
      if (i === 0) {
        i;
      }
      i += 1;
      line = sequence;
      try {
        if (/<DBSequence/i.test(line)) {
          name = getProteinName(line);
          if (name == null) {
            continue;
          }
          if (!proteins[name]) {
            proteins[name] = true;
            nameCallback(name);
          }
        } else if (/<\/SequenceCollection>/i.test(line)) {
          isDone = true;
        }
        lastLine = "";
      } catch (_error) {
        error = _error;
        lastLine = line;
      }
    }
    return seek();
  };
  fr.onerror = function(error) {
    return console.log("Error while loading proteins", error);
  };
  seek = function() {
    if (offset >= file.size || isDone) {
      return callback(Object.keys(proteins));
    } else {
      fr.readAsText(file.slice(offset, offset + chunksize));
      return offset += chunksize / 2;
    }
  };
  return seek();
};

MzIdentMLProteinSelector = (function() {
  function MzIdentMLProteinSelector(file, listContainer) {
    this.fileObject = file;
    this.container = $(listContainer);
    this.initializeContainer();
  }

  MzIdentMLProteinSelector.prototype.clearContainer = function() {
    return this.container.html("");
  };

  MzIdentMLProteinSelector.prototype.initializeContainer = function() {
    var self, template;
    template = "<div class='display-control'>\n    <a class='toggle-visible-btn right' data-open=\"open\" style='cursor:hand;'>\n        <i class=\"material-icons\">keyboard_arrow_up</i>\n    </a>\n</div>\n<div class='hideable-container'>\n    <div class='row'>\n        <div class='col s4'>\n            <div class='input-field'>\n                <input value='' name=\"protein-regex\" type=\"text\" class=\"validate protein-regex\">\n                <label class=\"active\" for=\"protein-regex\">Protein Pattern</label>\n            </div>\n        </div>\n        <div class='col s2'>\n            <input type='checkbox' id='select-all-proteins-checkbox' name='select-all-proteins-checkbox'/>\n            <label for='select-all-proteins-checkbox'>Select All</label>\n        </div>\n        <div class='col s2' id='is-working'>\n            <span class=\"card-panel red\">\n                Working\n            </span>\n        </div>\n    </div>\n    <div class='row'>\n        <div class='col s12 protein-name-list'>\n\n        </div>\n    </div>\n</div>";
    this.container.html(template);
    this.container.find(".hideable-container").click(".protein-name label", function(event) {
      var parent, target;
      target = event.target;
      parent = $(target.parentElement);
      if (parent.hasClass("protein-name")) {
        return target.parentElement.querySelector("input").click();
      }
    });
    this.hideableContainer = this.container.find(".hideable-container");
    this.regex = this.container.find(".protein-regex");
    this.list = this.container.find(".protein-name-list");
    this.toggleVisible = this.container.find(".toggle-visible-btn");
    this.selectAllChecker = this.container.find('#select-all-proteins-checkbox');
    self = this;
    this.toggleVisible.click(function() {
      var handle;
      handle = $(this);
      if (handle.attr("data-open") === "open") {
        self.hideableContainer.hide();
        handle.attr("data-open", "closed");
        return handle.html('<i class="material-icons">keyboard_arrow_down</i>');
      } else if (handle.attr("data-open") === "closed") {
        self.hideableContainer.show();
        handle.attr("data-open", "open");
        return handle.html('<i class="material-icons">keyboard_arrow_up</i>');
      }
    });
    this.regex.change(function(e) {
      var pattern;
      e.preventDefault();
      pattern = $(this).val();
      return self.updateVisibleProteins(pattern);
    });
    this.regex.keydown((function(_this) {
      return function(e) {
        if (e.keyCode === 13) {
          e.preventDefault();
          _this.regex.change();
          return false;
        }
      };
    })(this));
    this.selectAllChecker.off();
    this.selectAllChecker.click((function(_this) {
      return function(e) {
        var callback;
        callback = function() {
          if (_this.selectAllChecker.prop("checked")) {
            _this.container.find(".protein-name-list input[type='checkbox'].protein-name-check:visible").prop("checked", true);
            return _this.selectAllChecker.prop("checked", true);
          } else {
            _this.container.find(".protein-name-list input[type='checkbox'].protein-name-check:visible").prop("checked", false);
            return _this.selectAllChecker.prop("checked", false);
          }
        };
        return requestAnimationFrame(callback);
      };
    })(this));
    return this.load();
  };

  MzIdentMLProteinSelector.prototype.createAddProteinNameToListCallback = function() {
    var callback, regex;
    regex = this.regex;
    callback = (function(_this) {
      return function(name) {
        var pat, template;
        pat = new RegExp(regex.val());
        template = $("<p class=\"input-field protein-name\">\n    <input type=\"checkbox\" name=\"" + name + "\" class=\"protein-name-check\" />\n    <label for=\"" + name + "\">" + name + "</label>\n</p>");
        if (!pat.test(name)) {
          template.hide();
        }
        return _this.list.append(template);
      };
    })(this);
    return callback;
  };

  MzIdentMLProteinSelector.prototype.updateVisibleProteins = function(pattern) {
    var regex;
    regex = new RegExp(pattern, 'i');
    return $('.protein-name').each(function() {
      var handle, name;
      handle = $(this);
      name = handle.find("input").attr("name");
      if (regex.test(name)) {
        return handle.show();
      } else {
        return handle.hide();
      }
    });
  };

  MzIdentMLProteinSelector.prototype.load = function() {
    var callback, finalizeCallback;
    callback = this.createAddProteinNameToListCallback();
    finalizeCallback = (function(_this) {
      return function() {
        var template;
        console.log("Finalizing!", arguments, _this);
        template = "<span class=\"card-panel green\">\n    Done\n</span>";
        return _this.container.find("#is-working").html(template);
      };
    })(this);
    return getProteinNamesFromMzIdentML(this.fileObject, finalizeCallback, callback);
  };

  MzIdentMLProteinSelector.prototype.getChosenProteins = function() {
    var a;
    return (function() {
      var j, len, ref, results;
      ref = this.container.find("input.protein-name-check:checked");
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        a = ref[j];
        results.push($(a).attr("name"));
      }
      return results;
    }).call(this);
  };

  MzIdentMLProteinSelector.prototype.getAllProteins = function() {
    var a;
    return (function() {
      var j, len, ref, results;
      ref = this.container.find("input.protein-name-check");
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        a = ref[j];
        results.push($(a).attr("name"));
      }
      return results;
    }).call(this);
  };

  return MzIdentMLProteinSelector;

})();

//# sourceMappingURL=infer-protein-data-format.js.map


/*
The file name mirroring done by the .file-field group in Materialize is set up on page load.
When these elements are added dynamically, they must be configured manually.

This code is taken from https://github.com/Dogfalo/materialize/blob/master/js/forms.js#L156
 */
var clearTooltip, materialCheckbox, materialFileInput, materialRefresh, materialTooltip;

materialRefresh = function() {
  try {
    materialTooltip();
  } catch (_error) {}
  try {
    $('select').material_select();
  } catch (_error) {}
  try {
    materialFileInput();
  } catch (_error) {}
  try {
    Materialize.updateTextFields();
  } catch (_error) {}
  try {
    clearTooltip();
  } catch (_error) {}
};

materialTooltip = function() {
  $('.material-tooltip').remove();
  return $('.tooltipped').tooltip({
    delay: 50
  });
};

materialFileInput = function() {
  $(document).on('change', '.file-field input[type="file"]', function() {
    var file_field, file_names, files, i, path_input;
    file_field = $(this).closest('.file-field');
    path_input = file_field.find('input.file-path');
    files = $(this)[0].files;
    file_names = [];
    i = 0;
    while (i < files.length) {
      file_names.push(files[i].name);
      i++;
    }
    path_input.val(file_names.join(', '));
    path_input.trigger('change');
  });
};

materialCheckbox = function(selector) {
  return $(selector).click(function(e) {
    var handle, target;
    handle = $(this);
    target = handle.attr("for");
    return $("input[name='" + target + "']").click();
  });
};

clearTooltip = function() {
  return $('.material-tooltip').hide();
};

$(function() {
  return $("body").on("click", ".lean-overlay", function() {
    $(".lean-overlay").remove();
    return console.log("Removing the overlay");
  });
});

//# sourceMappingURL=material-shim.js.map

var PaginationBase,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

PaginationBase = (function() {
  PaginationBase.prototype.rowSelector = "";

  PaginationBase.prototype.pageUrl = "";

  PaginationBase.prototype.tableSelector = "";

  PaginationBase.prototype.tableContainerSelector = "";

  function PaginationBase(currentPage) {
    this.currentPage = currentPage;
    this.setupPageControls = bind(this.setupPageControls, this);
    this;
  }

  PaginationBase.prototype.setupTable = function(page) {
    if (page == null) {
      page = 1;
    }
    return this.updateTablePageHandler(page);
  };

  PaginationBase.prototype.setupPageControls = function(page) {
    var self;
    if (page == null) {
      page = 1;
    }
    self = this;
    this.handle.find(this.rowSelector).click(function(event) {
      return self.rowClickHandler(this);
    });
    this.handle.find(':not(.disabled) .next-page').click(function() {
      return self.updateTablePageHandler(page + 1);
    });
    this.handle.find(':not(.disabled) .previous-page').click(function() {
      return self.updateTablePageHandler(page - 1);
    });
    return this.handle.find('.pagination li :not(.active)').click(function() {
      var nextPage;
      nextPage = $(this).attr("data-index");
      if (nextPage != null) {
        nextPage = parseInt(nextPage);
        return self.updateTablePageHandler(nextPage);
      }
    });
  };

  PaginationBase.prototype.getPageUrl = function(page) {
    if (page == null) {
      page = 1;
    }
    return this.pageUrl.format({
      "page": page
    });
  };

  PaginationBase.prototype.getTableContainer = function() {
    return this.handle.find(this.tableContainerSelector);
  };

  PaginationBase.prototype.getTable = function() {
    return this.handle.find(this.tableSelector);
  };

  PaginationBase.prototype.updateTablePageHandler = function(page) {
    var url;
    if (page == null) {
      page = 1;
    }
    url = this.getPageUrl(page);
    return GlycReSoft.ajaxWithContext(url).success((function(_this) {
      return function(doc) {
        _this.currentPage = page;
        _this.handle.find(_this.tableContainerSelector).html(doc);
        return _this.setupPageControls(page);
      };
    })(this));
  };

  return PaginationBase;

})();

//# sourceMappingURL=pagination.js.map

var PeptideSequence, PeptideSequencePosition, _formatModification;

_formatModification = function(modification, colorSource, long) {
  var color, content;
  if (long == null) {
    long = false;
  }
  color = colorSource.get(modification);
  content = escape(long ? modification : modification[0]);
  return "(<span class='modification-chip' style='background-color:" + color + ";padding-left:1px;padding-right:2px;border-radius:2px;' title='" + (escape(modification)) + "' data-modification=" + (escape(modification)) + ">" + content + "</span>)";
};

PeptideSequencePosition = (function() {
  var formatModification;

  formatModification = function(modification, colorSource, long) {
    var color, content;
    if (long == null) {
      long = false;
    }
    color = colorSource.get(modification);
    content = long ? modification : modification[0];
    return "(<span class='modification-chip' style='background-color:" + color + ";padding-left:1px;padding-right:2px;border-radius:2px;' title='" + modification + "' data-modification=" + modification + ">" + content + "</span>)";
  };

  function PeptideSequencePosition(residue, modifications) {
    if (modifications == null) {
      modifications = [];
    }
    this.residue = residue;
    this.modifications = modifications;
  }

  PeptideSequencePosition.prototype.format = function(colorSource) {
    var modifications;
    modifications = this.modifications.map(function(modification) {
      return formatModification(modification, colorSource);
    }).join('');
    return this.residue + modifications;
  };

  return PeptideSequencePosition;

})();

PeptideSequence = (function() {
  var parser;

  parser = function(sequence) {
    var cTerm, chunks, currentAA, currentMod, currentMods, glycan, i, m, mods, nTerm, nextChr, p, parenLevel, state;
    state = "start";
    nTerm = nTerm || "H";
    cTerm = cTerm || "OH";
    mods = [];
    chunks = [];
    glycan = "";
    currentAA = "";
    currentMod = "";
    currentMods = [];
    parenLevel = 0;
    i = 0;
    while (i < sequence.length) {
      nextChr = sequence[i];
      if (nextChr === "(") {
        if (state === "aa") {
          state = "mod";
          parenLevel += 1;
        } else if (state === "start") {
          state = "nTerm";
          parenLevel += 1;
        } else {
          parenLevel += 1;
          if (!((state === "nTerm" || state === "cTerm") && parenLevel === 1)) {
            currentMod += nextChr;
          }
        }
      } else if (nextChr === ")") {
        if (state === "aa") {
          throw new Exception("Invalid Sequence. ) found outside of modification, Position {0}. {1}".format(i, sequence));
        } else {
          parenLevel -= 1;
          if (parenLevel === 0) {
            mods.push(currentMod);
            currentMods.push(currentMod);
            if (state === "mod") {
              state = 'aa';
              if (currentAA === "") {
                chunks.slice(-1)[1] = chunks.slice(-1)[1].concat(currentMods);
              } else {
                chunks.push([currentAA, currentMods]);
              }
            } else if (state === "nTerm") {
              if (sequence[i + 1] !== "-") {
                throw new Exception("Malformed N-terminus for " + sequence);
              }
              nTerm = currentMod;
              state = "aa";
              i += 1;
            } else if (state === "cTerm") {
              cTerm = currentMod;
            }
            currentMods = [];
            currentMod = "";
            currentAA = "";
          } else {
            currentMod += nextChr;
          }
        }
      } else if (nextChr === "|") {
        if (state === "aa") {
          throw new Exception("Invalid Sequence. | found outside of modification");
        } else {
          currentMods.push(currentMod);
          mods.push(currentMod);
          currentMod = "";
        }
      } else if (nextChr === "{") {
        if (state === 'aa' || (state === "cTerm" && parenLevel === 0)) {
          glycan = sequence.slice(i);
          break;
        } else {
          currentMod += nextChr;
        }
      } else if (nextChr === "-") {
        if (state === "aa") {
          state = "cTerm";
          if (currentAA !== "") {
            currentMods.push(currentMod);
            chunks.push([currentAA, currentMods]);
            currentMod = "";
            currentMods = [];
            currentAA = "";
          }
        } else {
          currentMod += nextChr;
        }
      } else if (state === "start") {
        state = "aa";
        currentAA = nextChr;
      } else if (state === "aa") {
        if (currentAA !== "") {
          currentMods.push(currentMod);
          chunks.push([currentAA, currentMods]);
          currentMod = "";
          currentMods = [];
          currentAA = "";
        }
        currentAA = nextChr;
      } else if (state === "nTerm" || state === "mod" || state === "cTerm") {
        currentMod += nextChr;
      } else {
        throw new Exception("Unknown Tokenizer State", currentAA, currentMod, i, nextChr);
      }
      i += 1;
    }
    if (currentAA !== "") {
      chunks.push([currentAA, currentMod]);
    }
    if (currentMod !== "") {
      mods.push(currentMod);
    }
    if (glycan !== "") {
      glycan = new GlycanComposition(glycan);
    } else {
      glycan = null;
    }
    chunks = (function() {
      var j, len, results;
      results = [];
      for (j = 0, len = chunks.length; j < len; j++) {
        p = chunks[j];
        results.push(new PeptideSequencePosition(p[0], (function() {
          var k, len1, ref, results1;
          ref = p[1];
          results1 = [];
          for (k = 0, len1 = ref.length; k < len1; k++) {
            m = ref[k];
            if (m !== "") {
              results1.push(m);
            }
          }
          return results1;
        })()));
      }
      return results;
    })();
    return [chunks, mods, glycan, nTerm, cTerm];
  };

  function PeptideSequence(string) {
    var mods, ref;
    ref = parser(string), this.sequence = ref[0], mods = ref[1], this.glycan = ref[2], this.nTerm = ref[3], this.cTerm = ref[4];
  }

  PeptideSequence.prototype.format = function(colorSource, includeGlycan) {
    var cTerm, glycan, nTerm, position, positions, sequence;
    if (includeGlycan == null) {
      includeGlycan = true;
    }
    positions = [];
    if (this.nTerm === "H") {
      nTerm = "";
    } else {
      nTerm = _formatModification(this.nTerm, colorSource).slice(1, -1) + '-';
      positions.push(nTerm);
    }
    positions = positions.concat((function() {
      var j, len, ref, results;
      ref = this.sequence;
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        position = ref[j];
        results.push(position.format(colorSource));
      }
      return results;
    }).call(this));
    if (this.cTerm === "OH") {
      cTerm = "";
    } else {
      cTerm = '-' + (_formatModification(this.cTerm, colorSource).slice(1, -1));
      positions.push(cTerm);
    }
    sequence = positions.join("");
    if (includeGlycan) {
      glycan = this.glycan.format(colorSource);
      sequence += ' ' + glycan;
    }
    return sequence;
  };

  return PeptideSequence;

})();

//# sourceMappingURL=peptide-sequence.js.map

var SVGSaver,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

SVGSaver = (function() {
  function SVGSaver(svgElement) {
    this.svgElement = svgElement;
    this.draw = bind(this.draw, this);
    this.canvas = $("<canvas></canvas>")[0];
    this.img = $("<img>");
    this.canvas.height = this.svgElement.height();
    this.canvas.width = this.svgElement.width();
  }

  SVGSaver.prototype.draw = function() {
    var ctx, xml;
    xml = new XMLSerializer().serializeToString(this.svgElement[0]);
    this.img.attr("src", "data:image/svg+xml;base64," + btoa(xml));
    ctx = this.canvas.getContext('2d');
    return ctx.drawImage(this.img[0], 0, 0);
  };

  return SVGSaver;

})();

//# sourceMappingURL=svg-to-png.js.map

var TabViewBase;

TabViewBase = (function() {
  TabViewBase.prototype.tabSelector = "";

  TabViewBase.prototype.tabList = [];

  TabViewBase.prototype.defaultTab = "";

  TabViewBase.prototype.updateUrl = "";

  TabViewBase.prototype.indicatorColor = 'indigo';

  TabViewBase.prototype.containerSelector = "";

  function TabViewBase(updateHandlers) {
    this.updateHandlers = updateHandlers;
    this.activeTab = this.getLastActiveTab();
  }

  TabViewBase.prototype.getLastActiveTab = function() {
    if (GlycReSoft.context['view-active-tab'] != null) {
      return GlycReSoft.context['view-active-tab'];
    } else {
      return this.defaultTab;
    }
  };

  TabViewBase.prototype.getUpdateUrl = function() {
    return this.updateUrl;
  };

  TabViewBase.prototype.setupTabs = function() {
    var tabs;
    tabs = $(this.tabSelector);
    tabs.tabs();
    tabs.tabs('select_tab', this.getLastActiveTab());
    tabs.find('.indicator').addClass(this.indicatorColor);
    return tabs.find('.tab a').click(function() {
      return GlycReSoft.context['view-active-tab'] = $(this).attr('href').slice(1);
    });
  };

  TabViewBase.prototype.updateView = function() {
    return GlycReSoft.ajaxWithContext(this.getUpdateUrl()).success((function(_this) {
      return function(doc) {
        var handle, i, len, ref, results, updateHandler;
        handle = $(_this.containerSelector);
        handle.html(doc);
        _this.setupTabs();
        ref = _this.updateHandlers;
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
          updateHandler = ref[i];
          results.push(updateHandler());
        }
        return results;
      };
    })(this)).error(function(err) {
      return console.log(err);
    });
  };

  return TabViewBase;

})();

//# sourceMappingURL=tab-view.js.map

var TinyNotification, tinyNotify;

TinyNotification = (function() {
  TinyNotification.prototype.template = "<div class='notification-container'>\n    <div class='clearfix dismiss-container'>\n        <a class='dismiss-notification mdi mdi-close'></a>\n    </div>\n    <div class='notification-content'>\n    </div>\n</div>";

  function TinyNotification(top, left, message, parent, css) {
    if (parent == null) {
      parent = 'body';
    }
    if (css == null) {
      css = {};
    }
    this.top = top;
    this.left = left;
    this.parent = parent;
    this.message = message;
    this.container = $(this.template);
    this.container.find(".notification-content").html(this.message);
    this.container.css({
      "top": this.top,
      "left": this.left
    });
    this.container.find(".dismiss-notification").click((function(_this) {
      return function() {
        return _this.container.remove();
      };
    })(this));
    $(this.parent).append(this.container);
    this.container.css(css);
  }

  TinyNotification.prototype.dismiss = function() {
    return this.container.find(".dismiss-notification").click();
  };

  return TinyNotification;

})();

tinyNotify = function(top, left, message, parent, css) {
  if (parent == null) {
    parent = 'body';
  }
  if (css == null) {
    css = {};
  }
  return new TinyNotification(top, left, message, parent, css);
};

//# sourceMappingURL=tiny-notification.js.map
