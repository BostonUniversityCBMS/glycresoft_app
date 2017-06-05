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
