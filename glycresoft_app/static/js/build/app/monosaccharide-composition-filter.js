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
