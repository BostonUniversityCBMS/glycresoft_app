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
