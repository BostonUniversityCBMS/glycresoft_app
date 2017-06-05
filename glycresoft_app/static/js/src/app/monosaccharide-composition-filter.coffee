
makeMonosaccharideRule = (count) -> {minimum: 0, maximum: count, include: true}

makeRuleSet = (upperBounds) ->
    residueNames = Object.keys upperBounds
    rules = {}
    for residue, count of upperBounds
        rules[residue] = makeMonosaccharideRule(count)
    return rules

makeMonosaccharideFilter = (parent, upperBounds) ->
    if !upperBounds?
        upperBounds = GlycReSoft.settings.monosaccharide_filters
    residueNames = Object.keys upperBounds
    rules = makeRuleSet(upperBounds)
    return new MonosaccharideFilter(parent, residueNames, rules)

class MonosaccharideFilterState
    constructor: (@application) ->
        @setHypothesis(null)

    setHypothesis: (hypothesis) ->
        if hypothesis?
            @currentHypothesis = hypothesis
            @hypothesisUUID = @currentHypothesis.uuid
            @hypothesisType = @currentHypothesis.hypothesis_type
            @bounds = makeRuleSet(@currentHypothesis.monosaccharide_bounds)
        else
            @currentHypothesis = null
            @hypothesisUUID = null
            @hypothesisType = null
            @bounds = {}
    isSameHypothesis: (hypothesis) -> hypothesis.uuid == @hypothesisUUID

    setApplicationFilter: ->
        console.log "Updating Filters", @bounds
        @application.settings.monosaccharide_filters = @bounds

    update: (hypothesisUUID, callback) ->
        console.log "Is Hypothesis New?"
        console.log hypothesisUUID, @hypothesisUUID
        if hypothesisUUID != @hypothesisUUID
            console.log("Is New Hypothesis")
            HypothesisAPI.get hypothesisUUID, (result) =>
                hypothesis = result.hypothesis
                @setHypothesis(hypothesis)
                @setApplicationFilter()
                callback(@bounds)
        else
            console.log("Is not new hypothesis")
            @setApplicationFilter()
            callback(@bounds)

    invalidate: ->
        @setHypothesis(null)
        @setApplicationFilter()


class MonosaccharideFilter
    constructor: (parent, residueNames, rules) ->
        if !rules?
            if !GlycReSoft.settings.monosaccharide_filters?
                GlycReSoft.settings.monosaccharide_filters = {}
            rules = GlycReSoft.settings.monosaccharide_filters
        if !residueNames?
            console.log("Getting Residue Names", GlycReSoft.settings.monosaccharide_filters)
            residueNames = Object.keys GlycReSoft.settings.monosaccharide_filters
        @container = $("<div></div>").addClass("row")
        $(parent).append(@container)
        @residueNames = residueNames
        @rules = rules

    makeFilterWidget: (residue) ->
        rule = @rules[residue]
        if !rule?
            rule = {
                minimum: 0
                maximum: 10
                include: true
            }
            @rules[residue] = rule
        residue.name = residue
        residue.sanitizeName = sanitizeName = residue.replace(/[\(\),#.@\^]/g, "_")
        template = """
            <span class="col s2 monosaccharide-filter" data-name='#{residue}'>
                <p style='margin: 0px; margin-bottom: -10px;'>
                    <input type="checkbox" id="#{sanitizeName}_include" name="#{sanitizeName}_include"/>
                    <label for="#{sanitizeName}_include"><b>#{residue}</b></label>
                </p>
                <p style='margin-top: 0px; margin-bottom: 0px;'>
                    <input id="#{sanitizeName}_min" type="number" placeholder="Minimum #{residue}" style='width: 45px;' min="0"
                           value="#{rule.minimum}" max="#{rule.maximum}" name="#{sanitizeName}_min"/> : 
                    <input id="#{sanitizeName}_max" type="number" placeholder="Maximum #{residue}" style='width: 45px;' min="0"
                           value="#{rule.maximum}" name="#{sanitizeName}_max"/>
                </p>
            </span>
            """
        self = @
        rendered = $(template)
        rendered.find("##{sanitizeName}_min").change ->
            rule.minimum = parseInt($(@).val())
            self.changed()
        rendered.find("##{sanitizeName}_max").change ->
            rule.maximum = parseInt($(@).val())
            self.changed()
        rendered.find("##{sanitizeName}_include").prop("checked", rule.include).click ->
            rule.include = $(@).prop("checked")
            self.changed()

        return rendered

    render: ->
        for residue in @residueNames
            widget = @makeFilterWidget(residue)
            @container.append(widget)

    changed: ->
        console.log("MonosaccharideFilter changed")
        if !@rules?
            console.log("No rules", @, @rules)
        old = GlycReSoft.settings.monosaccharide_filters
        console.log("Updating monosaccharide_filters")
        GlycReSoft.settings.monosaccharide_filters = @rules
        console.log(old, GlycReSoft.settings.monosaccharide_filters)
        GlycReSoft.emit("update_settings")    
