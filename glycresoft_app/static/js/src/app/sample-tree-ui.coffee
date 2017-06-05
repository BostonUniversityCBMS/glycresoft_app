

do ->
    TreeViewStateCode = {
        open: "open"
        closed: "closed"
    }

    composeSampleAnalysisTree = (bundle) ->
        samples = bundle.samples
        analyses = bundle.analyses
        if not samples?
            samples = {}
        sampleMap = {}
        for name of samples
            sampleMap[name] = []

        for id, analysis of analyses
            sampleName = analysis.sample_name
            if !sampleMap[sampleName]?
                sampleMap[sampleName] = []

            sampleMap[sampleName].push(analysis)

        trees = []
        for name, analysisList of sampleMap
            entry = {
                "sample": samples[name],
                "analyses": _.sortBy(analysisList, "name")
            }
            trees.push(entry)
        _.sortBy(trees, (obj) -> obj.sample.name)
        return trees


    findProjectEntry = (element) ->
        parent = element.parent()
        isMatch = (parent.hasClass("project-entry"))
        i = 0
        while(!isMatch && i < 100)
            i++
            parent = parent.parent()
            isMatch = (parent.hasClass("project-entry") || parent.prop("tagName") == "BODY")
        return parent


    Application::_makeSampleTree = (tree) ->
        cleanNamePattern = /_/g
        sample = tree.sample
        analyses = tree.analyses

        analysisChunks = []
        
        if analyses.length > 0
            expander = """
            <span class="expanded-display-control indigo-text">
                <i class="material-icons">check_box_outline_blank</i>
            </span>
            """
        else
            expander = ""
        prefix = """
        <div class='project-entry'>
            <div class="project-item" data-uuid='#{sample.uuid}'>
                <span class='project-sample-name'>
                    #{expander}
                    #{sample.name.replace(cleanNamePattern, " ")}
                </span>
                <div class="analysis-entry-list">
        """
        for analysis in analyses
            analysisChunk = """
                <div class='analysis-entry-item' data-uuid='#{analysis.uuid}'>
                    <span class='project-analysis-name'>
                        #{analysis.name.replace(" at " + sample.name, "").replace(cleanNamePattern, " ")}
                    </span>
                </div>
            """
            analysisChunks.push analysisChunk
        suffix = """
                </div>
            </div>
        </div>
        """
        entry = [
            prefix,
            analysisChunks.join("\n"),
            suffix
        ].join("\n")
        return $(entry)


    Application::renderSampleTree = (container) ->
        container = $(container)
        pastState = {}
        for element in container.find(".project-entry")
            element = $(element)
            dataTag = element.find(".project-item")
            uuid = dataTag.data("uuid")
            stateValue =  dataTag.data("state")
            pastState[uuid] = if stateValue? then stateValue else TreeViewStateCode.closed

        container.empty()
        trees = composeSampleAnalysisTree(@)
        rendered = []
        for tree in trees
            entry = @_makeSampleTree(tree)
            rendered.push(entry)
        container.append(rendered)
        for entry in rendered
            dataTag = entry.find(".project-item")
            uuid = dataTag.data("uuid")
            openClosed = pastState[uuid]
            if openClosed == "closed"
                toggleProjectTreeOpenCloseState(entry, openClosed)
        return pastState


    toggleProjectTreeOpenCloseState = (projectTree, state=undefined) ->
        handleList = projectTree.find(".analysis-entry-list")
        dataTag = projectTree.find(".project-item")
        if not state?
            if(handleList.is(":visible"))
                state = TreeViewStateCode.closed
            else
                state = TreeViewStateCode.open
        if state == TreeViewStateCode.open
            handleList.show()
            projectTree.find(
                ".expanded-display-control .material-icons"
                ).text("check_box_outline_blank")                    
            dataTag.data("state", TreeViewStateCode.open)
        else
            handleList.hide()
            projectTree.find(
                ".expanded-display-control .material-icons"
                ).text("add_box")                    
            dataTag.data("state", TreeViewStateCode.closed)


    $ ->
        # Sets up the analysis name click delegation handler
        $("body").on("click", ".projects-entry-list .analysis-entry-item", (event) ->
            target = this
            GlycReSoft.invalidate()
            handle = $(target)
            id = handle.data('uuid')
            if (GlycReSoft.getShowingLayer().name != ActionLayerManager.HOME_LAYER)
                GlycReSoft.removeCurrentLayer()
            GlycReSoft.addLayer(
                ActionBook.viewAnalysis, {analysis_id: id})
            console.log(GlycReSoft.layers)
            console.log(GlycReSoft.lastAdded)
            GlycReSoft.context["analysis_id"] = id
            GlycReSoft.setShowingLayer(
                GlycReSoft.lastAdded)
        )

        # Sets up the project open/close toggle delegation handler
        $("body").on("click", ".project-entry .expanded-display-control", (event) ->
            target = $(event.currentTarget)
            parent = findProjectEntry(target)
            toggleProjectTreeOpenCloseState(parent)
        )


    Application.initializers.push ->
        @on "render-samples", =>
            try
                @renderSampleTree ".projects-entry-list"
        @on "render-analyses", =>
            try
                @renderSampleTree ".projects-entry-list"
