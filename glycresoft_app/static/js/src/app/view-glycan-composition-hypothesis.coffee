
class GlycanCompositionHypothesisPaginator extends PaginationBase
    tableSelector: "#composition-table-container"
    tableContainerSelector: "#composition-table-container"
    rowSelector: "#composition-table-container tbody tr"
    pageUrl: "/view_glycan_composition_hypothesis/{hypothesisId}/{page}"

    constructor: (@hypothesisId, @handle, @controller) ->
        super(1)

    getPageUrl: (page=1) ->
        @pageUrl.format {"page": page, "hypothesisId": @hypothesisId}

    rowClickHandler: (row) =>
        console.log row


class GlycanCompositionHypothesisController
    containerSelector: '#glycan-composition-hypothesis-container'
    saveTxtURL: "/view_glycan_composition_hypothesis/{hypothesisId}/download-text"

    constructor: (@hypothesisId) ->
        @handle = $ @containerSelector
        @paginator = new GlycanCompositionHypothesisPaginator(@hypothesisId, @handle, @)
        @setup()

    setup: ->
        self = @
        @paginator.setupTable()
        @handle.find("#save-text-btn").click ->
            self.downloadTxt()

    downloadTxt: ->
        url = @saveTxtURL.format {"hypothesisId": @hypothesisId}
        $.get(url).then (payload) ->
            GlycReSoft.downloadFile payload.filenames[0]
