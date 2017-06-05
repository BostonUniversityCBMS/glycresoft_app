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
