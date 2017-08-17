class PaginationBase
    rowSelector: ""
    pageUrl: ""
    tableSelector: ""
    tableContainerSelector: ""

    constructor: (@currentPage) ->
        @

    setupTable: (page=1) ->
        @updateTablePageHandler(page)

    setupPageControls: (page=1) =>
        self = @
        @handle.find(@rowSelector).click (event) ->
            self.rowClickHandler(@)
        @handle.find(':not(.disabled) .next-page').click(-> self.updateTablePageHandler(page + 1))
        @handle.find(':not(.disabled) .previous-page').click(-> self.updateTablePageHandler(page - 1))
        @handle.find('.pagination li :not(.active)').click ->
            nextPage = $(@).attr("data-index")
            if nextPage?
                nextPage = parseInt nextPage
                self.updateTablePageHandler nextPage

    getPageUrl: (page=1) ->
        @pageUrl.format({"page": page})

    getTableContainer: ->
        @handle.find(@tableContainerSelector)

    getTable: ->
        @handle.find(@tableSelector)

    updateTablePageHandler: (page=1) ->
        url = @getPageUrl(page)
        GlycReSoft.ajaxWithContext(url).success (doc) =>
            @currentPage = page
            @handle.find(@tableContainerSelector).html doc
            @setupPageControls page
