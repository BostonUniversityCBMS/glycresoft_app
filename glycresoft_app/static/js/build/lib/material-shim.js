
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
