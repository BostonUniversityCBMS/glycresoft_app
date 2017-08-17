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
