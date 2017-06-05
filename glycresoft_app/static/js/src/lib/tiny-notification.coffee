class TinyNotification
    template: """
    <div class='notification-container'>
        <div class='clearfix dismiss-container'>
            <a class='dismiss-notification mdi mdi-close'></a>
        </div>
        <div class='notification-content'>
        </div>
    </div>
    """

    constructor: (top, left, message, parent='body', css={}) ->
        @top = top
        @left = left
        @parent = parent
        @message = message
        @container = $(@template)
        @container.find(".notification-content").html(@message)
        @container.css({"top": @top, "left": @left})
        @container.find(".dismiss-notification").click( => @container.remove())
        $(@parent).append(@container)
        @container.css(css)

    dismiss: ->
        @container.find(".dismiss-notification").click()


tinyNotify = (top, left, message, parent='body', css={}) -> new TinyNotification(top, left, message, parent, css)