class GlycanCompositionLCMSSearchPaginator extends PaginationBase
    pageUrl: "/view_glycan_lcms_analysis/{analysisId}/page/{page}"
    tableSelector: ".glycan-chromatogram-table"
    tableContainerSelector: "#chromatograms-table"
    rowSelector: '.glycan-match-row'

    constructor: (@analysisId, @handle, @controller) ->
        super(1) 

    getPageUrl: (page=1) ->
        @pageUrl.format {"page": page, "analysisId": @analysisId}

    rowClickHandler: (row) =>
        @controller.showGlycanCompositionDetailsModal row


class GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator extends PaginationBase
    pageUrl: "/view_glycan_lcms_analysis/{analysisId}/page_unidentified/{page}"
    tableSelector: ".unidentified-chromatogram-table"
    tableContainerSelector: "#unidentified-chromatograms-table"
    rowSelector: ".unidentified-row"

    constructor: (@analysisId, @handle, @controller) ->
        super(1) 

    getPageUrl: (page=1) ->
        @pageUrl.format {"page": page, "analysisId": @analysisId}

    rowClickHandler: (row) =>
        @controller.showUnidentifiedDetailsModal row


class GlycanCompositionLCMSSearchTabView extends TabViewBase
    tabSelector: 'ul.tabs'
    tabList: ["chromatograms-plot", "chromatograms-table", "summary-abundance-plot"]
    defaultTab: "chromatograms-plot"
    updateUrl: '/view_glycan_lcms_analysis/{analysisId}/content'
    containerSelector: '#glycan-lcms-content-container'

    constructor: (@analysisId, @handle, @parent, updateHandlers) ->
        parent = @parent
        super(updateHandlers)

    getUpdateUrl: ->
        @updateUrl.format({'analysisId': @analysisId})


class GlycanCompositionLCMSSearchController
    containerSelector: '#glycan-lcms-container'
    detailModalSelector: '#glycan-detail-modal'
    detailUrl: "/view_glycan_lcms_analysis/{analysisId}/details_for/{chromatogramId}"
    detailUnidentifiedUrl: "/view_glycan_lcms_analysis/{analysisId}/details_for_unidentified/{chromatogramId}"
    saveCSVURL: "/view_glycan_lcms_analysis/{analysisId}/to-csv"    
    monosaccharideFilterContainerSelector: '#monosaccharide-filters'

    constructor: (@analysisId, @hypothesisUUID, @monosaccharides={"Hex": 10, "HexNAc":10, "Fuc": 10, "Neu5Ac": 10}) ->
        @handle = $ @containerSelector
        @paginator = new GlycanCompositionLCMSSearchPaginator(@analysisId, @handle, @)
        @unidentifiedPaginator = new GlycanCompositionLCMSSearchUnidentifiedChromatogramPaginator(@analysisId, @handle, @)
        updateHandlers = [
            =>
                @paginator.setupTable()
                @unidentifiedPaginator.setupTable()
            =>
                handle = @find @tabView.containerSelector
                $.get("/view_glycan_lcms_analysis/#{@analysisId}/chromatograms_chart").success (payload) ->
                    handle.find("#chromatograms-plot").html(payload)
                $.get("/view_glycan_lcms_analysis/#{@analysisId}/abundance_bar_chart").success (payload) ->
                    handle.find("#summary-abundance-plot").html(payload)
        ]

        @tabView = new GlycanCompositionLCMSSearchTabView(@analysisId, @handle, @, updateHandlers)
        @setup()

    find: (selector) -> @handle.find(selector)

    setup: ->
        @handle.find(".tooltipped").tooltip()
        self = @
        @handle.find("#omit_used_as_adduct").prop(
            "checked", GlycReSoft.settings.omit_used_as_adduct)
        @handle.find("#omit_used_as_adduct").change (event) ->
            handle = $ @
            isChecked = handle.prop("checked")
            GlycReSoft.settings.omit_used_as_adduct = isChecked
            GlycReSoft.emit("update_settings")
        @handle.find("#end_time").val(GlycReSoft.settings.end_time)
        @handle.find("#end_time").change (event) ->
            handle = $ @
            value = parseFloat(handle.val())
            if isNaN(value) or not value?
                value = Infinity
            GlycReSoft.settings.end_time = value
            GlycReSoft.emit("update_settings")
        @handle.find("#start_time").val(GlycReSoft.settings.start_time)
        @handle.find("#start_time").change (event) ->
            handle = $ @
            value = parseFloat(handle.val())
            if isNaN(value) or not value?
                value = 0
            GlycReSoft.settings.start_time = value
            GlycReSoft.emit("update_settings")
        @handle.find("#save-csv-btn").click (event) ->
            self.showExportMenu()
        @updateView()

        filterContainer = @find(@monosaccharideFilterContainerSelector)
        GlycReSoft.monosaccharideFilterState.update @hypothesisUUID, (bounds) =>
            @monosaccharideFilter = new MonosaccharideFilter(filterContainer)
            @monosaccharideFilter.render()


    noResultsHandler: ->
        $(@tabView.containerSelector).html('''
            <h5 class='red-text center' style='margin: 50px;'>
            You don't appear to have any results to show. Your filters may be set too high. <br>
            To lower your filters, please go to the Preferences menu in the upper right corner <br>
            of the screen and set the <code>"Minimum MS1 Score Filter"</code> to be lower and try again.<br>
            </h5>
        ''')

    showExportMenu: =>
        $.get("/view_glycan_lcms_analysis/#{@analysisId}/export").success(
            (formContent) =>
                GlycReSoft.displayMessageModal(formContent)
        )

    updateView: ->
        @tabView.updateView()

    showGlycanCompositionDetailsModal: (row) ->
        handle = $ row
        id = handle.attr('data-target')
        modal = @getModal()
        url = @detailUrl.format {analysisId: @analysisId, chromatogramId: id}
        $.get(url).success (doc) ->
            modal.find('.modal-content').html doc
            $(".lean-overlay").remove()
            modal.openModal()

    showUnidentifiedDetailsModal: (row) ->
        handle = $ row
        id = handle.attr('data-target')
        modal = @getModal()
        url = @detailUnidentifiedUrl.format {analysisId: @analysisId, chromatogramId: id}
        $.get(url).success (doc) ->
            modal.find('.modal-content').html doc
            $(".lean-overlay").remove()
            modal.openModal()

    getModal: ->
        $ @detailModalSelector

    unload: ->
        GlycReSoft.removeCurrentLayer()
