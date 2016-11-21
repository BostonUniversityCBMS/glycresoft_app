analysisTypeDisplayMap = {
    "glycan_lc_ms": "Glycan LC-MS",
    "glycopeptide_lc_msms": "Glycopeptide LC-MS/MS"
}

Application::renderAnalyses = (container)->
    chunks = []
    template = 
    for analysis in _.sortBy(_.values(@analyses), (o) -> o.id)
        analysis.name = if analysis.name != '' then analysis.name else "Analysis:#{analysis.uuid}"
        row = $("
    <div data-id=#{analysis.id} class='list-item clearfix' data-uuid='#{analysis.uuid}'>
        <span class='handle user-provided-name'>#{analysis.id}. #{analysis.name.replace(/_/g, ' ')}</span>
        <small class='right' style='display:inherit'>
            #{analysisTypeDisplayMap[analysis.analysis_type]}
            <a class='remove-analysis mdi-content-clear'></a>
        </small>
    </div>
    ")
        chunks.push row
        self = @
        row.click (event) ->
            handle = $(@)
            id = handle.attr('data-id')
            self.addLayer ActionBook.viewAnalysis, {analysis_id: id}
            console.log self.layers
            console.log self.lastAdded
            self.context["analysis_id"] = id
            self.setShowingLayer self.lastAdded

        row.find(".remove-analysis").click (event) -> 
            handle = $ @
            console.log "Removal of Analysis is not implemented."

    $(container).html chunks

Application.initializers.push ->
    @on "render-analyses", =>
        @renderAnalyses ".analysis-list"
