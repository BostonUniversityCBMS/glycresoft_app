
PositionClassifier = {
    "nterm": "N-term"
    "cterm": "C-term"
    "N-term": "N-term"
    "C-term": "C-term"
}


parseModificationRuleSpecification = (specString) ->
    match = /(.*)\s\((.+)\)$/.exec(specString)
    return [match[1], ModificationTarget.parse(match[2])]


class ModificationTarget
    constructor: (residues, positionClassifier) ->
        if not residues?
            residues = []
        @residues = residues
        @positionClassifier = positionClassifier

    serialize: ->
        parts = []
        parts.push @residues.join("")
        if @positionClassifier?
            parts.push("@")
            parts.push(PositionClassifier[@positionClassifier])
        return parts.join(" ")

    @parse = (specString) ->
        match = /([A-Z]*)(?: @ ([NC]-term))?/.exec specString
        return new ModificationTarget(match[1].split(""), match[2])


class ModificationRule
    constructor: (@name, @formula, @mass, targets, @hidden=false, @category=0, @recent=false) ->
        @targets = []
        if targets?
            if _.isArray targets
                for target in targets
                    @addTarget target
            else
                @addTarget target

    addTarget: (target) ->
        if !(target instanceof ModificationTarget)
            target = ModificationTarget.parse target
        @targets.push(target)

    toSpecifications: ->
        specs = []
        for target in @targets
            specs.push new ModificationSpecification(@, target)
        return specs

    render: (container) ->
        if @name.length < 20
            name = @name
            nameEntry = """
            <div class="modification-rule-entry-name col s4" data-modification-name="#{@name}">
                #{name}
            </div>
            """
        else
            name = @name.slice(0, 17) + "..."
            nameEntry = """
            <div class="modification-rule-entry-name col s4 tooltipped" data-tooltip="#{@name}" data-modification-name="#{@name}">
                #{name}
            </div>
            """
        if @formula.length < 13
            formula = @formula
            formulaEntry = """
            <div class="modification-rule-entry-formula col s3">
                #{formula}
            </div>
            """
        else
            formula = @formula.slice(0, 10) + '...'
            formulaEntry = """
            <div class="modification-rule-entry-formula col s3 tooltipped" data-tooltip="#{@formula}">
                #{formula}
            </div>
            """
        for target in @targets
            entry = $("""
                <div class="modification-rule-entry row">
                    #{nameEntry}
                    <div class="modification-rule-entry-target col s2">
                        #{target.serialize()}
                    </div>
                    #{formulaEntry}
                    <div class="modification-rule-entry-mass col s3">
                        #{@mass}
                    </div>
                </div>
                """)
            container.append(entry)


class ModificationSpecification
    constructor: (@rule, @target, @hidden=false) ->
        @name = @rule.name
        @formula = @rule.formula
        @mass = @rule.mass

    render: (container) ->
        if @name.length < 20
            name = @name
            nameEntry = """
            <div class="modification-rule-entry-name col s4" data-modification-name="#{@name}">
                #{name}
            </div>
            """
        else
            name = @name.slice(0, 17) + "..."
            nameEntry = """
            <div class="modification-rule-entry-name col s4 tooltipped" data-tooltip="#{@name}" data-modification-name="#{@name}">
                #{name}
            </div>
            """
        if @formula.length < 13
            formula = @formula
            formulaEntry = """
            <div class="modification-rule-entry-formula col s3">
                #{formula}
            </div>
            """
        else
            formula = @formula.slice(0, 10) + '...'
            formulaEntry = """
            <div class="modification-rule-entry-formula col s3 tooltipped" data-tooltip="#{@formula}">
                #{formula}
            </div>
            """
        entry = $("""
            <div class="modification-rule-entry row" data-key="#{@serialize()}">
                #{nameEntry}
                <div class="modification-rule-entry-target col s2">
                    #{@target.serialize()}
                </div>
                #{formulaEntry}
                <div class="modification-rule-entry-mass col s3">
                    #{@mass}
                </div>
            </div>
            """)
        container.append(entry)

    serialize: ->
        return "#{@name} (#{@target.serialize()})"


class ModificationIndex
    constructor: (rules={}) ->
        @rules = rules
        @index = {}

    addRule: (rule) ->
        @rules[rule.serialize()] = rule

    removeRule: (rule) ->
        delete @rules[rule.serialize()]

    getRule: (spec) ->
        return @rules[spec]

    updateRuleFromSpecString: (specString) ->
        [name, target] = parseModificationRuleSpecification(specString)
        if @rules[name]?
            @rules[name].addTarget(target)
        else
            throw new Error("#{name} does not exist")

    updateFromAPI: (callback) ->
        $.get("/api/modifications").done (collection) =>
            definitions = collection["definitions"]
            specificities = collection["specificities"]
            i = 0
            tempIndex = {}
            for values in definitions
                i += 1
                entry = new ModificationRule(values[0], values[1], values[2])
                tempIndex[entry.name] = entry
            j = 0
            for spec in specificities
                j += 1
                [name, target] = parseModificationRuleSpecification spec
                entry = tempIndex[name]
                entry.addTarget target
                j = 0
            for key, entry of tempIndex
                for modSpec in entry.toSpecifications()
                    @addRule modSpec
            console.log "Update From API Done"
            @index = tempIndex
            if callback?
                callback(@)


class ModificationRuleListing extends ModificationIndex
    constructor: (@container, rules={}) ->
        super(rules)

    find: (selector) ->
        return @container.find(selector)

    render: ->
        @container.empty()
        keys = Object.keys(@rules)
        keys.sort (a, b) ->
            a = a.toLowerCase()
            b = b.toLowerCase()
            if a > b
                return 1
            else if a < b
                return -1
            return 0
        for key in keys
            rule = @rules[key]
            if rule.hidden
                continue
            rule.render @container
        materialTooltip()


class ModificationSelectionEditor
    constructor: (@container) ->
        @fullListingContainer = @container.find(".modification-listing")
        @constantListingContainer = @container.find(".constant-modification-choices")
        @variableListingContainer = @container.find(".variable-modification-choices")
        @fullListing = new ModificationRuleListing(@fullListingContainer)
        @constantListing = new ModificationRuleListing(@constantListingContainer)
        @variableListing = new ModificationRuleListing(@variableListingContainer)
        @state = 'select'
        @setState(@state)

    initialize: (callback) ->
        @hide()
        @fullListing.updateFromAPI (content) =>
            console.log("Finished Update From API")
            @fullListing.render()
            @setupHandlers()
            @show()
            if callback?
                callback(@)

    hide: ->
        @container.hide()

    show: ->
        @container.show()

    getSelectedModifications: (listing, sourceListing) =>
        if not sourceListing?
            sourceListing = @fullListing
        chosen = listing.find(".selected")
        specs = []
        for row in chosen
            row = $ row
            key = row.data("key")
            rule = sourceListing.getRule key
            specs.push rule
        return specs

    _getChosenModificationSpecs: (listing) ->
        chosen = listing.find(".modification-rule-entry")
        specs = []
        for row in chosen
            row = $ row
            key = row.data("key")
            specs.push key
        return specs.join(";;;")

    getConstantModificationSpecs: ->
        @_getChosenModificationSpecs @constantListing

    getVariableModificationSpecs: ->
        @_getChosenModificationSpecs @variableListing

    _chooseModification: (modSpec, listing) ->
        rule = @fullListing.getRule modSpec
        @fullListing.removeRule rule
        listing.addRule rule
        @fullListing.render()
        listing.render()

    chooseConstant: (modSpec) ->
        @_chooseModification modSpec, @constantListing

    chooseVariable: (modSpec) ->
        @_chooseModification modSpec, @variableListing

    transferModificationsToChosenSet: (chosenListing) ->
        rules = @getSelectedModifications @fullListingContainer
        for ruleSpec in rules
            @fullListing.removeRule ruleSpec
            chosenListing.addRule ruleSpec
        chosenListing.render()
        @fullListing.render()

    removeRuleFromChosenSet: (chosenListing) ->
        rules = @getSelectedModifications chosenListing, chosenListing
        for ruleSpec in rules
            chosenListing.removeRule ruleSpec
            @fullListing.addRule ruleSpec
        @fullListing.render()
        chosenListing.render()

    setupHandlers: ->
        @container.on "click", ".modification-rule-entry", (event) ->
            handle = $(@)
            isSelected = handle.data "selected"
            if !isSelected?
                isSelected = false
            handle.data "selected", !isSelected
            if handle.data "selected"
                handle.addClass("selected")
            else
                handle.removeClass("selected")

        self = @

        @container.find(".add-constant-btn").click (event) =>
            @transferModificationsToChosenSet @constantListing

        @container.find(".add-variable-btn").click (event) =>
            @transferModificationsToChosenSet @variableListing

        @container.find(".remove-selected-btn").click (event) =>
            @removeRuleFromChosenSet @constantListing
            @removeRuleFromChosenSet @variableListing

        @container.find(".create-custom-btn").click (event) =>
            @setState "create"

        @container.find(".cancel-creation-btn").click (event) =>
            @setState "select"

        @container.find(".submit-creation-btn").click (event) =>
            @createModification()

        @container.find("#modification-listing-search").keyup (event) ->
            self.filterSelectionList(@value)

    createModification: ->
        name = @container.find("#new-modification-name").val()
        formula = @container.find("#new-modification-formula").val()
        target = @container.find("#new-modification-target").val()
        formData = {
            "new-modification-name": name,
            "new-modification-formula": formula,
            "new-modification-target": target
        }
        console.log "Submitting", formData
        $.post("/glycopeptide_search_space/modification_menu", formData).done (payload) =>
            # Clear old values
            @container.find("#new-modification-name").val("")
            @container.find("#new-modification-formula").val("")
            @container.find("#new-modification-target").val("")

            modRule = new ModificationRule(payload.name, payload.formula, payload.mass)
            for spec in payload.specificities
                modRule.addTarget spec
            for modSpec in modRule.toSpecifications()
                @fullListing.addRule modSpec
            @fullListing.render()
            @setState "select"
        .fail (err) =>
            console.log err

    filterSelectionList: (pattern) ->
        try
            pattern = new RegExp(pattern)
            for key, rule of @fullListing.rules
                if pattern.test key
                    rule.hidden = false
                else
                    rule.hidden = true
        catch err
            console.log err
        finally
            @fullListing.render()

    setState: (state) ->
        if state == 'select'
            @container.find(".modification-listing-container").show()
            @container.find(".modification-creation-container").hide()
            @container.find(".modification-editor-disabled").hide()
        else if state == 'create'
            @container.find(".modification-listing-container").hide()
            @container.find(".modification-creation-container").show()
            @container.find(".modification-editor-disabled").hide()
        else if state == "disabled"
            @container.find(".modification-listing-container").hide()
            @container.find(".modification-creation-container").hide()
            @container.find(".modification-editor-disabled").show()
        @state = state


makeModificationSelectionEditor = (uid, callback) ->
    template = """
<div class='modification-selection-editor' id='modification-selection-editor-#{uid}'>
    <div class='modification-listing-container'>
        <div class='row'>
            <h5 class='section-title'>Select Modifications</h5>
        </div>
        <div class='row'>
            <div class='col s6'>
                <div class='modification-listing-header row'>
                    <div class='col s4'>Name</div>
                    <div class='col s2'>Target</div>
                    <div class='col s3'>Formula</div>
                    <div class='col s3'>Mass</div>
                </div>
                <div class='modification-listing'>
                </div>
                <input id='modification-listing-search' type="text" name="modification-listing-search"
                       placeholder="Search by name"/>
            </div>
            <div class='col s2'>
                <div class='modification-choice-controls'>
                    <a class='btn add-constant-btn tooltipped'
                       data-tooltip="Add Selected Modification Rules to Constant List">
                       + Constant</a><br>
                    <a class='btn add-variable-btn tooltipped'
                       data-tooltip="Add Selected Modification Rules to Variable List">
                       + Variable</a><br>
                    <a class='btn remove-selected-btn tooltipped'
                       data-tooltip="Remove Selected Rules From Constant and/or Variable List">
                       - Selection</a><br>
                    <a class='btn create-custom-btn tooltipped' data-tooltip="Create New Modification Rule">
                        Create Custom</a><br>
                </div>
            </div>
            <div class='modification-choices-container col s4'>
                <div class='modification-choices'>
                    <div class='choice-list-header'>
                        Constant
                    </div>
                    <div class='constant-modification-choices'>
                        
                    </div>
                    <div class='choice-list-header' style='border-top: 1px solid lightgrey'>
                        Variable
                    </div>
                    <div class='variable-modification-choices'>
                        
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class='modification-creation-container'>
        <div class='row'>
            <h5 class='section-title'>Create Modification</h5>
        </div>
        <div class='modification-creation row'>
            <div class='col s3 input-field'>
                <label for='new-modification-name'>New Modification Name</label>
                <input id='new-modification-name' name="new-modification-name"
                       type="text" class="validate">
            </div>
            <div class='col s3 input-field'>
                <label for='new-modification-formula'>New Modification Formula</label>
                <input id='new-modification-formula' name="new-modification-formula"
                       type="text" class="validate" pattern="^[A-Za-z0-9\-\(\)]+$">
            </div>
            <div class='col s3 input-field'>
                <label for='new-modification-target'>New Modification Target</label>
                <input id='new-modification-target' name="new-modification-target"
                       type="text" class="validate" pattern="([A-Z]*)(?: @ ([NC]-term))?">
            </div>
        </div>
        <div class='modification-choice-controls row'>
            <a class='btn submit-creation-btn'>Create</a><br>
            <a class='btn cancel-creation-btn'>Cancel</a><br>
        </div>
    </div>
    <div class='modification-editor-disabled'>
        Modification Specification Not Permitted
    </div>
</div>
    """
    handle = $(template)
    handle.find("#modification-selection-editor-#{uid}")
    inst = new ModificationSelectionEditor(handle)
    inst.initialize(callback)
    return inst
