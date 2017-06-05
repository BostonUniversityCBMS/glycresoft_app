
class GlycopeptideLCMSMSSearchPaginator extends PaginationBase
    pageUrl: "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/page/{page}"
    tableSelector: "#identified-glycopeptide-table"
    tableContainerSelector: "#glycopeptide-table"
    rowSelector: '.glycopeptide-match-row'

    constructor: (@analysisId, @handle, @controller) ->
        super(1) 

    getPageUrl: (page=1) ->
        @pageUrl.format {"page": page, "analysisId": @analysisId, "proteinId": @controller.proteinId}

    rowClickHandler: (row) =>
        handle = $ row
        target = handle.attr("data-target")
        @controller.getGlycopeptideMatchDetails(target)


class GlycopeptideLCMSMSSearchTabView extends TabViewBase
    tabSelector: '#protein-view ul.tabs'
    tabList: ["chromatograms-plot", "chromatograms-table", "summary-abundance-plot"]
    defaultTab: "chromatograms-plot"
    updateUrl: '/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/overview'
    containerSelector: '#glycopeptide-lcmsms-content-container'

    constructor: (@analysisId, @handle, @controller, updateHandlers) ->
        super(updateHandlers)

    getUpdateUrl: ->
        @updateUrl.format({'analysisId': @analysisId, 'proteinId': @controller.proteinId})


class PlotManagerBase
    plotUrl: ""
    plotContainerSelector: ""

    constructor: (handle) ->
        @handle = handle

    getPlotUrl: ->
        @plotUrl

    updateView: ->
        GlycReSoft.ajaxWithContext(@getPlotUrl()).success (doc) =>
            plotContainer = @handle.find(@plotContainerSelector)
            plotContainer.html(doc)
            @setupInteraction(plotContainer)

    setupInteraction: (container) ->
        console.log "Setup Interaction Callback"


class PlotChromatogramGroupManager extends PlotManagerBase
    plotUrl: "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/chromatogram_group"

    constructor: (handle, @controller) ->
        super(handle)

    getPlotUrl: ->
        @plotUrl.format({"analysisId": @controller.analysisId, "proteinId": @controller.proteinId})


class PlotGlycoformsManager extends PlotManagerBase
    plotUrl: "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/plot_glycoforms"
    plotContainerSelector: "#protein-overview"

    constructor: (handle, @controller) ->
        super(handle)

    getPlotUrl: ->
        @plotUrl.format({"analysisId": @controller.analysisId, "proteinId": @controller.proteinId})

    glycopeptideTooltipCallback: (handle) ->
        template = '''<div><table>
        <tr><td style='padding:3px;'><b>MS2 Score:</b> {ms2-score}</td><td style='padding:3px;'><b>Mass:</b> {calculated-mass}</td></tr>
        <tr><td style='padding:3px;'><b>q-value:</b> {q-value}</td><td style='padding:3px;'><b>Spectrum Matches:</b> {spectra-count}</td></tr>
        </table>
        <span>{sequence}</span>
        </div>'''

        template.format
            'sequence': new PeptideSequence(handle.attr('data-sequence')).format(GlycReSoft.colors)
            'ms2-score': parseFloat(handle.attr('data-ms2-score')).toFixed(4)
            'q-value': handle.attr('data-q-value')
            "calculated-mass": parseFloat(handle.attr("data-calculated-mass")).toFixed(4)
            "spectra-count": handle.attr("data-spectra-count")

    modificationTooltipCallback: (handle) ->
        template = '
        <div>
        <span>{value}</span>
        </div>'
        value = handle.parent().attr('data-modification-type')
        if (/Glycosylation/ig).test(value)
            glycopeptideId = handle.parent().attr('data-parent')
            sequence = $("g[data-record-id=\"#{glycopeptideId}\"]").attr('data-sequence')
            sequence = new PeptideSequence(sequence)
            glycanComposition = sequence.glycan
            formattedGlycan = glycanComposition.format(GlycReSoft.colors)
            value = "#{value}: " + formattedGlycan
        template.format 'value': value

    setupTooltips: ->
        glycopeptide = $('svg .glycopeptide')
        glycopeptide.customTooltip @glycopeptideTooltipCallback, 'protein-view-tooltip'
        self = @
        glycopeptide.hover(
            (event) ->
                origTarget = $ @
                recordId = origTarget.attr("data-record-id")
                handle = $ "g[data-record-id=#{recordId}]"
                baseColor = handle.find("path").css("fill")
                newColor = '#74DEC5'
                handle.data("baseColor", baseColor)
                handle.find("path").css("fill", newColor)
            (event) ->
                origTarget = $ @
                recordId = origTarget.attr("data-record-id")
                handle = $ "g[data-record-id=#{recordId}]"
                handle.find("path").css("fill", handle.data("baseColor"))
            )
        glycopeptide.click (event) ->
            handle = $ @
            id = handle.data("record-id")
            self.controller.getGlycopeptideMatchDetails(id)
        $('svg .modification path').customTooltip @modificationTooltipCallback, 'protein-view-tooltip'

    setupInteraction: (container) ->
        @setupTooltips()
        GlycReSoft.colors.update()


class SiteSpecificGlycosylationPlotManager extends PlotManagerBase
    plotUrl: "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/site_specific_glycosylation"
    plotContainerSelector: "#site-distribution"

    constructor: (handle, @controller) ->
        super(handle)

    getPlotUrl: ->
        @plotUrl.format({"analysisId": @controller.analysisId, "proteinId": @controller.proteinId})


class GlycopeptideLCMSMSSearchController
    containerSelector: '#glycopeptide-lcmsms-container'
    detailModalSelector: '#glycopeptide-detail-modal'

    proteinTableRowSelector: '.protein-match-table tbody tr'
    proteinContainerSelector: '#protein-container'
    proteinOverviewUrl: "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/overview"

    detailUrl: "/view_glycopeptide_lcmsms_analysis/{analysisId}/{proteinId}/details_for/{glycopeptideId}"
    saveCSVURL: "/view_glycopeptide_lcmsms_analysis/{analysisId}/to-csv"
    searchByScanIdUrl: "/view_glycopeptide_lcmsms_analysis/{analysisId}/search_by_scan/{scanId}"

    monosaccharideFilterContainerSelector: '#monosaccharide-filters'

    constructor: (@analysisId, @hypothesisUUID, @proteinId) ->
        @handle = $ @containerSelector
        @paginator = new GlycopeptideLCMSMSSearchPaginator(@analysisId, @handle, @)
        @plotGlycoforms = new PlotGlycoformsManager(@handle, @)
        @plotSiteSpecificGlycosylation = new SiteSpecificGlycosylationPlotManager(@handle, @)
        updateHandlers = [
            =>
                @paginator.setupTable()
                @plotGlycoforms.updateView()
                @plotSiteSpecificGlycosylation.updateView()

        ]
        @tabView = new GlycopeptideLCMSMSSearchTabView(@analysisId, @handle, @, updateHandlers)
        @setup()

    getProteinTableRows: ->
        handle = $ @proteinTableRowSelector
        return handle

    setup: ->
        proteinRowHandle = $ @proteinTableRowSelector
        self = @
        @handle.find(".tooltipped").tooltip()
        console.log("Setting up Save Buttons")
        @handle.find("#save-result-btn").click (event) ->
            console.log("Clicked Save Button")
            self.showExportMenu()

        @handle.find("#search-by-scan-id").blur (event) ->
            console.log(@)
            self.searchByScanId @value.replace(/\s+$/g, "")

        proteinRowHandle.click (event) ->
            self.proteinChoiceHandler @
        console.log("setup complete")
        filterContainer = $(@monosaccharideFilterContainerSelector)
        GlycReSoft.monosaccharideFilterState.update @hypothesisUUID, (bounds) =>
            @monosaccharideFilter = new MonosaccharideFilter(filterContainer)
            @monosaccharideFilter.render()
        if proteinRowHandle[0]?
            @proteinChoiceHandler proteinRowHandle[0]
        else
            @noResultsHandler()

    showExportMenu: =>
        $.get("/view_glycopeptide_lcmsms_analysis/#{@analysisId}/export").success(
            (formContent) =>
                GlycReSoft.displayMessageModal(formContent)
        )


    getLastProteinViewed: ->
        GlycReSoft.context['protein_id']

    selectLastProteinViewed: ->
        proteinId = @getLastProteinViewed()

    updateView: ->
        @tabView.updateView()

    getModal: ->
        $ @detailModalSelector

    unload: ->
        GlycReSoft.removeCurrentLayer()

    getProteinOverviewUrl: (proteinId) ->
        @proteinOverviewUrl.format({"analysisId": @analysisId, "proteinId": proteinId})

    noResultsHandler: ->
        $(@tabView.containerSelector).html('''
            <h5 class='red-text center' style='margin: 50px;'>
            You don't appear to have any results to show. Your filters may be set too high. <br>
            To lower your filters, please go to the Preferences menu in the upper right corner <br>
            of the screen and set the <code>"Minimum MS2 Score Filter"</code> to be lower and try again.<br>
            </h5>
        ''')

    searchByScanId: (scanId) =>
        if !scanId
            return

        url = @searchByScanIdUrl.format({
            "analysisId": @analysisId,
            "scanId": scanId
        })
        $.get(url).success (doc) =>
            modalHandle = @getModal()
            modalHandle.find('.modal-content').html doc
            # Remove any straggler overlays from rapid re-opening of modal
            $(".lean-overlay").remove()
            modalHandle.openModal()

    proteinChoiceHandler: (row) =>
        handle = $ row
        $('.active-row').removeClass("active-row")
        handle.addClass("active-row")
        id = handle.attr('data-target')
        @proteinId = id
        # $('#chosen-protein-container').fadeOut()
        # $("#loading-top-level-chosen-protein-container").fadeIn()
        $(@tabView.containerSelector).html('''
            <br>
            <div class="progress" id='waiting-for-protein-progress'>
                <div class="indeterminate">
                </div>
            </div>
            ''')
        @tabView.updateView()

    getGlycopeptideMatchDetails: (glycopeptideId) ->
        url = @detailUrl.format(
            {"analysisId": @analysisId, "proteinId": @proteinId,
             "glycopeptideId", glycopeptideId})
        GlycReSoft.ajaxWithContext(url).success (doc) =>
            modalHandle = @getModal()
            modalHandle.find('.modal-content').html doc
            # Remove any straggler overlays from rapid re-opening of modal
            $(".lean-overlay").remove()
            modalHandle.openModal()
