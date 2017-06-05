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
