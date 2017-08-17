class SVGSaver
    constructor: (@svgElement) ->
        @canvas = $("<canvas></canvas>")[0]
        @img = $("<img>")
        @canvas.height = @svgElement.height()
        @canvas.width = @svgElement.width()

    draw: =>
        xml = new XMLSerializer().serializeToString(@svgElement[0])
        @img.attr("src", "data:image/svg+xml;base64," + btoa(xml))
        ctx = @canvas.getContext('2d')
        ctx.drawImage(@img[0], 0, 0)
